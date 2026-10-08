// Esteira: distância acumula por trechos (trocar a velocidade não reescreve o passado); velocidade sugerida
// separada da informada. Musculação: aviso do descanso só com bipe (sem voz), a voz da corrida continua.
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const em = (hhmm) => H.congelarRelogio('2026-10-05T' + hhmm + ':00-03:00');

(async () => {
  const T = await carregarApp(['state', 'esteiraUpdateDistance', 'esteiraDefinirKmh', 'esteiraNovaEtapa', 'avisarFimDescanso', 'prefsAviso']);
  const S = T.state;
  em('10:00');
  const gr = { mode: 'esteira', status: 'running', stepStartedAt: Date.now(), stepPausedMs: 0, pauseBeganAt: null, etapasExecutadas: [], steps: [{ name: 'Livre' }], stepIndex: 0 };
  S.gpsRun = gr; T.esteiraNovaEtapa(gr, 10, true);
  em('10:10'); T.esteiraUpdateDistance();
  const aos10 = gr.stepDistKm;
  T.esteiraDefinirKmh(12); T.esteiraUpdateDistance();
  ok(Math.abs(aos10 - 1.667) < 0.002 && gr.stepDistKm === aos10, `trocar a velocidade não reescreve a distância já feita (${aos10} → ${gr.stepDistKm})`);
  em('10:15'); T.esteiraUpdateDistance();
  ok(Math.abs(gr.stepDistKm - 2.667) < 0.002, `distância acumula por trechos (10 min a 10 + 5 min a 12 = ${gr.stepDistKm} km)`);
  ok(gr.stepKmhSugerida === 10 && gr.stepKmh === 12, 'sugerida (10) separada da informada (12)');

  // musculação sem voz
  let falou = 0; globalThis.speak = () => { falou++; };
  S.preferencias = { aviso: { modo: 'bipevoz', volume: 0.8 } };
  ok(T.prefsAviso().modo === 'bipe', 'modo antigo "bipe + voz" passa a ser só bipe');
  T.avisarFimDescanso('Descanso encerrado. Próxima: série 2 de 4, Supino.');
  await new Promise(r => setTimeout(r, 900));
  ok(falou === 0, 'fim do descanso não fala (só bipe)');
  semErro();
  process.exit(process.exitCode || 0);
})();
