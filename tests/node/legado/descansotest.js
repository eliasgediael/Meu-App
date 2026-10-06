// Fim do descanso: som no momento exato, uma vez só, e notificação quando a tela bloqueia.
const H = require('../../harness/app-node.js'); const { NET } = H; const fs = require('fs');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
let erro = null; process.on('unhandledRejection', e => { erro = e; });
global.fetch = async (u) => /exercicios\.json/.test(u) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(H.ROOT + '/data/exercicios.json', 'utf8')) } : { ok: false, json: async () => ({}) };
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  (0, eval)(H.js + ';\nglobalThis.__T={state,addExercicio,startWorkoutSession,concluirSerieAction,addRestTime,skipRest};');
  await espera(600);
  const T = globalThis.__T, S = T.state;
  const sons = []; globalThis.playRestEndSound = () => sons.push(Date.now());
  const notifs = []; let cancel = 0;
  globalThis.NativeBridge = { isNative: () => true, permissaoAvisos: async () => true, agendarAvisoDescanso: async (t) => { notifs.push(t); return true; }, cancelarAvisoDescanso: () => { cancel++; } };
  const vis = (v) => { document.visibilityState = v; (H.listeners['doc:visibilitychange'] || []).forEach(f => f()); };
  S.musculacao = {}; T.addExercicio('Seg', { nome: 'Supino reto', grupo: 'Peito', series: '6', reps: '10', carga: '30', descanso: '2s' });
  T.startWorkoutSession('Seg');
  const ws = () => S.workoutSession;
  // 1) app aberto: toca no momento exato
  T.concluirSerieAction(30, 10, null);
  const fimEsperado = ws().restEndAt;
  ok(ws().phase === 'rest', 'série concluída entra no descanso configurado (' + ws().restTotalSec + 's)');
  await espera(2600);
  ok(sons.length === 1, 'som tocou uma vez no fim do descanso (' + sons.length + ')');
  ok(sons.length && Math.abs(sons[0] - fimEsperado) < 150, 'som no momento exato (diferença ' + (sons[0] - fimEsperado) + ' ms)');
  ok(ws().phase === 'exercise' && ws().serieIdx === 1, 'avançou para a série 2');
  await espera(1200);
  ok(sons.length === 1, 'não repete o som');
  // 2) +15 s reagenda
  T.concluirSerieAction(30, 10, null);
  T.addRestTime(1);
  const fim2 = ws().restEndAt;
  await espera(2300);
  ok(sons.length === 1, 'com +tempo, não toca no horário antigo');
  await espera(1000);
  ok(sons.length === 2 && Math.abs(sons[1] - fim2) < 150, 'toca no novo horário (diferença ' + (sons[1] - fim2) + ' ms)');
  // 3) tela bloqueada: agenda notificação; ao voltar atrasado, avança sem tocar de novo
  T.concluirSerieAction(30, 10, null);
  const fim3 = ws().restEndAt;
  vis('hidden');
  await espera(20);
  ok(notifs.length === 1 && notifs[0] === fim3, 'ao bloquear, agenda a notificação para o fim exato do descanso');
  await espera(2400); // JS ainda vivo escondido: não pode tocar junto com a notificação
  ok(sons.length === 2, 'escondido: o app não toca por cima da notificação');
  vis('visible');
  ok(cancel >= 1, 'ao voltar, cancela a notificação');
  ok(ws().phase === 'exercise', 'ao voltar, já está na próxima série');
  // 4) bloqueia e volta antes do fim: cancela e o app toca normalmente
  T.concluirSerieAction(30, 10, null);
  const fim4 = ws().restEndAt;
  vis('hidden'); await espera(300); vis('visible');
  await espera(2200);
  ok(sons.length === 3 && Math.abs(sons[2] - fim4) < 150, 'voltou antes do fim: app toca no horário (diferença ' + (sons[2] - fim4) + ' ms)');
  // 5) pular descanso não toca
  T.concluirSerieAction(30, 10, null);
  if (ws() && ws().phase === 'rest') { T.skipRest(); await espera(2300); ok(sons.length === 3, 'pular descanso não toca som'); }
  await espera(30);
  ok(!erro, 'sem erro não tratado' + (erro ? ': ' + String(erro.stack || erro).split('\n').slice(0, 2).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})();
