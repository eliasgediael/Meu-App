// Revisão de uso real (08/10/2026): problemas reproduzidos no navegador e corrigidos.
// - fechar o detalhe/edição de um exercício (tocando fora, Cancelar ou Salvar) não leva a tela ao topo;
// - toque duplo em "Concluir série" registra uma série só; finalizar duas vezes não duplica o treino;
// - esteira: finalizar duas vezes grava uma corrida só.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');
const w = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const preparar = async () => {
    await page.evaluate(() => { closeSheet(); state.modalOpen = false; state.modalType = null; state.treinoV2Escape = false; state.workoutSession = null; state.gpsRun = null;
      state.tab = 'meusTreinos'; state.weekOffset = 0; state.selectedDayMusc = 'Qua'; state.treinosSubTab = 'musculacao'; render(); });
    await w(250);
    return page.evaluate(() => { const sc = document.querySelector('.mrt-scroll'); sc.scrollTop = 99999; return Math.round(sc.scrollTop); });
  };
  const pos = () => page.evaluate(() => Math.round(document.querySelector('.mrt-scroll').scrollTop));
  const modos = {
    'tocando fora': () => { const ov = document.querySelector('.modal-overlay'); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); },
    'Cancelar': () => document.getElementById('modalCancel').click(),
    'Salvar': () => document.getElementById('modalSave').click(),
  };
  for (const [nome, fechar] of Object.entries(modos)) {
    const y0 = await preparar();
    await page.evaluate(() => document.querySelector('[data-mrtex]').click()); await w(300);
    await page.evaluate(fechar); await w(300);
    const y1 = await pos();
    ok(y0 > 100 && Math.abs(y1 - y0) <= 2, `fechar o exercício (${nome}) mantém a posição da tela (${y0} → ${y1})`);
  }
  const yMenu = await preparar();
  await page.evaluate(() => document.querySelector('[data-mrtexmenu]').click()); await w(250);
  await page.evaluate(() => document.getElementById('sheetOverlay').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await w(250);
  ok(Math.abs((await pos()) - yMenu) <= 2, 'fechar o menu ⋯ do exercício mantém a posição');

  // "Remover deste dia" pede confirmação e explica o que sai
  await preparar();
  const nEx = await page.evaluate(() => state.musculacao.Qua.length);
  await page.evaluate(() => document.querySelector('[data-mrtexmenu]').click()); await w(250);
  await page.evaluate(() => document.querySelector('[data-exmenu="remover"]').click()); await w(250);
  const textoConf = await page.evaluate(() => (document.querySelector('.sheet') || {}).textContent || '');
  await page.evaluate(() => document.getElementById('cfCancel').click()); await w(250);
  ok(/planejado/.test(textoConf) && /histórico/.test(textoConf) && await page.evaluate((n) => state.musculacao.Qua.length === n, nEx), 'remover exercício pede confirmação, explica o que sai e Cancelar mantém');
  await page.evaluate(() => document.querySelector('[data-mrtexmenu]').click()); await w(250);
  await page.evaluate(() => document.querySelector('[data-exmenu="remover"]').click()); await w(250);
  await page.evaluate(() => document.getElementById('cfOk').click()); await w(300);
  ok(await page.evaluate((n) => state.musculacao.Qua.length === n - 1, nEx), 'confirmar remove só o exercício');

  // musculação: toque duplo e finalizar duas vezes
  await preparar();
  const n0 = await page.evaluate(() => state.workoutSessionsLog.length);
  await page.evaluate(() => document.getElementById('mrtStartWorkout').click()); await w(300);
  await page.evaluate(() => { const b = document.querySelector('[data-wexconcluir]'); b.click(); b.click(); }); await w(200);
  ok(await page.evaluate(() => state.workoutSession.doneSeries === 1), 'toque duplo em "Concluir série" registra uma série');
  await page.evaluate(() => { finishWorkoutSession(); finishWorkoutSession(); }); await w(200);
  ok(await page.evaluate((n) => state.workoutSessionsLog.length === n + 1, n0), 'finalizar duas vezes grava o treino uma vez');
  await page.evaluate(() => { state.workoutSession = null; render(); });

  // esteira: finalizar duas vezes grava uma corrida
  const dia = await page.evaluate(() => DAY_ABBR.find(x => treinoEntryForDay(x) && !isCorridaDone(x)));
  const g0 = await page.evaluate(async () => (await gpsDbAll()).filter(gpsEhCorridaSalva).length);
  await page.evaluate((d) => openEsteiraIntro(d), dia); await w(200);
  await page.evaluate(() => document.getElementById('gpsBtnBegin').click()); await w(400);
  ok(await page.evaluate(() => state.gpsRun.stepKmh > 0 && state.gpsRun.stepKmh === state.gpsRun.stepKmhSugerida), 'esteira começa na velocidade sugerida da etapa');
  const telaEsteira = await page.evaluate(() => document.querySelector('.mrt-root').textContent);
  ok(/Velocidade informada/.test(telaEsteira) && /Alvo desta etapa · /.test(telaEsteira), 'esteira separa "Velocidade informada" de "Alvo desta etapa" (com o nome da etapa)');
  await page.evaluate(() => { finishGpsRun(); finishGpsRun(); }); await w(1000);
  ok(await page.evaluate(async (n) => (await gpsDbAll()).filter(gpsEhCorridaSalva).length === n + 1, g0), 'esteira: finalizar duas vezes grava uma corrida');
  // corrida ativa (arte 06): tipo · etapa, cartão da etapa, 3 métricas, finalizar por toque prolongado sem vermelho
  await page.evaluate(() => {
    state.gpsRun = null; const d = DAY_ABBR.find(x => treinoEntryForDay(x)); const gr = gpsNewRunState(d, treinoEntryForDay(d), 'gps');
    gr.status = 'running'; gr.startedAt = Date.now() - 600000; gr.stepStartedAt = Date.now() - 60000; gr.lastAccuracy = 8; state.gpsRun = gr; render();
  }); await w(400);
  const ativa = await page.evaluate(() => {
    const fin = document.getElementById('gpsBtnFinish');
    const cor = fin ? getComputedStyle(fin.querySelector('.sq')).backgroundColor : '';
    return { kick: (document.querySelector('.fr-kick6') || {}).textContent || '', etapa: !!document.querySelector('.fr-etapa6 #gpsBtnSkipStep'),
      metricas: [...document.querySelectorAll('.fr-m3 > div span')].map(x => x.textContent), sinal: (document.querySelector('.fr-sinal6') || {}).textContent || '',
      finalizar: !!fin && /Segure para finalizar/.test(fin.textContent), cor };
  });
  ok(/Etapa \d+ de \d+/.test(ativa.kick) && ativa.etapa && ativa.metricas.length === 3 && /GPS/.test(ativa.sinal), 'corrida ativa: tipo · etapa, cartão da etapa com Pular, 3 métricas e sinal do GPS (' + ativa.kick + ')');
  ok(ativa.finalizar && ativa.cor === 'rgb(17, 17, 17)', 'finalizar continua por toque prolongado, em preto (' + ativa.cor + ')');
  await page.evaluate(() => { const b = document.getElementById('gpsBtnFinish'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 300); });
  await w(1300);
  ok(await page.evaluate(() => state.gpsRun && state.gpsRun.status === 'running'), 'toque curto no finalizar não encerra a corrida');
  await page.evaluate(() => { const b = document.getElementById('gpsBtnFinish'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await w(1500);
  ok(await page.evaluate(() => state.gpsRun && state.gpsRun.status === 'finished'), 'segurar 1 s no finalizar encerra a corrida');
  await page.evaluate(() => { state.gpsRun = null; render(); });
  ok(!app.erros.length, 'sem erro na página' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
