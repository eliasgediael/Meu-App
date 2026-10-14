// Ponte com o relógio Garmin (08/10/2026): os treinos reais gerados pelo motor viram o formato compacto do
// relógio (docs/CONTRATO-SYNC.md do projeto Connect IQ) e o resultado do relógio vira registro de corrida.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const C = require('../../src/relogio/garmin-contrato.js');

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'todayISO']);
  const S = T.state;
  const TIPOS = new Set(['w', 'i', 'r', 's', 'c']), MEDIDAS = new Set(['d', 't', 'o']);
  let total = 0, comTiro = 0;
  for (const [nome, extra] of PERFIS) {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar({ ...BASE, ...extra }); await T.gerarPrimeiroPlanoV2();
    const lista = C.treinosParaRelogio(S.treinos, { hojeISO: T.todayISO(), feito: () => false });
    ok(lista.length <= C.MAX_TREINOS, nome + ': no máximo 8 treinos');
    for (const w of lista) {
      total++;
      ok(typeof w.id === 'string' && /\d{2}\/\d{2}/.test(w.id) && w.k === w.id, nome + ': id é o dia do treino (' + w.id + ')');
      ok(w.s.length > 0 && w.s.length <= C.MAX_ETAPAS, nome + ': quantidade de etapas válida');
      for (const e of w.s) {
        ok(TIPOS.has(e[0]) && MEDIDAS.has(e[1]), nome + ': etapa com tipo/medida válidos ' + JSON.stringify(e));
        if (e[1] !== 'o') ok(Number.isInteger(e[2]) && e[2] > 0, nome + ': medida positiva ' + JSON.stringify(e));
        if (e[3] != null) ok(e[3] <= e[4] && e[3] > 120 && e[4] < 1200, nome + ': faixa de ritmo em s/km ' + JSON.stringify(e));
      }
      const tiros = w.s.filter(e => e[0] === 'i').length;
      if (/Intervalado/.test(w.n)) {
        comTiro++;
        ok(tiros >= 2, nome + ': intervalado tem tiros (' + tiros + ')');
        ok(w.s.filter(e => e[0] === 'r').length === tiros - 1, nome + ': recuperação entre os tiros');
        ok(w.s[0][0] === 'w' && w.s[w.s.length - 1][0] === 'c', nome + ': aquecimento no início e desaquecimento no fim');
      }
    }
    ok(JSON.stringify(C.mensagemTreinos(lista)).length < 16000, nome + ': mensagem cabe no relógio');
  }
  ok(total > 0 && comTiro > 0, 'perfis geraram treinos para o relógio (' + total + ', ' + comTiro + ' intervalados)');

  // Treino já feito ou com "descansar hoje" não vai.
  const hoje = T.todayISO(), d = new Date(hoje + 'T00:00:00'); d.setDate(d.getDate() + 1);
  const dia = 'Qui ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  const e = { day: dia, type: 'Rodagem', gpsSteps: [{ name: 'Rodagem', km: 5, pace: '5:30 ~ 6:00/km', tipo: 'distancia' }] };
  ok(C.treinosParaRelogio([e], { hojeISO: hoje }).length === 1, 'treino de amanhã vai');
  ok(C.treinosParaRelogio([{ ...e, descanso: true }], { hojeISO: hoje }).length === 0, 'descansar hoje não vai');
  ok(C.treinosParaRelogio([e], { hojeISO: hoje, feito: () => true }).length === 0, 'treino feito não vai');
  const comFeito = C.treinosParaRelogio([e], { hojeISO: hoje, feito: () => true, incluirFeitos: true });
  ok(comFeito.length === 1 && comFeito[0].ok === 1, 'com incluirFeitos o treino feito vai marcado');
  const pags = C.mensagensTreinos(Array.from({ length: 30 }, (_, i) => ({ id: 'Seg ' + i, k: 'Seg', n: 'Rodagem', s: [['s', 'd', 5000, 300, 330, 'Rodagem leve contínua']] })), [], 600, 'abc');
  ok(pags.length > 1 && pags.every((m, i) => m.pg === i && m.pgs === pags.length && m.b === 'abc' && m.v === 3 && JSON.stringify(m).length <= 600)
    && [].concat(...pags.map(m => m.w)).length === 30, 'lista grande vai em páginas sem perder treino (' + pags.length + ' páginas)');
  ok(JSON.stringify(C.treinoCompacto(e).s[0]) === JSON.stringify(['s', 'd', 5000, 330, 360, 'Rodagem']), 'contínuo leva nome e faixa');

  // Virada de ano: 02/01 visto em 30/12 é do ano seguinte.
  ok(C.dataDoDia('Sex 02/01', '2026-12-30').getFullYear() === 2027, 'virada de ano');

  // Resultado do relógio.
  const r = C.registroDoResultado({ resultId: 'Qui 09/10_1760000000', workoutId: 'Qui 09/10', startedAt: 1760000000,
    distanceMeters: 5432, durationSec: 1840, avgHeartRate: 151.6, steps: [{ name: 'Tiro', durationSec: 100, distanceMeters: 400 }] });
  ok(r && r.runId === 'run_garmin_Qui_09_10_1760000000' && r.km === 5.432 && r.seg === 1840 && r.fcMedia === 152, 'resultado vira registro');
  ok(r.day === 'Qui 09/10' && !r.livre && r.inicio === 1760000000000 && r.fim === r.inicio + 1840000, 'dia e horários do resultado');
  ok(Math.abs(r.etapas[0].pace_medio_real - 4.1667) < 0.001, 'pace da etapa em min/km como no app');
  ok(C.registroDoResultado({ resultId: 'x', workoutId: 'free', durationSec: 60, distanceMeters: 0 }).livre, 'corrida livre');
  ok(C.registroDoResultado({ resultId: 'x', workoutId: 'free', durationSec: 0 }) === null, 'resultado sem tempo é ignorado');
  ok(C.registroDoResultado(null) === null && C.registroDoResultado({}) === null, 'resultado inválido é ignorado');
  // Musculação.
  const fc = C.forcaCompacta({ day: 'Seg', k: 'Seg 05/10', n: 'Peito + Tríceps', exercicios: [
    { id: 'd1', nome: 'Supino reto com barra', series: '4', reps: '10', carga: '40', descanso: '60–90s', img: '0025' },
    { id: 'd2', nome: 'Tríceps coice no cabo', series: '3', reps: '8-12', carga: '', descanso: '' }] });
  ok(fc.y === 'f' && fc.id === 'musc_Seg' && fc.e.length === 2, 'musculação compacta com tipo e id estável do dia');
  ok(JSON.stringify(fc.e[0][2][0]) === JSON.stringify([10, 40, 75]) && fc.e[0][2].length === 4 && fc.e[0][0] === 'd1', 'série: repetições, carga e descanso; exercício com id do app');
  ok(JSON.stringify(fc.e[1][2][2]) === JSON.stringify([8, 0, 90]), 'faixa de reps usa o início; sem carga = 0; descanso padrão 90 s');
  ok(fc.e[0][3] === '0025' && fc.e[1].length === 3, 'imagem do exercício vai como 4º item, só quando existe');
  const longo = C.forcaCompacta({ day: 'Qua', exercicios: [{ id: 'x', nome: 'Elevação lateral unilateral com halteres no banco', series: '3', reps: '12' }] });
  ok(longo.e[0][1] === 'Elevação lateral unilateral com halteres no banco', 'nome do exercício inteiro (até 60 letras; o maior do catálogo tem 52)');
  ok(C.forcaCompacta({ day: 'Ter', exercicios: [] }) === null, 'dia sem exercício não vai');
  // Limite de tamanho: nunca passa de MAX_BYTES e mantém os mais próximos, alternando corrida e força.
  const runs = Array.from({ length: 8 }, (_, i) => ({ id: 'r' + i, s: Array.from({ length: 15 }, () => ['i', 'd', 400, 250, 270]) }));
  const forcas = Array.from({ length: 7 }, (_, i) => ({ y: 'f', id: 'musc_' + i, e: fc.e }));
  const grande = C.mensagemTreinos(runs, forcas);
  ok(JSON.stringify(grande).length <= C.MAX_BYTES, 'mensagem limitada a ' + C.MAX_BYTES + ' bytes (' + JSON.stringify(grande).length + ')');
  ok(grande.w[0].id === 'r0' && grande.w[1].id === 'musc_0' && grande.w.length < 15, 'mantém os mais próximos, alternando corrida e musculação (' + grande.w.length + ' itens)');
  const m2 = C.mensagemTreinos([{ id: 'x' }], [fc]);
  ok(m2.v === 2 && m2.w.length === 2 && C.mensagemTreinos([{ id: 'x' }]).v === undefined, 'mensagem v2 só quando há musculação');
  const rf = C.registroForcaDoResultado({ kind: 'strength', resultId: 'musc_Seg_1791250000', workoutId: 'musc_Seg', startedAt: 1791250000,
    durationSec: 2555, avgHeartRate: 126.4, exercises: [{ id: 'd1', name: 'Supino', sets: [{ id: 'd1#1', reps: 10, kg: 42.5, plannedReps: 12, plannedKg: 40 }] }, { id: 'd2', name: 'X', sets: [] }] });
  ok(rf && rf.logId === 'musc_garmin_musc_Seg_1791250000' && rf.day === 'Seg' && rf.series === 1 && rf.exercicios.length === 1 && rf.fcMedia === 126,
    'resultado de musculação vira sessão do app');
  ok(rf.exercicios[0].sets[0].peso === 42.5 && rf.exercicios[0].sets[0].pesoPlanejado === 40 && rf.exercicios[0].sets[0].repsPlanejadas === 12,
    'realizado e planejado chegam separados');
  const ra = C.registroForcaDoResultado({ kind: 'strength', resultId: 'r2', workoutId: 'musc_Seg', durationSec: 60,
    exercises: [{ id: 'd1', name: 'Supino', sets: [[10, 42.5, 12, 40], [8, 42.5, 12, 40]] }] });
  ok(ra && ra.series === 2 && ra.exercicios[0].sets[1].id === 'd1#2' && ra.exercicios[0].sets[1].reps === 8 && ra.exercicios[0].sets[0].pesoPlanejado === 40,
    'séries compactas do relógio ([reps, kg, reps plan., kg plan.]) aceitas');
  ok(C.registroDoResultado({ kind: 'strength', resultId: 'a', workoutId: 'musc_Seg', durationSec: 10 }) === null, 'resultado de força não vira corrida');
  ok(C.registroForcaDoResultado({ kind: 'strength', resultId: 'a', workoutId: 'musc_Seg', exercises: [] }) === null, 'musculação sem série é ignorada');
  // Percurso: corrida gravada -> rota compacta (origem, metros, simplificada, sem curvas inventadas).
  const trilha = [];
  for (let i = 0; i < 2000; i++) trilha.push([-23.55 + i * 0.00002 + Math.sin(i / 30) * 0.0002, -46.63 + i * 0.00003]);
  const rota = C.rotaCompacta(trilha, { id: 'run_1', nome: 'Percurso 05/10' });
  ok(rota && rota.t === 'route' && rota.p.length % 2 === 0 && rota.p.length / 2 <= C.MAX_PONTOS_ROTA && rota.p.length / 2 >= 10,
    'rota simplificada a no máximo ' + C.MAX_PONTOS_ROTA + ' pontos (' + (rota ? rota.p.length / 2 : 0) + ')');
  ok(rota && JSON.stringify(rota).length <= C.MAX_BYTES_ROTA && rota.p.every(Number.isInteger), 'rota cabe em ' + C.MAX_BYTES_ROTA + ' bytes, metros inteiros');
  ok(rota && rota.p[0] === 0 && rota.p[1] === 0 && rota.o[0] === -23.55, 'origem no 1º ponto real');
  ok(rota && rota.instrucoes === undefined && !('curvas' in rota), 'sem instruções de curva');
  ok(C.rotaCompacta([[-23.55, -46.63]]) === null && C.rotaCompacta([[-23.55, -46.63], [-23.55, -46.63]]) === null, 'trilha curta não vira rota');
  ok(JSON.stringify(C.mensagemRemoverRota()) === '{"t":"route","clear":true}', 'mensagem para remover a rota');
  semErro();
})();
