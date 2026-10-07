// Bloco 5: carga normalizada de cada sessão (SessionLoad), estado de progressão por exercício com reasonCode
// (mesmo resultado da sugestão de carga) e histórico das zonas de ritmo. Nenhuma regra de prescrição muda.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'sessoesPlanejadasDaSemana', 'cargaDaSessao', 'decisaoDeProgressao',
    'suggestedForExercise', 'startWorkoutSession', 'muscListForDay', 'registrarZona', 'DAY_ABBR', 'BACKUP_KEYS'], { espera: 900 });
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); S.zonasHistorico = []; await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();

  // SessionLoad
  const cargas = T.sessoesPlanejadasDaSemana().map(T.cargaDaSessao);
  conferir('bloco5-carga-das-sessoes', cargas);
  ok(cargas.length > 0 && cargas.every(c => ['low', 'medium', 'high'].includes(c.lowerBodyStress) && ['low', 'medium', 'high'].includes(c.systemicStress)), 'toda sessão planejada tem carga normalizada');
  const inter = cargas.find(c => c.papel === 'RUN_INTERVALS_VO2MAX');
  ok(inter && inter.hardSession && inter.lowerBodyStress === 'high' && inter.recoveryHoursMin === 24, 'intervalado = sessão forte, perna alta, 24 h de recuperação (regra vigente)');
  const leve = cargas.find(c => c.papel === 'RUN_EASY_Z2');
  ok(leve && !leve.hardSession && leve.lowerBodyStress === 'low', 'rodagem leve = sessão leve');

  // ProgressionDecision
  const ex = { nome: 'Supino reto com barra', grupo: 'Peito', series: '3', reps: '10', carga: '40', repdbId: '0025' };
  const casos = { sem: null, subir: [{ peso: 40, reps: 10, pse: 7 }], reduzir: [{ peso: 40, reps: 10, pse: 9.5 }], manter: [{ peso: 40, reps: 9 }] };
  const acoes = {};
  for (const [k, sets] of Object.entries(casos)) {
    S.historicoCarga = sets ? { '0025': [{ data: '2026-10-01', sets }] } : {};
    const d = T.decisaoDeProgressao(ex), sug = T.suggestedForExercise(ex);
    ok(d.suggestedLoad === (parseFloat(sug.peso) || 0) && d.reasonCode === sug.reasonCode, `decisão "${k}" igual à sugestão de carga (${d.suggestedLoad} kg, ${d.reasonCode})`);
    acoes[k] = d.action;
  }
  ok(acoes.sem === 'introduce' && acoes.subir === 'increase' && acoes.reduzir === 'reduce' && acoes.manter === 'maintain', 'ações: introduce, increase, reduce, maintain (' + JSON.stringify(acoes) + ')');
  // ao começar o treino, a decisão de cada exercício fica salva
  const dia = T.DAY_ABBR.find(d => T.muscListForDay(d).length);
  S.progressaoExercicios = {}; S.historicoCarga = {};
  T.startWorkoutSession(dia);
  const lista = S.musculacao[dia];
  ok(lista.every(e => S.progressaoExercicios[e.repdbId || e.nome] && S.progressaoExercicios[e.repdbId || e.nome].data === '2026-10-05'), 'iniciar o treino salva a decisão de progressão de cada exercício (' + lista.length + ')');
  S.workoutSession = null;

  // Zonas
  ok(S.zonasHistorico.length === 1 && S.zonasHistorico[0].vdot > 0 && S.zonasHistorico[0].origem, 'criar o plano registra a zona inicial com origem (' + JSON.stringify(S.zonasHistorico[0]) + ')');
  const pacesAntes = JSON.stringify(S.corridaVdotData.paces);
  T.registrarZona(S.zonasHistorico[0].vdot, S.zonasHistorico[0].origem, 'alta');
  ok(S.zonasHistorico.length === 1, 'mesma zona não duplica o histórico');
  T.registrarZona(48, 'teste', 'alta');
  ok(S.zonasHistorico.length === 2 && S.zonasHistorico[1].origem === 'teste', 'teste de ritmo registra nova zona com origem "teste"');
  ok(JSON.stringify(S.corridaVdotData.paces) === pacesAntes, 'registrar o histórico não muda os ritmos');
  ok(T.BACKUP_KEYS.includes('progressaoExercicios') && T.BACKUP_KEYS.includes('zonasHistorico'), 'progressão e zonas entram no backup e na sincronização');

  semErro();
  process.exit(process.exitCode || 0);
})();
