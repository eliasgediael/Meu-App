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
  ok(lista.w.every(w => !!S.treinos.find(t => t.day === w.id)), 'cada treino enviado existe no plano');

  // Corrida do relógio para o primeiro treino da lista.
  const alvo = lista.w[0];
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
