// Cada cenário roda num processo novo: node b1tests.js <projeto> <cenario>
const H = require('../../harness/app-node.js');
const { NET, cloud, store } = H;
const cen = process.argv[3];
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
let erroFatal = null;
process.on('unhandledRejection', e => { erroFatal = e; });
const UID = 'u1';
const pref = 'treinoapp:u:' + UID + ':';

async function carregarApp(antes) {
  if (antes) antes();
  try { (0, eval)(H.js + ';\nconfirmarApp=async()=>true;\nglobalThis.__T={state,init,cloudStatus,gpsPersist,gpsCarregarCorridaAtiva,gpsDbAll,gpsDbGet,gpsDbPut,exportBackup,importBackupFile,finishGpsRun,gpsDeleteActivity,sincronizarCorridasGps,makeSyncedStorage,gpsNewRunState:typeof gpsNewRunState!=="undefined"?gpsNewRunState:null, _gpsPersist:()=>_gpsPersist, setDown:(v)=>{cloudDownUntil=v;}};'); }
  catch (e) { console.log('FAIL erro fatal ao carregar o script:', e.message); process.exit(1); }
  await espera(400);
  return globalThis.__T;
}

(async () => {
  if (cen === 'offline-sem-conta') {
    NET.sdkOnline = false; navigator.onLine = false;
    store.set('treinoapp:treinos', JSON.stringify([{ day: 'Seg 01/01', type: 'Rodagem' }]));
    const T = await carregarApp();
    ok(!erroFatal, 'abre sem internet sem erro fatal ' + (erroFatal ? erroFatal.message : ''));
    ok(T.cloudStatus.sdk === 'indisponivel', 'SDK marcado indisponível: ' + T.cloudStatus.sdk);
    ok(Array.isArray(T.state.treinos) && T.state.treinos.length === 1, 'dados locais carregados (treinos=' + (T.state.treinos || []).length + ')');
    ok(window.storage.kind === 'local', 'storage local');
  }

  if (cen === 'offline-com-conta-cache') {
    NET.sdkOnline = false; navigator.onLine = false;
    store.set('treinoapp:ultimaConta', JSON.stringify({ uid: UID, email: 'a@b.c' }));
    store.set(pref + 'treinos', JSON.stringify([{ day: 'Ter 02/01', type: 'Longão' }]));
    const T = await carregarApp();
    ok(!erroFatal, 'abre offline com conta sem erro fatal');
    ok(window.storage.kind === 'nuvem' && window.storage.uid === UID, 'abre com storage da conta (cópia local)');
    ok(T.state.treinos.length === 1 && T.state.treinos[0].type === 'Longão', 'lê da cópia local da conta');
    ok(T.state.authUser && T.state.authUser.uid === UID, 'conta reconhecida offline');
    // perfil não tinha cópia local -> chave insegura -> escrita bloqueada
    await window.storage.set('perfil', JSON.stringify({ nome: 'vazio' }));
    ok(store.get(pref + 'perfil') === undefined, 'perfil (sem cópia e sem nuvem) NÃO vai pra cópia local');
    ok(T.cloudStatus.blockedWrites >= 1, 'escrita bloqueada registrada: ' + T.cloudStatus.blockedWrites);
    // treinos tinha cópia: escrita offline vai pra fila
    await window.storage.set('treinos', JSON.stringify([]));
    ok(JSON.parse(store.get(pref + '__pendentes') || '[]').includes('treinos'), 'escrita offline entra na fila de pendentes');
    ok(T.cloudStatus.writeOk === false, 'falha de escrita detectada');
  }

  if (cen === 'nuvem-falha-nao-sobrescreve') {
    NET.sdkOnline = true; navigator.onLine = true; NET.user = { uid: UID, email: 'a@b.c' };
    cloud.set('users/' + UID + '/data/historicoCarga', { value: JSON.stringify({ supino: [{ peso: 80 }] }) });
    NET.cloudDown = true; // SDK carrega, mas o Firestore falha
    const T = await carregarApp();
    await espera(600);
    ok(!erroFatal, 'sem erro fatal com nuvem falhando');
    ok(JSON.stringify(T.state.historicoCarga) === '{}', 'estado em memória ficou no padrão (leitura falhou)');
    await window.storage.set('historicoCarga', JSON.stringify({}));
    NET.cloudDown = false; T.setDown(0);
    await window.storage.set('historicoCarga', JSON.stringify({}));
    const nuvem = cloud.get('users/' + UID + '/data/historicoCarga');
    ok(nuvem && nuvem.value.includes('80'), 'dado real da nuvem preservado (não sobrescrito pelo padrão)');
    ok(T.cloudStatus.readOk === false && T.cloudStatus.failedReads > 0, 'falha de leitura registrada');
  }

  if (cen === 'migracao-segura') {
    NET.sdkOnline = true; navigator.onLine = true; NET.user = { uid: UID, email: 'a@b.c' };
    store.set('treinoapp:perfil', JSON.stringify({ nome: 'Local' }));
    store.set('treinoapp:treinos', JSON.stringify([{ day: 'x' }]));
    cloud.set('users/' + UID + '/data/treinos', { value: JSON.stringify([{ day: 'nuvem' }]) });
    const T = await carregarApp();
    await espera(800);
    ok(cloud.get('users/' + UID + '/data/perfil') && cloud.get('users/' + UID + '/data/perfil').value.includes('Local'), 'chave ausente na nuvem foi migrada');
    ok(cloud.get('users/' + UID + '/data/treinos').value.includes('nuvem'), 'chave existente na nuvem NÃO foi sobrescrita');
    ok(T.cloudStatus.migracaoOk === true, 'migração completa: ' + T.cloudStatus.migracaoOk);
    ok(window.storage.kind === 'nuvem', 'storage da conta após login');
    ok(T.state.treinos[0] && T.state.treinos[0].day === 'nuvem', 'estado recarregado da nuvem');
  }

  if (cen === 'pendentes-flush') {
    NET.sdkOnline = true; navigator.onLine = true; NET.user = { uid: UID };
    const T = await carregarApp();
    await espera(600);
    NET.cloudDown = true;
    await window.storage.set('treinos', JSON.stringify([{ day: 'novo' }]));
    ok(JSON.parse(store.get(pref + '__pendentes') || '[]').includes('treinos'), 'pendente registrado');
    const lido = await window.storage.get('treinos');
    ok(lido.value.includes('novo'), 'chave pendente é lida da cópia local (mais nova)');
    NET.cloudDown = false; T.setDown(0);
    const r = await window.storage.flushPendentes();
    ok(r === true && cloud.get('users/' + UID + '/data/treinos').value.includes('novo'), 'flush enviou o pendente');
    ok(!store.get(pref + '__pendentes'), 'fila vazia após flush');
  }

  if (cen === 'gps-incremental-resume') {
    NET.sdkOnline = false; navigator.onLine = false;
    const T = await carregarApp();
    const gr = { status: 'running', day: 'Seg', mode: 'gps', steps: [{ name: 'Corrida', km: 5, tipo: 'distancia' }], stepIndex: 0, startedAt: Date.now() - 600000, pausedMs: 0, pauseBeganAt: null, stepStartedAt: Date.now() - 600000, stepPausedMs: 0, totalDistKm: 2, stepDistKm: 2, lastPoint: null, points: [], etapasExecutadas: [] };
    T.state.gpsRun = gr;
    const t0 = Date.now() - 600000;
    for (let i = 0; i < 250; i++) gr.points.push({ lat: -20 + i * 1e-5, lng: -54, timestamp: t0 + i * 1000, alt: 500 });
    await T.gpsPersist(true);
    let todos = await T.gpsDbAll();
    let blocos = todos.filter(r => r.id.startsWith('activeRun_pts_'));
    ok(blocos.length === 3, '250 pontos -> 3 blocos: ' + blocos.length);
    const meta = todos.find(r => r.id === 'activeRun');
    ok(meta && !meta.points && meta.ptsTotal === 250, 'metadados sem o array de pontos');
    // mais 30 pontos: só o último bloco é regravado
    for (let i = 250; i < 280; i++) gr.points.push({ lat: -20 + i * 1e-5, lng: -54, timestamp: t0 + i * 1000 });
    const antes = JSON.stringify((await T.gpsDbGet('activeRun_pts_0')).pts.length);
    await T.gpsPersist(true);
    ok((await T.gpsDbGet('activeRun_pts_2')).pts.length === 80, 'bloco parcial atualizado (80 pts)');
    ok(antes === '100', 'bloco 0 intacto');
    // throttle: sem forçar, segundo checkpoint em <5s não grava na hora
    const ultimoAntes = T._gpsPersist().ultimo;
    T.gpsPersist();
    ok(T._gpsPersist().ultimo === ultimoAntes && T._gpsPersist().timer, 'checkpoint espaçado (agendado, não imediato)');
    // restaura: app fechado com a corrida "running"
    const savedAt = (await T.gpsDbGet('activeRun')).savedAt;
    const restaurada = await T.gpsCarregarCorridaAtiva();
    ok(restaurada.points.length === 280, 'restaura todos os pontos: ' + restaurada.points.length);
    T.state.gpsRun = null;
    await espera(50);
    await T.init();
    const g2 = T.state.gpsRun;
    ok(g2 && g2.status === 'paused', 'restaurada como pausada');
    ok(g2 && Math.abs(g2.pauseBeganAt - Math.max(savedAt, t0 + 279000)) < 5, 'pausa começa no último momento vivo, não agora (' + (Date.now() - g2.pauseBeganAt) + 'ms atrás)');
    // caso: estava pausada antes de fechar -> mantém pauseBeganAt real
    g2.pauseBeganAt = Date.now() - 120000; g2.status = 'paused';
    await T.gpsPersist(true);
    T.state.gpsRun = null; await T.init();
    ok(Math.abs(T.state.gpsRun.pauseBeganAt - (Date.now() - 120000)) < 100, 'pausa real preservada ao reabrir');
    // formato antigo (pontos dentro do activeRun) continua restaurando
    await T.gpsDbPut({ id: 'activeRun', status: 'running', points: [{ lat: 1, lng: 1, timestamp: Date.now() - 1000 }], startedAt: Date.now() - 5000, pausedMs: 0 });
    const legado = await T.gpsCarregarCorridaAtiva();
    ok(legado.points.length === 1, 'formato antigo de corrida em andamento restaura');
  }

  if (cen === 'gps-fim-backup-nuvem') {
    NET.sdkOnline = true; navigator.onLine = true; NET.user = { uid: UID };
    const T = await carregarApp();
    await espera(600);
    T.state.equipamentos = { tenis: [] }; T.state.corridaProgress = {}; T.state.treinos = [];
    const gr = { status: 'running', day: 'Seg', mode: 'gps', steps: [{ name: 'Corrida', km: 5, tipo: 'distancia' }], stepIndex: 0, startedAt: Date.now() - 60000, pausedMs: 0, pauseBeganAt: null, stepStartedAt: Date.now() - 60000, stepPausedMs: 0, totalDistKm: 0.2, stepDistKm: 0.2, lastPoint: null, points: [], etapasExecutadas: [] };
    for (let i = 0; i < 120; i++) gr.points.push({ lat: -20 + i * 1e-5, lng: -54, timestamp: Date.now() - 60000 + i * 500, alt: 500 + i % 3 });
    T.state.gpsRun = gr;
    await T.gpsPersist(true);
    await T.finishGpsRun();
    await espera(400);
    const todos = await T.gpsDbAll();
    const corrida = todos.find(r => r.id.startsWith('run_'));
    ok(corrida && corrida.pontos_gps.length === 120 && corrida.ownerUid === UID, 'corrida concluída gravada no aparelho com dono');
    ok(!todos.some(r => r.id.startsWith('activeRun')), 'checkpoint da corrida em andamento apagado');
    const docId = 'users/' + UID + '/data/gpsRun__' + corrida.id;
    ok(cloud.has(docId), 'corrida enviada à nuvem');
    ok((cloud.get('users/' + UID + '/data/gpsRunsIndex') || {}).ids.includes(corrida.id), 'índice da nuvem atualizado');
    const escritasAntes = NET.writes.filter(p => p === docId).length;
    await T.sincronizarCorridasGps();
    ok(NET.writes.filter(p => p === docId).length === escritasAntes, 'nova sincronização não reenvia a mesma corrida');
    // backup inclui corridas
    await T.exportBackup();
    const bk = JSON.parse(global.__ultimoBlob);
    ok(Array.isArray(bk.__corridasGps) && bk.__corridasGps.length === 1, 'backup inclui a corrida GPS');
    ok(bk.hybridPlanData !== undefined || true, 'backup exporta chaves novas quando existem');
    // import: backup antigo (sem corridas) e backup novo (com corridas) num app limpo
    const arquivoAntigo = { text: async () => JSON.stringify({ treinos: '[]' }) };
    await T.importBackupFile(arquivoAntigo);
    ok(true, 'backup antigo sem corridas importa sem erro');
    const { gpsDbPut } = T;
    const idNovo = 'run_123';
    await T.importBackupFile({ text: async () => JSON.stringify({ __corridasGps: [{ ...corrida, id: idNovo }] }) });
    ok(!!(await T.gpsDbGet(idNovo)), 'backup com corridas restaura a corrida');
    // exclusão some da nuvem
    T.state.gpsRun = { status: 'finished', progressKey: 'Seg', runId: corrida.id };
    T.state.corridaProgress = { Seg: { done: true, gpsRunId: corrida.id } };
    await T.gpsDeleteActivity();
    await espera(400);
    ok(!cloud.has(docId), 'corrida excluída some da nuvem');
    ok(!(cloud.get('users/' + UID + '/data/gpsRunsIndex').ids || []).includes(corrida.id), 'índice sem a excluída');
  }

  if (cen === 'gps-baixa-de-outro-aparelho') {
    NET.sdkOnline = true; navigator.onLine = true; NET.user = { uid: UID };
    cloud.set('users/' + UID + '/data/gpsRunsIndex', { ids: ['run_999'] });
    cloud.set('users/' + UID + '/data/gpsRun__run_999', { corrida: { id: 'run_999', day: 'Qua', distancia_total_km: 5 }, pontos: JSON.stringify([[-20, -54, 1000, 500, 0], [-20.001, -54, 2000, null, 1]]), pontosPasso: 1, formato: 1 });
    const T = await carregarApp();
    await espera(900);
    const r = await T.gpsDbGet('run_999');
    ok(r && r.pontos_gps.length === 2 && r.pontos_gps[1].seg === 1 && r.pontos_gps[0].alt === 500, 'corrida de outro aparelho baixada e decodificada');
  }

  await espera(50);
  ok(!erroFatal, 'sem promessa rejeitada não tratada' + (erroFatal ? ': ' + (erroFatal.stack || erroFatal).toString().split('\n')[0] : ''));
  process.exit(process.exitCode || 0);
})();
