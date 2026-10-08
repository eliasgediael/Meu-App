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
  semErro();
})();
