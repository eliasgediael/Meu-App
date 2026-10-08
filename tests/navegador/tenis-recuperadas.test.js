// Conferência pedida em 08/10/2026:
// 1) excluir uma corrida desconta a distância UMA vez do tênis associado, sem afetar outros tênis ou atividades;
// 2) corridas recuperadas entram no histórico, totais e recordes sem duplicação, com o tênis sem associação.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  const r = await page.evaluate(async () => {
    const out = {};
    const A = { id: 'tA', nome: 'Tênis A (fictício)', km: 100, ativo: true }, B = { id: 'tB', nome: 'Tênis B (fictício)', km: 50, ativo: false };
    state.equipamentos.tenis = [A, B];
    // corrida do plano associada ao tênis A (5 km) e atividade livre associada ao B (3 km)
    const key = Object.keys(state.corridaProgress).find(k => state.corridaProgress[k] && state.corridaProgress[k].gpsRunId);
    const outraKey = Object.keys(state.corridaProgress).find(k => k !== key && state.corridaProgress[k] && state.corridaProgress[k].done);
    const outraAntes = JSON.stringify(state.corridaProgress[outraKey] || null);
    state.corridaProgress[key].shoeCredit = { tenisId: 'tA', km: 5 }; A.km = 105;
    await registrarAtividadeLivre({ id: 'run:livreB', tipo: 'corrida', data: '2026-10-01', distKm: 3, tempoSeg: 1000, shoeCredit: { tenisId: 'tB', km: 3 } }); B.km = 53;
    // corrigir a corrida do plano para 6 km ajusta o crédito (A: 106)
    await salvarCorrecaoCorrida(key, { km: 6, seg: 1800, data: state.corridaProgress[key].data || '2026-10-05' });
    out.aposCorrecao = A.km;
    await excluirCorridaRealizada(key);
    await excluirCorridaRealizada(key);   // segunda vez (toque repetido): não pode descontar de novo
    out.aposExcluir = [A.km, B.km];
    out.outraCorridaIntacta = JSON.stringify(state.corridaProgress[outraKey] || null) === outraAntes;
    out.livreIntacta = !!atividadesLivres().find(a => a.id === 'run:livreB');
    await excluirAtividadeLivre('run:livreB');
    out.excluirLivre2x = await excluirAtividadeLivre('run:livreB');   // já não existe → false, sem desconto
    out.aposExcluirLivre = [A.km, B.km];

    // 2) recuperada
    const t0 = Date.parse('2026-09-29T07:00:00-03:00');
    const pts = Array.from({ length: 2500 }, (_, i) => ({ lat: -23.58 + i * 0.00014, lng: -46.66, timestamp: t0 + i * 5000 }));
    await gpsDbPut({ id: 'run_' + t0, day: 'Ter', finishedAt: t0 + 12500000, distancia_total_km: 38.9, tempo_total_seg: 12500, pontos_gps: pts, etapas_executadas: [] });
    const kmA = A.km, kmB = B.km;
    const nHist = listarAtividades().length, kmPeriodo = frKmEntre('2026-09-29', '2026-09-29');
    await recuperarCorridasOrfas(); await recuperarCorridasOrfas();
    out.histUmaVez = listarAtividades().filter(a => a.gpsRunId === 'run_' + t0).length;
    out.hist = [nHist, listarAtividades().length];
    out.totais = [Math.round(kmPeriodo * 10) / 10, Math.round(frKmEntre('2026-09-29', '2026-09-29') * 10) / 10];
    out.recorde = !!(state.recordesCorrida.maiorKm && state.recordesCorrida.maiorKm.runId === 'run_' + t0);
    const rec = atividadesLivres().find(a => a.gpsRunId === 'run_' + t0);
    out.semTenis = rec && rec.shoeCredit === null && A.km === kmA && B.km === kmB;
    return out;
  });
  ok(r.aposCorrecao === 106, 'corrigir a distância ajusta o crédito do tênis (105 → 106)');
  ok(r.aposExcluir[0] === 100 && r.aposExcluir[1] === 53, `excluir desconta uma vez só do tênis associado; o outro tênis não muda (A ${r.aposExcluir[0]}, B ${r.aposExcluir[1]})`);
  ok(r.outraCorridaIntacta && r.livreIntacta, 'excluir não afeta outras atividades');
  ok(r.excluirLivre2x === false && r.aposExcluirLivre[0] === 100 && r.aposExcluirLivre[1] === 50, 'excluir atividade livre desconta uma vez do tênis dela');
  ok(r.histUmaVez === 1 && r.hist[1] === r.hist[0] + 1, 'recuperada entra uma vez no histórico (mesmo recuperando duas vezes)');
  ok(r.totais[1] === Math.round((r.totais[0] + 38.9) * 10) / 10, `recuperada entra uma vez nos totais (${r.totais.join(' → ')} km)`);
  ok(r.recorde, 'recuperada entra nos recordes');
  ok(r.semTenis, 'recuperada fica sem tênis associado e nenhum tênis muda');
  ok(!app.erros.length, 'sem erro na página' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
