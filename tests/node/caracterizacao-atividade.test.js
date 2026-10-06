// Caracterização de gravação, atividade e dados: encerramento na última etapa, salvar/corrigir/excluir corrida
// (tênis, plano), histórico de musculação (formato antigo/novo e limite), backup, migração do perfil e datas/fuso.
const { H, carregarApp, ok, semErro, espera } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'treinoEntryForDay', 'corridaProgressKey', 'gpsNewRunState',
    'gpsAdvanceStep', 'finishGpsRun', 'salvarCorrecaoCorrida', 'excluirCorridaRealizada', 'gpsDbGet', 'gpsDbAll', 'normalizarSessaoMuscHistorico', 'saveWorkoutSessionsLog',
    'exportBackup', 'importBackupFile', 'BACKUP_KEYS', 'todayISO', 'hojeAbbr', 'segundaAtual', 'vdotISODate', 'normalizarAthleteProfile', 'migrarDoLegado', 'toggleCorridaDone',
    'registrarCheckinDiario', 'registrarNoDiario']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  const plano = JSON.stringify(S.treinos.map(t => ({ day: t.day, type: t.type, totalKm: t.totalKm })));

  // ---------- encerramento automático na última etapa (comportamento atual; o Passo 3 vai mudar) ----------
  {
    const entry = T.treinoEntryForDay('Seg');
    S.gpsRun = T.gpsNewRunState('Seg', entry);
    const gr = S.gpsRun;
    Object.assign(gr, { status: 'running', startedAt: Date.now() - 60000, pausedMs: 0, stepStartedAt: Date.now() - 10000, stepPausedMs: 0, points: [], totalDistKm: 0 });
    const nEtapas = gr.steps.length;
    gr.stepIndex = nEtapas - 2; T.gpsAdvanceStep();
    const aposPenultima = S.gpsRun && S.gpsRun.status;
    T.gpsAdvanceStep();
    await espera(300);
    const aposUltima = S.gpsRun && S.gpsRun.status;
    conferir('atividade-encerramento-ultima-etapa', { nEtapas, aposPenultima, aposUltima });
    ok(aposUltima === 'finished', 'CARACTERIZAÇÃO (comportamento atual, será corrigido no Passo 3): terminar a última etapa encerra a corrida sozinha');
    S.gpsRun = null;
  }

  // ---------- salvar, corrigir e excluir corrida: tênis, plano e gravação ----------
  {
    S.equipamentos = { relogio: '', tenis: [{ id: 't1', nome: 'Tênis teste', km: 100, ativo: true }] };
    const key = T.corridaProgressKey('Ter');
    delete S.corridaProgress[key];
    S.gpsRun = T.gpsNewRunState('Ter', T.treinoEntryForDay('Ter'));
    const gr = S.gpsRun, t0 = Date.now() - 1800000;
    const pts = []; for (let i = 0; i <= 60; i++) pts.push({ lat: -23.58 + i * 0.0007, lng: -46.65, timestamp: t0 + i * 30000 });
    Object.assign(gr, { status: 'running', startedAt: t0, pausedMs: 0, points: pts, totalDistKm: 4.67, etapasExecutadas: [] });
    await T.finishGpsRun(); await espera(300);
    const p1 = { ...S.corridaProgress[key] }; const runId = p1.gpsRunId;
    const r1 = { tenis: S.equipamentos.tenis[0].km, km: p1.km, tempo: p1.tempo, pace: p1.pace, done: p1.done, temGravacao: !!(await T.gpsDbGet(runId)) };
    await T.salvarCorrecaoCorrida(key, { km: 5, seg: 1800, data: '2026-10-06' });
    const p2 = S.corridaProgress[key], rec2 = await T.gpsDbGet(runId);
    const r2 = { tenis: S.equipamentos.tenis[0].km, km: p2.km, tempo: p2.tempo, pace: p2.pace, data: p2.data, kmOriginal: p2.kmOriginal, gravacaoKm: rec2.distancia_total_km, gravacaoSeg: rec2.tempo_total_seg };
    await T.excluirCorridaRealizada(key);
    const r3 = { tenis: S.equipamentos.tenis[0].km, progresso: S.corridaProgress[key] || null, temGravacao: !!(await T.gpsDbGet(runId)) };
    conferir('atividade-corrida-salvar-corrigir-excluir', { salvar: r1, corrigir: r2, excluir: r3 });
    ok(JSON.stringify(S.treinos.map(t => ({ day: t.day, type: t.type, totalKm: t.totalKm }))) === plano, 'salvar/corrigir/excluir corrida não muda o treino planejado');
    ok(r3.tenis === 100, 'excluir devolve os km ao tênis (' + r3.tenis + ')');
    // marcar como feito sem gravação (hoje: soma os km do plano no tênis)
    T.toggleCorridaDone('Ter');
    conferir('atividade-marcar-feito-sem-gravacao', { progresso: S.corridaProgress[key], tenis: S.equipamentos.tenis[0].km });
    T.toggleCorridaDone('Ter');
    S.gpsRun = null;
  }

  // ---------- histórico de musculação ----------
  {
    const antigo = { day: 'Seg', data: '2026-01-05', volume: 3000, series: 12, duracaoSeg: 2400, cargaMax: 40, recordes: 0, exercicios: [{ nome: 'Supino reto com barra', grupo: 'Peito', series: '3', reps: '10', carga: '40' }] };
    const novo = { id: 'musc_x', type: 'strength', day: 'Qui', title: 'Superiores', data: '2026-10-01', duracaoSeg: 2700, volume: 0, series: 3, cargaMax: 50, recordes: 1,
      exercicios: [{ nome: 'Supino reto com barra', grupo: 'Peito', exerciseId: '0025', seriesExecutadas: [{ numero: 1, peso: 50, repeticoes: 8, pse: 8, concluida: true }, { numero: 2, peso: 50, repeticoes: 8, concluida: true }, { numero: 3, peso: 50, repeticoes: 6, concluida: false }] }] };
    S.historicoCarga = {};
    conferir('atividade-musculacao-normalizar', { antigo: T.normalizarSessaoMuscHistorico(antigo), novo: T.normalizarSessaoMuscHistorico(novo) });
    S.workoutSessionsLog = Array.from({ length: 205 }, (_, i) => ({ id: 'l' + i, day: 'Seg', data: '2026-01-01', series: i }));
    await T.saveWorkoutSessionsLog();
    ok(S.workoutSessionsLog.length === 205 && S.workoutSessionsLog[0].series === 0, 'Passo 1: o histórico de musculação não apaga registros antigos (' + S.workoutSessionsLog.length + ')');
    S.checkinDiario = Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['2026-07-' + String(i + 1).padStart(2, '0'), { energia: 2 }]));
    await T.registrarCheckinDiario({ energia: 2, pernas: 2, dor: 1 });
    ok(Object.keys(S.checkinDiario).length === 66, 'Passo 1: check-ins antigos não são apagados');
    S.diarioTreinador = Array.from({ length: 205 }, (_, i) => ({ data: '2026-01-01', em: i, alteracao: 'registro ' + i }));
    T.registrarNoDiario({ alteracao: 'novo registro' });
    ok(S.diarioTreinador.length === 206, 'Passo 1: o diário do treinador não apaga registros antigos');
    S.workoutSessionsLog = [];
    S.checkinDiario = {}; S.diarioTreinador = []; S.domsPernas = {};
    ['checkinDiario', 'diarioTreinador', 'domsPernas'].forEach(k => localStorage.removeItem('treinoapp:' + k));
  }

  // ---------- backup: exportar e importar ----------
  {
    S.perfil = Object.assign(S.perfil || {}, { nome: 'Teste Backup', peso: '70' });
    await window.storage.set('perfil', JSON.stringify(S.perfil), false);
    const corridasAntes = (await T.gpsDbAll()).length;
    await T.exportBackup();
    const backup = global.__ultimoBlob;
    const obj = JSON.parse(backup);
    await window.storage.set('perfil', JSON.stringify({ nome: 'Mudado depois' }), false);
    await T.importBackupFile({ text: async () => backup });
    const depois = JSON.parse((await window.storage.get('perfil', false)).value);
    conferir('atividade-backup-chaves', { chaves: Object.keys(obj).sort(), backupKeys: T.BACKUP_KEYS });
    ok(depois.nome === 'Teste Backup', 'importar o backup restaura os dados exportados');
    ok((await T.gpsDbAll()).length === corridasAntes, 'importar duas vezes não duplica corridas');
  }

  // ---------- migração do perfil do atleta: idempotente ----------
  {
    const n1 = T.normalizarAthleteProfile(JSON.parse(JSON.stringify(S.athleteProfile)));
    const n2 = T.normalizarAthleteProfile(JSON.parse(JSON.stringify(n1)));
    const limpar = (x) => JSON.stringify(x, (k, v) => (['atualizadoEm', 'calculadoEm', 'em'].includes(k) ? undefined : v));
    ok(limpar(n1) === limpar(n2), 'normalizar o athleteProfile duas vezes não muda nada');
    const m1 = T.migrarDoLegado(S, null, { rascunho: false }), m2 = T.migrarDoLegado(S, m1, { rascunho: false });
    ok(limpar(m1) === limpar(m2), 'migrar do formato antigo duas vezes dá o mesmo perfil');
  }

  // ---------- datas e fuso (Brasília) ----------
  {
    const out = {};
    for (const [nome, iso] of [['dom_23h30', '2026-10-11T23:30:00-03:00'], ['seg_00h30', '2026-10-12T00:30:00-03:00'], ['seg_21h30', '2026-10-05T21:30:00-03:00'], ['sab_10h', '2026-10-10T10:00:00-03:00']]) {
      H.congelarRelogio(iso);
      out[nome] = { hoje: T.todayISO(), dia: T.hojeAbbr(), segunda: T.vdotISODate(T.segundaAtual()), chaveSeg: T.corridaProgressKey('Seg') };
    }
    H.congelarRelogio('2026-10-05T10:00:00-03:00');
    conferir('atividade-datas-fuso', out);
    ok(out.seg_21h30.hoje === '2026-10-05', 'depois das 21h a data continua sendo o dia local');
  }

  semErro();
  process.exit(process.exitCode || 0);
})();
