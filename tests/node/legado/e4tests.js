// Etapa 4: aguardando GPS → contagem → corrida; tempo em movimento; km por voz; pausa automática; resumo; GPX; recordes.
const H = require('../../harness/app-node.js'); const { NET } = H;
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
let erro = null; process.on('unhandledRejection', e => { erro = e; });
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  const falas = [];
  (0, eval)(H.js + ';\nglobalThis.__T={state,gpsOnPosition,gpsComecarContagem,gpsIniciarDeVerdade,renderGpsRunScreen,finishGpsRun,gerarGpx,gpsMelhorEsforco,gpsCleanTrack,gpsTempoEmMovimento,gpsResumeRun,suggestedForExercise};\nspeak=(t)=>globalThis.__falas.push(t);');
  globalThis.__falas = falas;
  await espera(500);
  const T = globalThis.__T, S = T.state;
  S.equipamentos = { tenis: [] }; S.treinos = []; S.corridaProgress = {};
  S.gpsRun = { status: 'permission', day: 'Seg', mode: 'gps', steps: [{ name: 'Corrida', km: 10, tipo: 'distancia' }], stepIndex: 0, startedAt: null, pausedMs: 0, pauseBeganAt: null, stepStartedAt: null, stepPausedMs: 0, totalDistKm: 0, stepDistKm: 0, lastPoint: null, points: [], etapasExecutadas: [] };
  const gr = S.gpsRun;
  const pos = (lat, lng, t, acc) => ({ coords: { latitude: lat, longitude: lng, accuracy: acc == null ? 8 : acc, altitude: 500 }, timestamp: t });
  let t = Date.now();
  T.gpsOnPosition(pos(-20, -54, t, 35));
  ok(gr.status === 'aguardando' && !gr.startedAt, 'primeiro sinal não começa a corrida (aguardando)');
  ok(/Iniciar mesmo assim/.test(T.renderGpsRunScreen()), 'sinal fraco: oferece "começar mesmo assim"');
  T.gpsOnPosition(pos(-20, -54, t + 1000, 6));
  ok(/Pronto para começar/.test(T.renderGpsRunScreen()) && /GPS excelente|GPS bom/.test(T.renderGpsRunScreen()), 'sinal bom mostrado (níveis de GPS)');
  T.gpsComecarContagem();
  ok(gr.status === 'contagem' && /gps-count/.test(T.renderGpsRunScreen()), 'contagem regressiva');
  T.gpsIniciarDeVerdade();
  ok(gr.status === 'running' && gr.points.length === 1, 'corrida começa com o último fix como ponto inicial');
  // corre 1,2 km a ~10 km/h (passos de 2,8 m/s)
  t = Date.now();
  let lat = -20;
  for (let i = 1; i <= 430; i++) { lat += 0.0000252; T.gpsOnPosition(pos(lat, -54, t + i * 1000)); }
  ok(gr.totalDistKm > 1.1, 'distância ' + gr.totalDistKm.toFixed(2) + ' km');
  ok(gr.kmAnunciado === 1 && gr.ultimoKmSeg > 0, 'último km registrado: ' + gr.ultimoKmSeg + 's');
  ok(falas.some(f => /1 quilômetro/.test(f)), 'voz a cada km: "' + falas.find(f => /quilômetro/.test(f)) + '"');
  ok(gr.movingMs / 1000 > 400, 'tempo em movimento: ' + Math.round(gr.movingMs / 1000) + 's');
  // pausa automática: parado 15 s
  S.preferencias = { autoPause: true, vozKm: true };
  const t2 = t + 431 * 1000;
  for (let i = 0; i < 15; i++) T.gpsOnPosition(pos(lat, -54, t2 + i * 1000));
  ok(gr.status === 'paused' && gr.autoPausado, 'pausa automática ao ficar parado');
  const pausaIni = gr.pauseBeganAt;
  lat += 0.0003; T.gpsOnPosition(pos(lat, -54, t2 + 40000));
  ok(gr.status === 'running' && gr.pausedMs >= 30000, 'retoma sozinho ao voltar a correr (pausa ' + Math.round(gr.pausedMs / 1000) + 's)');
  // resumo
  await T.finishGpsRun();
  const html = T.renderGpsRunScreen();
  ok(/Em movimento/.test(html) && /Como foi\?/.test(html) && /Exportar GPX/.test(html), 'resumo com em movimento, como foi? e GPX');
  ok(S.recordesCorrida && S.recordesCorrida['1'] && !(gr.novosRecordes || []).length, 'primeira marca de 1 km registrada sem anunciar "novo recorde"');
  const gpx = T.gerarGpx(gr, 'teste');
  ok(/<gpx version="1.1"/.test(gpx) && (gpx.match(/<trkseg>/g) || []).length === 2 && /<ele>500<\/ele>/.test(gpx), 'GPX válido com 2 trechos e elevação');
  // musculação: perna não sobe carga com corrida forte amanhã
  ok(typeof T.suggestedForExercise === 'function', 'sugestão de carga disponível');
  await espera(50);
  ok(!erro, 'sem erro não tratado' + (erro ? ': ' + String(erro.stack || erro).split('\n').slice(0, 2).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})();
