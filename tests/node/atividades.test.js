// Bloco 3: atividades separadas do plano. Atividade livre (corrida, caminhada, esteira), "concluído sem registro",
// lista cronológica única, conclusão da sessão planejada, carga real, recordes, tênis, exclusão e backup.
const { carregarApp, ok, semErro, espera } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'treinoEntryForDay', 'corridaProgressKey', 'abrirAtividadeLivre',
    'finishGpsRun', 'gpsDbGet', 'listarAtividades', 'conclusaoCorrida', 'atividadesLivres', 'excluirAtividadeLivre', 'toggleCorridaDone', 'cargaReal',
    'corridasConcluidas', 'renderGpsSummary', 'BACKUP_KEYS', 'carregarAtividades', 'abrirResumoAtividade']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  S.equipamentos = { relogio: '', tenis: [{ id: 't1', nome: 'Tênis', km: 100, ativo: true }] };
  S.recordesCorrida = {}; S.corridaProgress = {}; S.workoutSessionsLog = []; S.atividadesLivres = [];
  const plano = JSON.stringify(S.treinos), progresso0 = JSON.stringify(S.corridaProgress);
  global.navigator.geolocation = {};

  // grava uma atividade livre simulando pontos de GPS
  const livre = async (tipo, km, min) => {
    T.abrirAtividadeLivre(tipo);
    const gr = S.gpsRun, t0 = Date.now() - min * 60000, n = 40;
    const pts = []; for (let i = 0; i <= n; i++) pts.push({ lat: -23.58 + i * (km / n) / 111, lng: -46.65, timestamp: t0 + i * (min * 60000 / n) });
    Object.assign(gr, { status: 'running', startedAt: t0, pausedMs: 0, points: tipo === 'esteira' ? [] : pts, totalDistKm: km });
    await T.finishGpsRun(); await espera(200);
    const g = S.gpsRun; S.gpsRun = null; return g;
  };

  const g1 = await livre('corrida', 5, 30);
  ok(g1.livre && g1.atividadeId && g1.status === 'finished', 'corrida livre gravada como atividade');
  ok(JSON.stringify(S.corridaProgress) === progresso0, 'atividade livre não conclui nenhuma sessão planejada');
  ok(JSON.stringify(S.treinos) === plano, 'atividade livre não muda o plano');
  const rec = await T.gpsDbGet(g1.runId);
  ok(rec && rec.livre && rec.tipoAtividade === 'corrida', 'gravação marcada como livre (' + (rec && rec.tipoAtividade) + ')');
  ok(S.equipamentos.tenis[0].km === 105, 'corrida livre soma a distância real no tênis (' + S.equipamentos.tenis[0].km + ')');
  ok(S.recordesCorrida && S.recordesCorrida.maiorKm && S.recordesCorrida.maiorKm.runId === g1.runId, 'corrida livre entra nos recordes');
  const html = T.renderGpsSummary(Object.assign({}, g1));
  // Decisão de 08/10/2026: atividade já salva sai por "Excluir atividade" (não "Descartar").
  ok(/Corrida livre/.test(html) && !/Planejado × Realizado/.test(html) && /Excluir atividade/.test(html) && !/Descartar/.test(html), 'resumo da atividade livre: título certo, sem "Planejado × Realizado", com Excluir atividade');

  const g2 = await livre('caminhada', 3, 40);
  ok(S.equipamentos.tenis[0].km === 105, 'caminhada não soma no tênis de corrida');
  ok(!(S.recordesCorrida.maiorKm.runId === g2.runId), 'caminhada não entra nos recordes de corrida');
  await livre('esteira', 4, 25);

  // musculação registrada e corrida do plano com gravação
  S.workoutSessionsLog = [{ id: 'm1', day: 'Ter', data: '2026-10-04', duracaoSeg: 2400, series: 12, exercicios: [] }];
  const kSeg = T.corridaProgressKey('Seg');
  S.corridaProgress[kSeg] = { done: true, data: '2026-10-03', km: '6.5', tempo: '39:00', pace: '6:00/km', gpsRunId: 'run_x' };
  const lista = T.listarAtividades();
  ok(lista.length === 5, 'lista única com corrida do plano, 3 livres e 1 musculação (' + lista.length + ')');
  ok(lista.every((a, i) => i === 0 || (lista[i - 1].data || '') >= (a.data || '')), 'lista em ordem cronológica, mais recente primeiro');
  ok(T.conclusaoCorrida(kSeg).status === 'completed' && T.conclusaoCorrida(kSeg).atividadeId === 'run:run_x', 'sessão planejada concluída pela atividade vinculada');

  // concluído sem registro
  const kTer = T.corridaProgressKey('Ter');
  const tenisAntes = S.equipamentos.tenis[0].km;
  T.toggleCorridaDone('Ter');
  ok(T.conclusaoCorrida(kTer).status === 'completed_without_record', 'marcar como feito sem gravação = concluído sem registro');
  ok(S.equipamentos.tenis[0].km === tenisAntes, 'concluído sem registro não soma km no tênis');
  ok(!T.listarAtividades().some(a => a.sessao && a.sessao.chave === kTer), 'concluído sem registro não vira atividade (sem distância/ritmo inventados)');
  S.corridaProgress[kTer] = { ...S.corridaProgress[kTer], data: '2026-10-05' };
  const cargaSemReg = T.cargaReal();
  delete S.corridaProgress[kTer];
  ok(JSON.stringify(T.cargaReal()) === JSON.stringify(cargaSemReg), 'concluído sem registro não gera carga');

  // atividades livres contam na carga e nos gráficos de corrida
  const sem = S.atividadesLivres; S.atividadesLivres = [];
  const cargaSem = T.cargaReal(); S.atividadesLivres = sem;
  ok(T.cargaReal().pontosPernas > cargaSem.pontosPernas, 'atividades livres entram na carga real');
  const cc = T.corridasConcluidas();
  ok(cc.filter(x => x.livre).length === 2, 'Progresso: corrida e esteira livres entram nos km; caminhada não (' + cc.filter(x => x.livre).length + ')');

  // exclusão de atividade livre
  const tenis0 = S.equipamentos.tenis[0].km;
  await T.excluirAtividadeLivre(g1.atividadeId);
  ok(!T.atividadesLivres().some(a => a.id === g1.atividadeId) && !(await T.gpsDbGet(g1.runId)), 'excluir atividade livre apaga registro e gravação');
  ok(Math.round((tenis0 - S.equipamentos.tenis[0].km) * 10) / 10 === 5, 'excluir devolve os km ao tênis');
  ok(JSON.stringify(S.treinos) === plano, 'excluir atividade livre não muda o plano');

  // persistência e backup
  await T.carregarAtividades();
  ok(T.atividadesLivres().length === 2, 'atividades livres persistem (recarregadas: ' + T.atividadesLivres().length + ')');
  ok(T.BACKUP_KEYS.includes('atividades'), 'atividades entram no backup e na sincronização');
  semErro();
  process.exit(process.exitCode || 0);
})();
