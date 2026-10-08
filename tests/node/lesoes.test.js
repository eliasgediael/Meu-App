// Lesões e limitações (decisão 3A do relatório aprovado em 07/10/2026). As regras são as do motor.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'registrarLesao', 'confirmarAjusteLesao', 'responderSegurancaLesao',
    'propostaMelhorou', 'confirmarMelhorou', 'lesoesAtivas', 'planoPausado', 'versoesDoPlano', 'chaveDiaAtual', 'listarAtividades', 'registrarAtividadeLivre',
    'normalizeNoAccents', 'athleteGetPath', 'retomarPlano']);
  const S = T.state;
  const novo = async (n) => {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.planoVersoes = [];
    S.diarioTreinador = []; S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = []; S.muscDayOrigin = {};
    await T.qv2Aplicar(perfil(n)); await T.gerarPrimeiroPlanoV2();
  };
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const corridas = () => dias.map(d => S.treinos.find(t => t.day === T.chaveDiaAtual(d))).filter(Boolean);
  const exercicios = () => dias.flatMap(d => S.musculacao[d] || []);
  const joelhoRe = /agachamento|leg press|hack|extensora|afundo|passada|step up|bulgaro|salto|wall sit/;

  await novo('08');
  await T.registrarAtividadeLivre({ id: 'run:l', tipo: 'corrida', data: '2026-10-04', distKm: 4, tempoSeg: 1400 });
  const atividades = JSON.stringify(T.listarAtividades());
  const tinhaQualidade = corridas().some(c => /interval|repeti|limiar|tempo|prova/i.test(c.type));
  const tinhaJoelho = exercicios().some(e => joelhoRe.test(T.normalizeNoAccents(e.nome)));
  const r = await T.registrarLesao({ regiao: 'joelho', intensidade: 'moderada', emRepouso: false });
  ok(T.lesoesAtivas().length === 1 && T.lesoesAtivas()[0].desde === '2026-10-05', 'limitação grava região, intensidade e data nos campos do questionário');
  ok(!r.seguranca && T.versoesDoPlano().length >= 1 && T.versoesDoPlano()[0].origem === 'lesao', 'dor moderada não pede etapa de segurança; versão guardada antes');
  ok(!corridas().some(c => /interval|repeti|limiar|tempo|prova/i.test(c.type)) && !exercicios().some(e => joelhoRe.test(T.normalizeNoAccents(e.nome))),
    `sessões arriscadas bloqueadas na hora (qualidade: ${tinhaQualidade}, joelho: ${tinhaJoelho}, bloqueadas: ${r.arriscadas.length})`);
  ok(!tinhaQualidade && !tinhaJoelho || S.diarioTreinador.some(x => x.alteracao === 'Sessão bloqueada'), 'bloqueio entra no histórico de mudanças');
  ok(r.proposta && Array.isArray(r.proposta.mudancas), 'proposta de antes/depois da semana');
  const antesConfirmar = JSON.stringify([S.treinos, S.musculacao]);
  await T.confirmarAjusteLesao(r.proposta, r.motivo);
  ok(!r.proposta.mudancas.length || JSON.stringify([S.treinos, S.musculacao]) !== antesConfirmar, `mudanças normais só entram ao confirmar (${r.proposta.mudancas.length} dia(s))`);
  ok(!corridas().some(c => /interval|repeti|limiar|tempo|prova/i.test(c.type)) && !exercicios().some(e => joelhoRe.test(T.normalizeNoAccents(e.nome))), 'semana refeita pelo motor respeita a limitação');
  ok(S.hybridPlanData.plan.slice(1).every(w => w.pendente), 'semanas futuras serão geradas com a limitação');
  ok(JSON.stringify(T.listarAtividades()) === atividades, 'nenhuma atividade apagada');

  // melhorou: semana intermediária, só com confirmação
  const pm = T.propostaMelhorou('joelho');
  ok(T.lesoesAtivas().length === 1, 'proposta de "melhorou" não tira a limitação antes de confirmar');
  await T.confirmarMelhorou('joelho', pm);
  ok(T.lesoesAtivas().length === 0 && (T.athleteGetPath(S.athleteProfile, 'restricoesTreino.historicoDor') || []).length === 1, 'confirmar tira a limitação e guarda no histórico');
  ok(!corridas().some(c => /interval|repeti|limiar|tempo|prova/i.test(c.type)), 'semana intermediária sem qualidade');
  ok(S.diarioTreinador.some(x => x.alteracao === 'Lesão melhorou'), 'histórico registra a melhora');

  // dor forte: etapa de segurança; "vou procurar avaliação" pausa o plano
  await novo('08');
  const f = await T.registrarLesao({ regiao: 'tornozelo', intensidade: 'forte', emRepouso: false });
  ok(f.seguranca && !f.proposta, 'dor forte pede a etapa de segurança antes de ajustar');
  await T.responderSegurancaLesao('avaliacao');
  ok(T.planoPausado() && S.hybridPlanData.pausa.motivo === 'lesao', '"vou procurar avaliação" pausa o plano');
  await novo('08');
  const g = await T.registrarLesao({ regiao: 'lombar', intensidade: 'leve', emRepouso: true });
  const prop = await T.responderSegurancaLesao('liberado');
  ok(g.seguranca && prop && !T.planoPausado(), '"já fui liberado(a)" segue para o ajuste da semana');
  semErro();
  process.exit(process.exitCode || 0);
})();
