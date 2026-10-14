// Descarga da musculação do motor antigo (séries × 0,75, piso 3 na semana 4 de cada bloco): restauração proposta,
// desligada (MOTOR_DESCARGA_MUSC.ativa = false). Teste de regressão: desligada nada muda; ligada só a descarga muda.
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'MOTOR_DESCARGA_MUSC', 'fatorSeriesDaSemana', 'suggestedForExercise']);
  const S = T.state;
  const series = async (n) => {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar(perfil(n)); await T.gerarPrimeiroPlanoV2();
    const out = [];
    for (let k = 1; k <= S.hybridPlanData.plan.length; k++) { const w = T.gerarSemanaV2(k); out.push({ fase: w.phaseLabel, s: Object.values(w.muscPlan).flat().map(e => +e.series) }); }
    return out;
  };
  ok(T.MOTOR_DESCARGA_MUSC.ativa === false, 'restauração desligada por padrão');
  ok(T.fatorSeriesDaSemana({ fase: 'Descarga', muscSeriesFator: 1 }).fator === 1, 'desligada: descarga não muda o fator de séries');
  const desl = {};
  for (const n of ['04', '08', '10']) desl[n] = await series(n);
  ok(desl['04'][3].s.join() === desl['04'][2].s.join(), '04 desligada: semana 4 igual à semana 3 (comportamento atual)');

  T.MOTOR_DESCARGA_MUSC.ativa = true;
  const lig = {};
  for (const n of ['04', '08', '10']) lig[n] = await series(n);
  T.MOTOR_DESCARGA_MUSC.ativa = false;
  const desc = (x) => x.map((w, i) => w.fase === 'Descarga' ? i : -1).filter(i => i >= 0);
  // 04 (avançado, 4 séries depois da calibração): descarga cai para 3; as outras semanas iguais às de antes.
  ok(desc(lig['04']).every(i => lig['04'][i].s.every((v, j) => v === Math.min(desl['04'][i].s[j], Math.max(3, Math.round(desl['04'][i].s[j] * 0.75))))), '04 ligada: descarga com séries × 0,75 e piso 3');
  ok(lig['04'].every((w, i) => w.fase === 'Descarga' || w.s.join() === desl['04'][i].s.join()), '04 ligada: semanas que não são descarga não mudam');
  ok(desc(lig['04']).some(i => lig['04'][i].s.join() !== desl['04'][i].s.join()), '04 ligada: a descarga de fato reduz');
  // 08 (3 séries): piso 3 → nada muda. 10 (força: base 5 → 4).
  ok(lig['08'].every((w, i) => w.s.join() === desl['08'][i].s.join()), '08 ligada: exercícios de 3 séries não mudam (piso 3)');
  ok(desc(lig['10']).every(i => lig['10'][i].s.every((v, j) => desl['10'][i].s[j] < 4 ? v === desl['10'][i].s[j] : v < desl['10'][i].s[j])), '10 ligada: só exercícios com 4+ séries reduzem');
  // Calibração (semanas 1-2 do 04) continua com o fator 0,85 do V2.
  ok(lig['04'].slice(0, 2).every((w, i) => w.s.join() === desl['04'][i].s.join()), 'calibração intacta');
  // Interação com a sugestão de carga: depende só do histórico e da meta de repetições, não das séries nem da fase.
  H.congelarRelogio('2026-10-26T10:00:00-03:00');
  S.historicoCarga = { x: [{ data: '2026-10-19', sets: [{ peso: '40', reps: '8', pse: '7' }, { peso: '40', reps: '8', pse: '7' }, { peso: '40', reps: '8', pse: '7' }] }] };
  const a = T.suggestedForExercise({ repdbId: 'x', nome: 'Supino', reps: '8', series: '4', grupo: 'Peito' });
  const b = T.suggestedForExercise({ repdbId: 'x', nome: 'Supino', reps: '8', series: '3', grupo: 'Peito' });
  ok(a.peso === b.peso && a.direction === 'subir', 'sugestão de carga igual com 4 ou 3 séries (continua subindo na descarga)');
  semErro();
})();
