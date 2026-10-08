// Aba Treino / Gerenciar plano (pacote visual): menu só com ações que funcionam, plano completo, reorganizar
// semana com validação e antes/depois, histórico de mudanças com registros reais e revisão do questionário.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const VOLATEIS = new Set(['id', 'em', 'atualizadoEm', 'updatedAt', 'geradoEm', 'calculadoEm', 'measuredAt']);
const limpo = (v) => JSON.stringify(v, (k, x) => (VOLATEIS.has(k) ? undefined : x));

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarPlanoSemanal', 'qv2RespostasDoPerfil',
    'frSessoesMoviveis', 'destinosParaMover', 'moverSessao', 'frItensHistorico', 'frResumoSemanaPlano', 'frAbrirGerenciarPlano', 'frAbrirPlanoCompleto',
    'frConfirmarMover', 'hojeIdx', 'muscListForDay', 'treinoEntryForDay', 'renderTreinoV2Content', 'treinoPhaseParts', 'frUltimaVez', 'frEtapaInfo']);
  const S = T.state;

  // ---------- revisar questionário: as respostas reconstruídas do perfil geram o mesmo plano ----------
  let iguais = 0;
  for (const [nome, R0] of PERFIS) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null;
    await T.qv2Aplicar({ ...BASE, ...R0 });
    const p1 = S.athleteProfile;
    const a = T.gerarPlanoSemanal(p1);
    const R2 = T.qv2RespostasDoPerfil(p1);
    S.athleteProfile = T.criarAthleteProfile();
    await T.qv2Aplicar(R2);
    const b = T.gerarPlanoSemanal(S.athleteProfile);
    const resumo = (r) => limpo(r.bloqueado ? { b: true, s: r.status } : { sessoes: r.sessoes, sched: r.sched, alertas: r.alertas, semana: r.semana, trajetoria: r.trajetoria });
    if (resumo(a) === resumo(b)) iguais++; else console.log('  diferente: ' + nome);
  }
  ok(iguais === PERFIS.length, `revisar questionário: respostas reconstruídas geram o mesmo plano (${iguais}/${PERFIS.length})`);

  // ---------- plano de teste ----------
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar(perfil('02')); await T.gerarPrimeiroPlanoV2();
  S.tab = 'meusTreinos'; S.weekOffset = 0; S.diarioTreinador = [];

  // menu: só ações reais, sem "em breve" e sem funções ainda não implementadas
  let sheet = '';
  global.openSheet = globalThis.openSheet = (html) => { sheet = html; };
  T.frAbrirGerenciarPlano();
  ok(/Ver plano completo/.test(sheet) && /Reorganizar semana/.test(sheet) && /Histórico de mudanças/.test(sheet) && /Revisar questionário do plano/.test(sheet) && /Refazer meu plano/.test(sheet), 'menu Gerenciar plano tem as ações do plano');
  ok(/Editar treino do dia/.test(sheet) && /Criar treino manual/.test(sheet) && /Modelos salvos/.test(sheet), 'menu mantém o grupo Treino');
  ok(!/em breve|Encerrar|Alterar disponibilidade/i.test(sheet), 'menu sem botões falsos nem funções ainda não liberadas');
  ok(/data-gp="lesoes"/.test(sheet), 'menu tem Lesões e limitações (função real desde 07/10)');
  ok(/data-gp="pausar"/.test(sheet), 'menu tem Pausar plano (função real desde 07/10)');

  // plano completo distingue atual, calculada e prevista
  T.frAbrirPlanoCompleto();
  ok(/Atual/.test(sheet) && /Prevista/.test(sheet), 'plano completo marca semana atual e semanas previstas');
  const w1 = S.hybridPlanData.plan[0], w8 = S.hybridPlanData.plan[S.hybridPlanData.plan.length - 1];
  ok(/corrida/.test(T.frResumoSemanaPlano(w1)) && (!w8.pendente || /~\d+ min|^$/.test(T.frResumoSemanaPlano(w8))), 'resumo por semana vem do plano (sem inventar dados): ' + T.frResumoSemanaPlano(w1));

  // reorganizar: só sessões pendentes de hoje em diante, destinos validados, mudança registrada no histórico
  const sess = T.frSessoesMoviveis();
  ok(sess.length > 0 && sess.every(s => ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].indexOf(s.d) >= T.hojeIdx()), 'reorganizar lista treinos de hoje em diante (' + sess.length + ')');
  const s = sess.find(x => x.mod === 'musc');
  const disp = S.hybridPlanData.assessment.availableDays;
  const dest = T.destinosParaMover(s.d, s.mod, T.hojeIdx()).filter(x => !disp || disp.includes(x));
  T.frConfirmarMover(s, dest[0] || 'Dom');
  ok(/→/.test(sheet) && /Mover/.test(sheet), 'confirmação mostra antes → depois');
  if (dest[0]) {
    const antes = T.muscListForDay(s.d).length;
    await T.moverSessao(s.d, dest[0], s.mod, 'reorganização da semana');
    ok(antes > 0 && T.muscListForDay(dest[0]).length === antes && !T.muscListForDay(s.d).length, `mover leva a musculação de ${s.d} para ${dest[0]}`);
    const h = T.frItensHistorico();
    ok(h.some(x => /Movido/.test(x.t)) && h.some(x => /Plano criado/.test(x.t)), 'histórico de mudanças junta registros reais (plano criado + movido)');
  } else ok(true, 'sem destino livre neste perfil (sem mudança)');

  // tela Treino: carrega sem quebrar e mostra a estrutura em etapas
  const html = T.renderTreinoV2Content();
  ok(/fr-trhead/.test(html) && /Semana \d+ de \d+/.test(html) && /frGerenciar/.test(html), 'cabeçalho com fase, semana e menu');
  S.treinos = null;
  ok(/Carregando seus treinos/.test(T.renderTreinoV2Content()), 'treinos ainda carregando: estado de carregamento em vez de erro');
  ok(T.frEtapaInfo({ desc: '10 min em Z1 · trote leve' }).min === '10 min', 'etapa: minutos lidos da descrição');

  semErro();
  process.exit(process.exitCode || 0);
})();
