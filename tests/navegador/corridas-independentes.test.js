// Decisões de 08/10/2026 sobre corridas salvas:
// 1) cada corrida é uma atividade independente: correr de novo no mesmo dia não substitui nem esconde a anterior,
//    e não conta como segundo treino planejado;
// 3) excluir recalcula os recordes com as corridas restantes, devolve os km ao tênis e mantém o planejamento.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');
const w = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  const r = await page.evaluate(async () => {
    const out = {};
    const key = Object.keys(state.corridaProgress).find(k => state.corridaProgress[k] && state.corridaProgress[k].gpsRunId);
    const dia = key.split(' ')[0];
    const progAntes = JSON.stringify(state.corridaProgress[key]);
    const runAnterior = state.corridaProgress[key].gpsRunId;
    const tenis = { id: 't_teste', nome: 'Tênis teste', km: 100, ativo: true };
    state.equipamentos.tenis = [tenis];
    const nAtiv = listarAtividades().length;
    // segunda corrida no mesmo dia (mesmo caminho do app: estado da corrida + finishGpsRun)
    const semanaOffset = (() => { const [dd, mm] = key.split(' ')[1].split('/').map(Number); const seg = vdotMondayOf(new Date()); return Math.round((vdotMondayOf(new Date(2026, mm - 1, dd)) - seg) / (7 * 86400000)); })();
    state.weekOffset = semanaOffset;
    const entry = treinoEntryForDay(dia);
    const gr = gpsNewRunState(dia, entry || { steps: [] }, 'gps');
    gr.status = 'running'; gr.startedAt = Date.now() - 7800000; gr.stepStartedAt = gr.startedAt;
    const lat0 = -23.58, lng0 = -46.66; gr.points = Array.from({ length: 1700 }, (_, i) => ({ lat: lat0 + i * 0.000135, lng: lng0, timestamp: gr.startedAt + i * 4500 }));
    gr.totalDistKm = 25; state.gpsRun = gr;
    await finishGpsRun();
    out.mesmoRegistroDoPlano = JSON.stringify(state.corridaProgress[key]) === progAntes;
    out.novaComoAtividadePropria = !!(gr.atividadeId && atividadesLivres().find(a => a.id === gr.atividadeId));
    out.historico = [nAtiv, listarAtividades().length];
    out.anteriorContinuaVisivel = listarAtividades().some(a => a.gpsRunId === runAnterior);
    out.tenisAposNova = tenis.km;
    const idNova = gr.atividadeId, runNova = gr.runId;
    state.gpsRun = null;
    // recorde da corrida nova (6 km, mais longa) → excluir → recalcula
    await recalcularRecordesCorrida();
    out.recordeMaiorAntes = state.recordesCorrida.maiorKm && state.recordesCorrida.maiorKm.runId === runNova;
    await excluirAtividadeLivre(idNova);
    out.recordeNaoApontaExcluida = !Object.values(state.recordesCorrida).some(x => x && x.runId === runNova);
    out.tenisDevolvido = tenis.km;
    out.historicoDepois = listarAtividades().length;
    // excluir a corrida do plano: o planejamento continua
    const planejado = JSON.stringify(treinoEntryForDay(dia));
    await excluirCorridaRealizada(key);
    out.planejamentoMantido = JSON.stringify(treinoEntryForDay(dia)) === planejado && !!treinoEntryForDay(dia);
    out.recordeSemExcluidas = !Object.values(state.recordesCorrida).some(x => x && x.runId === runAnterior);
    return out;
  });
  ok(r.mesmoRegistroDoPlano && r.anteriorContinuaVisivel, 'correr de novo no mesmo dia não substitui nem esconde a corrida anterior');
  ok(r.novaComoAtividadePropria && r.historico[1] === r.historico[0] + 1, `a nova corrida é uma atividade própria (${r.historico.join(' → ')})`);
  ok(r.tenisAposNova === 125, 'nova corrida soma no tênis (' + r.tenisAposNova + ' km)');
  ok(r.recordeMaiorAntes && r.recordeNaoApontaExcluida, 'excluir recalcula os recordes com as corridas restantes');
  ok(r.tenisDevolvido === 100 && r.historicoDepois === r.historico[0], 'excluir devolve os km ao tênis e tira do histórico');
  ok(r.planejamentoMantido && r.recordeSemExcluidas, 'excluir a corrida do plano mantém o treino planejado');
  ok(!app.erros.length, 'sem erro na página' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
