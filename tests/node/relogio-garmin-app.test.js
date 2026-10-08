// Ponte com o relógio Garmin dentro do app (08/10/2026): com um plugin nativo simulado, o app envia os próximos
// treinos, grava a corrida que chega do relógio como corrida do dia (ou atividade livre), confirma com "ack" e não
// duplica quando o relógio reenvia.
const { carregarApp, espera, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const Contrato = require('../../src/relogio/garmin-contrato.js');

const enviados = [];
let aoReceber = null;
const ponte = {
  isNative: () => true,
  relogio: {
    ...Contrato,
    disponivel: () => true,
    estado: async () => ({ relogios: [{ id: 'x', nome: 'Forerunner 55', status: 'conectado' }] }),
    escolher: async () => ({ abriuGarminConnect: true }),
    enviar: async (m) => { enviados.push(JSON.parse(JSON.stringify(m))); return { enviados: 1, resultados: [] }; },
    ouvir: (cb) => { aoReceber = cb; },
  },
};

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'saveTreinos', 'gpsDbGet',
    'atividadesLivres', 'relogioEnviarTreinos', 'relogioMensagemTreinos', 'todayISO'],
    { antes: () => { globalThis.NativeBridge = ponte; if (globalThis.window) globalThis.window.NativeBridge = ponte; } });
  const S = T.state;
  ok(typeof aoReceber === 'function', 'app começa a ouvir o relógio ao abrir');

  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar({ ...BASE, ...PERFIS.find(p => p[0].startsWith('07'))[1] }); await T.gerarPrimeiroPlanoV2();
  await T.saveTreinos();
  enviados.length = 0;
  const r1 = await T.relogioEnviarTreinos({ forcar: true });
  const lista = enviados[0];
  ok(r1 && r1.enviados === 1 && lista && lista.t === 'w' && lista.w.length > 0, 'envia os treinos do plano (' + (lista ? lista.w.length : 0) + ')');
  const corridas = lista.w.filter(w => !w.y), forca = lista.w.filter(w => w.y === 'f');
  ok(lista.v === 2 && corridas.length > 0, 'mensagem v2 com os treinos de corrida');
  ok(corridas.every(w => !!S.treinos.find(t => t.day === w.id)), 'cada treino de corrida enviado existe no plano');
  ok(forca.length > 0 && forca.every(f => /^musc_/.test(f.id) && (S.musculacao[f.id.slice(5)] || []).length === f.e.length),
    'musculação dos próximos dias enviada com os exercícios do app (' + forca.length + ')');

  // Corrida do relógio para o primeiro treino da lista.
  const alvo = corridas[0];
  const resultado = { schemaVersion: 2, resultId: alvo.id + '_1791200000', workoutId: alvo.id, sessionKey: alvo.k, source: 'garmin',
    startedAt: 1791200000, distanceMeters: 6123, durationSec: 2100, avgHeartRate: 148,
    steps: [{ name: 'Aquecimento', durationSec: 600, distanceMeters: 1700 }] };
  enviados.length = 0;
  aoReceber({ dados: { t: 'r', r: resultado }, relogio: 'Forerunner 55' });
  await espera(400);
  const p = S.corridaProgress[alvo.id];
  ok(p && p.done && p.km === '6.123' && p.origem === 'garmin' && p.gpsRunId === 'run_garmin_' + alvo.id.replace(/[^A-Za-z0-9_-]/g, '_') + '_1791200000',
    'treino do dia marcado como feito com a corrida do relógio');
  const rec = await T.gpsDbGet(p.gpsRunId);
  ok(rec && rec.distancia_total_km === 6.123 && rec.tempo_total_seg === 2100 && rec.origem === 'garmin' && rec.etapas_executadas.length === 1,
    'gravação da corrida criada (vai para a nuvem pela sincronização normal)');
  const ack = enviados.find(m => m.t === 'ack');
  ok(ack && ack.ids[0] === resultado.resultId, 'confirma ao relógio depois de gravar');
  await espera(3500);
  const novaLista = enviados.filter(m => m.t === 'w').pop();
  ok(novaLista && !novaLista.w.some(w => w.id === alvo.id), 'lista reenviada sem o treino que foi feito');

  // Musculação feita no relógio (primeiro dia de força da lista).
  const fz = forca[0], diaF = fz.id.slice(5);
  const exF = fz.e[0];
  const rf = { schemaVersion: 2, kind: 'strength', resultId: fz.id + '_1791250000', workoutId: fz.id, sessionKey: fz.k, source: 'garmin',
    startedAt: Math.floor(Date.now() / 1000) - 3000, durationSec: 2555, avgHeartRate: 126, sets: 2,
    exercises: [{ id: exF[0], name: exF[1], sets: [{ id: exF[0] + '#1', reps: 10, kg: 42.5 }, { id: exF[0] + '#2', reps: 8, kg: 42.5 }] }] };
  const logsAntes = S.workoutSessionsLog.length;
  enviados.length = 0;
  aoReceber({ dados: { t: 'r', r: rf } });
  await espera(400);
  const log = S.workoutSessionsLog.find(l => l.id === 'musc_garmin_' + rf.resultId.replace(/[^A-Za-z0-9_-]/g, '_'));
  ok(log && log.type === 'strength' && log.origem === 'garmin' && log.series === 2 && log.duracaoSeg === 2555 && log.volume === 765,
    'musculação do relógio entra no histórico de sessões');
  const exApp = S.musculacao[diaF].find(x => x.id === exF[0]);
  ok(log && log.exercicios[0].nome === exApp.nome && log.exercicios[0].seriesExecutadas.length === 2 && log.exercicios[0].seriesExecutadas[1].repeticoes === 8,
    'séries realmente feitas (repetições e carga) gravadas');
  const hist = (S.historicoCarga[exApp.repdbId || exApp.nome] || []).find(h => h.data === log.data);
  ok(hist && hist.sets.length === 2 && hist.sets[0].peso === '42.5', 'histórico de carga do exercício atualizado');
  ok(enviados.some(m => m.t === 'ack' && m.ids[0] === rf.resultId), 'confirma a musculação ao relógio');
  aoReceber({ dados: { t: 'r', r: rf } });
  await espera(400);
  ok(S.workoutSessionsLog.length === logsAntes + 1, 'musculação repetida não duplica');

  // Reenvio do mesmo resultado (o relógio não recebeu o ack): não duplica, confirma de novo.
  const antes = T.atividadesLivres().length;
  enviados.length = 0;
  aoReceber({ dados: { t: 'r', r: resultado } });
  await espera(400);
  ok(T.atividadesLivres().length === antes && enviados.some(m => m.t === 'ack'), 'resultado repetido não duplica e é confirmado');

  // Corrida livre do relógio vira atividade livre.
  aoReceber({ dados: { t: 'r', r: { ...resultado, resultId: 'free_1791300000', workoutId: 'free', startedAt: 1791300000 } } });
  await espera(400);
  ok(T.atividadesLivres().some(a => a.id === 'run:run_garmin_free_1791300000' && a.origem === 'garmin' && a.distKm === 6.123),
    'corrida livre do relógio vira atividade livre');

  // Personal vendo a conta de uma aluna: não grava nem confirma.
  S.viewingClient = { uid: 'aluna', name: 'A' };
  enviados.length = 0;
  aoReceber({ dados: { t: 'r', r: { ...resultado, resultId: 'free_1791400000', workoutId: 'free' } } });
  await espera(400);
  ok(!enviados.length && !T.atividadesLivres().some(a => a.id === 'run:run_garmin_free_1791400000'), 'não grava na conta de outra pessoa');
  S.viewingClient = null;
  semErro();
})();
