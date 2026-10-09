// Ponte com o relógio Garmin dentro do app (08/10/2026): com um plugin nativo simulado, o app envia os próximos
// treinos, grava a corrida que chega do relógio como corrida do dia (ou atividade livre), confirma com "ack" e não
// duplica quando o relógio reenvia.
const { carregarApp, espera, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const Contrato = require('../../src/relogio/garmin-contrato.js');

const enviados = [];
let escolhas = 0;
let aoReceber = null;
const ponte = {
  isNative: () => true,
  relogio: {
    ...Contrato,
    disponivel: () => true,
    estado: async () => ({ relogios: [{ id: 'x', nome: 'Corrida do Elias', modelo: 'Forerunner® 55', status: 'conectado' }] }),
    escolher: async () => { escolhas++; return { abriuGarminConnect: true }; },
    enviar: async (m) => { enviados.push(JSON.parse(JSON.stringify(m))); return { enviados: 1, resultados: [] }; },
    ouvir: (cb) => { aoReceber = cb; },
  },
};

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'saveTreinos', 'gpsDbGet',
    'atividadesLivres', 'relogioEnviarTreinos', 'relogioMensagemTreinos', 'todayISO', 'renderIntegracoesV2', 'relogioEnviarRota'],
    { antes: () => { globalThis.NativeBridge = ponte; if (globalThis.window) globalThis.window.NativeBridge = ponte; } });
  const S = T.state;
  ok(typeof aoReceber === 'function', 'app começa a ouvir o relógio ao abrir');
  ok(S.equipamentos.relogio === 'Garmin Forerunner 55', 'campo Relógio de Equipamentos preenchido com o relógio conectado (' + S.equipamentos.relogio + ')');

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
  ok(forca.every(f => f.e.every(x => !x[3] || /^\d{4}$/.test(x[3]))) && forca.some(f => f.e.some(x => x[3])),
    'exercícios levam o id da imagem do app (gifs/<id>.webp)');

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
    // Formato atual do relógio: séries compactas [reps, kg, reps planejadas, kg planejados].
    exercises: [{ id: exF[0], name: exF[1], sets: [[10, 42.5, exF[2][0][0], exF[2][0][1]], [8, 42.5, exF[2][1][0], exF[2][1][1]]] }] };
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
  ok(log && log.exercicios[0].seriesExecutadas[0].repeticoesPlanejadas === exF[2][0][0], 'planejado gravado separado do realizado');
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

  // "Sincronizar agora" no relógio pede a lista: o app reenvia na hora.
  enviados.length = 0;
  aoReceber({ dados: { t: 'pedir' } });
  await espera(400);
  ok(enviados.some(m => m.t === 'w'), 'pedido do relógio reenvia a lista de treinos');

  // Percurso de uma corrida gravada vai como rota compacta.
  enviados.length = 0;
  const pts = []; for (let i = 0; i < 300; i++) pts.push({ lat: -23.55 + i * 0.0001, lng: -46.63 + Math.sin(i / 20) * 0.0005, timestamp: 1791200000000 + i * 1000 });
  await T.relogioEnviarRota({ runId: 'run_x', points: pts });
  const rota = enviados.find(m => m.t === 'route');
  ok(rota && rota.id === 'run_x' && rota.p.length >= 4 && rota.n.startsWith('Percurso'), 'corrida gravada enviada como percurso');

  // Tela Integrações: o cartão Garmin é a ponte real (não mais "ainda não existe no app").
  const integ = T.renderIntegracoesV2();
  ok(integ.includes('btnRelogioEscolher') && !integ.includes('data-mrtintegrar="Garmin"') && integ.includes('data-mrtintegrar="Strava"'),
    'Integrações mostra o Garmin real (Strava continua por fazer)');

  // Personal vendo a conta de uma aluna: não grava nem confirma.
  S.viewingClient = { uid: 'aluna', name: 'A' };
  enviados.length = 0;
  aoReceber({ dados: { t: 'r', r: { ...resultado, resultId: 'free_1791400000', workoutId: 'free' } } });
  await espera(400);
  ok(!enviados.length && !T.atividadesLivres().some(a => a.id === 'run:run_garmin_free_1791400000'), 'não grava na conta de outra pessoa');
  S.viewingClient = null;
  semErro();
})();
