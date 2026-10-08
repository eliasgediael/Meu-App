// Progresso (pacote visual): período Semana/Mês/Ciclo com comparação justa, evolução, atividades com filtro e
// histórico completo. Só dados registrados; nada de tonelagem.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'renderProgressoV2', 'frPeriodoProg',
    'frKmEntre', 'renderPerfilV2Content', 'renderPreferenciasV2', 'renderContaV2', 'registrarAtividadeLivre', 'frFiltrarAtividades', 'listarAtividades', 'frHistoricoAtividades', 'corridaProgressKey', 'frTreinosDoPlano', 'frNomeTreinoMusc', 'normalizarSessaoMuscHistorico', 'renderOnboardingScreen', 'qv2Render']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar(perfil('08')); const plano = await T.gerarPrimeiroPlanoV2();

  // boas-vindas e plano pronto (NOVA-04)
  const bv = T.renderOnboardingScreen();
  ok(/fr-bv-marca/.test(bv) && /id="obStart"/.test(bv) && /id="obLogin"/.test(bv) && !/#FF5A1F/i.test(bv), 'boas-vindas: marca, Começar, Já tenho uma conta, sem laranja');
  S.qv2 = { fase: 'pronto', resultado: plano, R: {} };
  const pr = T.qv2Render();
  const nC = (plano.semana.corridaWeek || []).length;
  ok(/Seu plano está pronto/.test(pr) && new RegExp(nC + ' corrida').test(pr) && (pr.match(/class="fr-prdia"/g) || []).length === 7 && /id="qv2VerTreino"/.test(pr), 'plano pronto: resumo, corridas e semana em ícones');
  S.qv2 = null;
  S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = [];

  // período: semana atual até hoje × mesmo trecho da semana anterior (hoje = segunda 05/10/2026)
  const P = T.frPeriodoProg('semana');
  ok(P.ini === '2026-10-05' && P.fim === '2026-10-05' && P.iniAnt === '2026-09-28' && P.fimAnt === '2026-09-28', 'semana compara com o mesmo trecho da semana anterior');
  const M = T.frPeriodoProg('mes');
  ok(M.ini === '2026-10-01' && M.iniAnt === '2026-09-01' && M.fimAnt === '2026-09-05', 'mês compara com os mesmos dias do mês anterior');

  await T.registrarAtividadeLivre({ id: 'run:a', tipo: 'corrida', data: '2026-10-05', distKm: 5, tempoSeg: 1500 });
  await T.registrarAtividadeLivre({ id: 'run:b', tipo: 'corrida', data: '2026-09-28', distKm: 4, tempoSeg: 1300 });
  S.workoutSessionsLog = [{ id: 'm1', data: '2026-10-05', title: 'Superiores', series: 12, exercicios: [] }];
  ok(Math.round(T.frKmEntre(P.ini, P.fim)) === 5 && Math.round(T.frKmEntre(P.iniAnt, P.fimAnt)) === 4, 'km por período vem das atividades registradas');

  // Nova arte do Progresso (08/10/2026)
  S.progModo = 'semana'; S.progEvol = 'corrida'; S.progDetalhe = null; S.progHistorico = false;
  const h = T.renderProgressoV2();
  ok(/5 out – 11 out 2026/.test(h) && /5 <small>km<\/small>/.test(h) && /Sessão de força/.test(h), 'período com datas e resumo compacto (km e sessões de força)');
  ok(/data-progmodo="ciclo"/.test(h) && /data-progevol="musc"/.test(h) && /Últimas atividades/.test(h) && /Ver histórico completo/.test(h) && (h.match(/data-progdet="/g) || []).length === 3, 'Semana/Mês/Ciclo, evolução, últimas atividades, histórico e 3 análises detalhadas');
  ok(!/Recuperação/.test(h) && !/fr-progsec/.test(h) && !/data-muschistopen/.test(h), 'página principal sem recuperação, blocos e históricos repetidos');
  ok(!/kg ?×|tonelada|volume total/i.test(h.replace(/Última vez[^<]*/g, '')), 'sem tonelagem no Progresso');
  ok(/Superiores/.test(h), 'nome do treino de força consistente nas últimas atividades');
  // livre entra nos totais, mas não vira treino do plano concluído
  const semLivre = T.frTreinosDoPlano('2026-10-05', '2026-10-11');
  await T.registrarAtividadeLivre({ id: 'run:c', tipo: 'corrida', data: '2026-10-05', distKm: 2, tempoSeg: 700 });
  const comLivre = T.frTreinosDoPlano('2026-10-05', '2026-10-11');
  ok(semLivre.previstos > 0 && comLivre.feitos === semLivre.feitos && Math.round(T.frKmEntre('2026-10-05', '2026-10-11')) === 7, `atividade livre entra nos km (7) e não conta como treino do plano (${comLivre.feitos} de ${comLivre.previstos})`);
  // evolução de musculação: séries realizadas no mesmo período
  S.progEvol = 'musc';
  ok(/Séries realizadas por dia/.test(T.renderProgressoV2()), 'evolução alterna para séries de musculação no período');
  S.progModo = 'mes'; S.progEvol = 'corrida';
  const hm = T.renderProgressoV2();
  ok(/1 out – 31 out 2026/.test(hm) && /Distância por semana/.test(hm) && />S5</.test(hm), 'mês: resumo e gráfico no mesmo período (1–31 out)');
  // planejamento parcial: semanas ainda não geradas não entram no total (sem repetir a última semana)
  const sem1 = T.frTreinosDoPlano('2026-10-05', '2026-10-11');
  const mes = T.frTreinosDoPlano('2026-10-01', '2026-10-31');
  const pendentes = S.hybridPlanData.plan.filter(w => w.pendente).length;
  ok(pendentes > 0 && mes.parcial && mes.previstos === sem1.previstos && /planejamento parcial/.test(hm), `mês: conta só a semana gerada (${mes.previstos}) e avisa "planejamento parcial"`);
  ok(!sem1.parcial && !/planejamento parcial/.test(h), 'semana atual gerada: sem aviso de parcial');
  // análises detalhadas preservam os recursos
  S.progModo = 'semana'; S.progDetalhe = 'corrida'; S.checkinDiario = {};
  const dc = T.renderProgressoV2();
  ok(/Recuperação/.test(dc) && /Quilômetros por semana/.test(dc) && /data-progdetvoltar/.test(dc), 'análise de Corrida: recuperação, km por semana e voltar');
  ok(/Sem avaliação/.test(dc) && !/Recuperação boa/.test(dc), 'sem check-in: recuperação "Sem avaliação", nunca "Recuperação boa"');
  S.checkinDiario = { '2026-10-05': { energia: 2, pernas: 2, dor: 1 } };
  ok(/Recuperação boa/.test(T.renderProgressoV2()), 'com check-in sem alertas: "Recuperação boa"');
  S.checkinDiario = {};
  // nomes da musculação: personalizado fica; genérico vira o grupo
  ok(T.frNomeTreinoMusc({ title: 'Leg Day pesado', exercicios: [{ grupo: 'Peito' }] }) === 'Leg Day pesado', 'nome personalizado do treino é preservado');
  ok(T.frNomeTreinoMusc({ title: 'Treino de sexta', exercicios: [{ grupo: 'Peito' }, { grupo: 'Costas' }] }) === 'Superiores'
    && T.frNomeTreinoMusc({ title: 'Musculação', exercicios: [{ grupo: 'Pernas' }, { grupo: 'Pernas' }, { grupo: 'Core' }] }) === 'Inferiores', 'nome automático/genérico usa o grupo predominante');
  const logPers = { id: 'mp', data: '2026-10-04', title: 'Meu treino A', series: 9, exercicios: [{ nome: 'Supino', grupo: 'Peito', series: '3', reps: '10' }] };
  ok(T.normalizarSessaoMuscHistorico(logPers).titulo === 'Meu treino A' && logPers.title === 'Meu treino A', 'título histórico personalizado não é sobrescrito');
  S.progDetalhe = 'musc';
  ok(/Séries por semana/.test(T.renderProgressoV2()), 'análise de Musculação com séries e histórico');
  S.progDetalhe = null;
  // sem plano: sem "0 de 0"
  const hpGuardado = S.hybridPlanData; S.hybridPlanData = null;
  const sp = T.renderProgressoV2();
  ok(!/Treinos do plano/.test(sp) && !/0 <small>de<\/small> 0/.test(sp), 'sem plano, a coluna "Treinos do plano" não aparece');
  S.hybridPlanData = hpGuardado;

  const todas = T.listarAtividades();
  ok(T.frFiltrarAtividades(todas, 'forca').every(a => a.tipo === 'musculacao') && T.frFiltrarAtividades(todas, 'livres').every(a => a.livre), 'filtros Força e Livres');
  S.progHistorico = true; S.histFiltro = 'todas';
  const hh = T.renderProgressoV2();
  ok(/Histórico/.test(hh) && /Outubro 2026/.test(hh) && /data-histdia="2026-10-05"/.test(hh) && /Corrida livre/.test(hh), 'histórico completo com mês, semana e atividades agrupadas');
  S.histDia = '2026-10-06';
  ok(/Nenhuma atividade neste dia/.test(T.renderProgressoV2()), 'dia sem atividade mostra estado vazio');

  const pf = T.renderPerfilV2Content();
  ok(/Plano híbrido/.test(pf) && (pf.match(/class="fr-pnivel"/g) || []).length === 2 && /Histórico de mudanças/.test(pf) && /Privacidade e dados/.test(pf), 'Perfil: plano, níveis separados, Meu treino e Minha conta');
  ok(['Plano e objetivo', 'Disponibilidade', 'Lesões e limitações', 'Dados pessoais', 'Preferências', 'Ajuda e suporte', 'Versão do app'].every(x => pf.includes(x)), 'Perfil com os itens da arte 04');
  ok(!/data-perfilgo="turma"/.test(pf) && /Configurações/.test(pf), 'Perfil não oferece grupos como a nova rede social');
  ok(!/Turma/.test(T.renderContaV2()), 'Conta não promete a antiga Turma');
  S.preferencias = { vozKm: false, autoPause: true, aviso: { modo: 'vibracao', volume: 0.7 } };
  S.vozAtiva = false;
  const cfg = T.renderPreferenciasV2();
  ok(['Voz e corrida', 'Descanso da musculação', 'Exibição', 'Conta e dados'].every(x => cfg.includes(x)), 'Configurações agrupadas por assunto');
  ok(/aria-label="Voz nos treinos" aria-checked="false"/.test(cfg) && /aria-label="Voz a cada km" aria-checked="false"/.test(cfg) && /aria-label="Pausa automática na corrida" aria-checked="true"/.test(cfg), 'controles acessíveis refletem as preferências reais');
  ok(!/id="avisoVolume"/.test(cfg) && /id="avisoTestar"/.test(cfg), 'vibração não oferece volume; teste de aviso permanece');
  ok(/data-perfilgo="conta"/.test(cfg) && /data-perfilgo="maisOpcoes"/.test(cfg), 'Configurações mantém acesso à conta e ao backup');
  semErro();
  process.exit(process.exitCode || 0);
})();
