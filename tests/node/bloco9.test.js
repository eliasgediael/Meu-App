// Bloco 9: sugestões da agenda após mudança manual (Aceitar / Manter assim), proposta de zonas com comparação,
// sugestão de vínculo da atividade livre e ordem do novo Início.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'sugestaoDaAgenda', 'aceitarSugestaoAgenda', 'manterConflitoAgenda',
    'treinoEntryForDay', 'muscListForDay', 'proporZonas', 'responderPropostaZonas', 'compararZonas', 'registrarAtividadeLivre', 'sugerirVinculo', 'vincularAtividadeLivre',
    'recusarVinculo', 'conclusaoCorrida', 'atividadesLivres', 'renderHojeV2Content', 'corridaProgressKey', 'DAY_ABBR']);
  const S = T.state;
  const preparar = async (n) => { S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; await T.qv2Aplicar(perfil(n)); await T.gerarPrimeiroPlanoV2(); S.corridaProgress = {}; S.atividadesLivres = []; };
  await preparar('02');

  // ---------- agenda ----------
  ok(T.sugestaoDaAgenda() === null, 'semana gerada pelo motor não tem aviso');
  const intervalado = T.DAY_ABBR.find(d => { const e = T.treinoEntryForDay(d); return e && /Interval|Limiar|Long/i.test(e.type); });
  const depois = T.DAY_ABBR[T.DAY_ABBR.indexOf(intervalado) + 1];
  const muscAntes = JSON.stringify(S.musculacao);
  // mudança manual: Leg Day no dia seguinte ao intervalado
  S.musculacao[depois] = [{ id: 'x1', nome: 'Agachamento livre com barra', grupo: 'Pernas', series: '4', reps: '8', sessao: 'LEG_DAY_HEAVY' }, { id: 'x2', nome: 'Leg press 45 graus', grupo: 'Pernas', series: '3', reps: '10', sessao: 'LEG_DAY_HEAVY' }];
  const sug = T.sugestaoDaAgenda();
  ok(sug && sug.codigo && sug.mensagem.length <= 70, 'mudança manual com conflito gera aviso curto: "' + (sug && sug.mensagem) + '"');
  ok(sug && sug.proposta && sug.proposta.de === depois && sug.proposta.mod === 'musc', 'sugestão objetiva: "' + (sug && sug.sugestao) + '"');
  ok(S.musculacao[depois] && S.musculacao[depois].length === 2, 'o aviso sozinho não muda a semana');
  await T.aceitarSugestaoAgenda();
  ok(!(S.musculacao[depois] || []).length && S.musculacao[sug.proposta.para] && S.musculacao[sug.proposta.para][0].nome === 'Agachamento livre com barra', 'Aceitar move a musculação para ' + sug.proposta.para);
  ok(T.sugestaoDaAgenda() === null || T.sugestaoDaAgenda().chave !== sug.chave, 'depois de aceitar, o conflito some');
  // Manter assim
  S.musculacao[sug.proposta.para].forEach(() => {}); S.musculacao[depois] = S.musculacao[sug.proposta.para]; delete S.musculacao[sug.proposta.para];
  const sug2 = T.sugestaoDaAgenda();
  await T.manterConflitoAgenda(sug2.chave);
  ok(!T.sugestaoDaAgenda() || T.sugestaoDaAgenda().chave !== sug2.chave, 'Manter assim esconde o aviso desta semana e não muda nada');
  ok(S.musculacao[depois] && S.musculacao[depois].length === 2, 'Manter assim deixa a musculação onde estava');
  S.musculacao = JSON.parse(muscAntes);
  ok((S.hybridPlanData.assessment.availableDays || []).includes(sug.proposta.para), 'o dia sugerido é um dos dias disponíveis da pessoa');
  await preparar('08');

  // ---------- zonas ----------
  S.corridaVdotData = null; S.zonasHistorico = [];
  ok(T.proporZonas(40, 'padrao', 'media') === 'aplicada' && S.corridaVdotData.vdot === 40, 'primeira zona entra direto (não substitui nada)');
  ok(T.proporZonas(45, 'teste', 'alta') === 'proposta' && S.corridaVdotData.vdot === 40 && S.corridaVdotData.propostaZona.vdot === 45, 'mudança de zona vira proposta; zonas atuais continuam');
  const comp = T.compararZonas(40, 45);
  ok(comp.length === 5 && comp.every(z => z.atual !== z.novo), 'comparação mostra ritmo atual e novo de cada zona (' + comp[0].rotulo + ' ' + comp[0].atual + ' → ' + comp[0].novo + ')');
  T.responderPropostaZonas(false);
  ok(S.corridaVdotData.vdot === 40 && !S.corridaVdotData.propostaZona, 'Manter atuais descarta a proposta');
  T.proporZonas(45, 'teste', 'alta'); T.responderPropostaZonas(true);
  ok(S.corridaVdotData.vdot === 45 && S.zonasHistorico[S.zonasHistorico.length - 1].vdot === 45, 'Atualizar zonas aplica e registra no histórico');

  // ---------- vínculo da atividade livre ----------
  const hojeCorrida = T.treinoEntryForDay('Seg');
  await T.registrarAtividadeLivre({ id: 'run:longe', tipo: 'corrida', data: '2026-10-05', distKm: 2, tempoSeg: 700 });
  ok(T.sugerirVinculo({ ...T.atividadesLivres().find(a => a.id === 'run:longe'), livre: true }) === null, 'dados muito diferentes do treino do dia: sem sugestão');
  await T.registrarAtividadeLivre({ id: 'run:perto', tipo: 'corrida', data: '2026-10-05', distKm: hojeCorrida.totalKm * 1.05, tempoSeg: (hojeCorrida.totalMin || 40) * 60 });
  const sv = T.sugerirVinculo({ ...T.atividadesLivres().find(a => a.id === 'run:perto'), livre: true });
  ok(sv && sv.sessao.chave === hojeCorrida.day, 'atividade parecida com o treino do dia recebe sugestão de vínculo');
  ok(T.conclusaoCorrida(hojeCorrida.day).status === 'pending', 'a sugestão não vincula sozinha');
  await T.recusarVinculo('run:longe');
  await T.vincularAtividadeLivre('run:perto');
  ok(T.conclusaoCorrida(hojeCorrida.day).status === 'completed' && !T.atividadesLivres().some(a => a.id === 'run:perto'), 'Vincular ao treino conclui a sessão com a atividade');
  ok(T.atividadesLivres().find(a => a.id === 'run:longe').vinculoRecusado, 'Manter como atividade livre fica registrado (não pergunta de novo)');

  // ---------- novo Início ----------
  S.checkinDiario = {}; S.corridaProgress = {};
  const h = T.renderHojeV2Content();
  const pos = (re) => { const m = re.exec(h); return m ? m.index : -1; };
  const ordem = [pos(/Como você está hoje/), pos(/fr-hero/), pos(/mrt-wkrow/), pos(/>Próximo</), pos(/Registrar atividade livre/)];
  ok(ordem.every(x => x >= 0) && ordem.every((x, i) => i === 0 || x > ordem[i - 1]), 'Início: prontidão → treino de hoje → semana → próximo → registrar livre (' + ordem.join(',') + ')');
  S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {}; S.preferencias = {};
  const h2 = T.renderHojeV2Content();
  ok(/Criar meu plano/.test(h2) && /Só quero registrar/.test(h2), 'sem plano: "Criar meu plano" e "Só quero registrar"');

  semErro();
  process.exit(process.exitCode || 0);
})();
