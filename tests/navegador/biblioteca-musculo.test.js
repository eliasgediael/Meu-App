// Biblioteca: escolher o músculo no corpo (mesmo mapa anatômico do exercício) e listar só os exercícios dele.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP biblioteca por músculo: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    await page.evaluate(() => { state.tab = 'biblioteca'; state.bibDetalhe = null; state.bibGrupo = ''; state.bibBusca = ''; state.bibMusculo = null; state.bibMapaAberto = false; render(); });
    await espera(300);
    const total = await page.evaluate(() => bibFiltrada().length);
    ok(await page.$('#bibMapaToggle') !== null && await page.$('.fr-bibmapa') === null, 'Biblioteca: chip "Por músculo" e mapa fechado no início');

    await page.click('#bibMapaToggle'); await espera(300);
    ok(await page.$$eval('.fr-bibmapa .mrt-anat', l => l.length) === 2, 'Mapa: vista frontal e traseira');
    const regioes = await page.$$eval('.fr-bibmapa [data-bibmusc]', l => [...new Set(l.map(x => x.getAttribute('data-bibmusc')))]);
    ok(regioes.length >= 15 && regioes.includes('chest') && regioes.includes('quads') && regioes.includes('lats'), 'Mapa: regiões tocáveis (' + regioes.length + ')');

    await page.evaluate(() => document.querySelector('.fr-bibmapa [data-bibmusc="chest"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await espera(300);
    const pe = await page.evaluate(() => {
      const l = bibFiltrada();
      return { n: l.length, todos: l.every(e => muscleRegionsForExercise(e.nome).primary.includes('chest')),
        marcado: !!document.querySelector('.fr-bibmapa path.on[data-bibmusc="chest"]'), texto: document.querySelector('.fr-bibmapa .info').textContent };
    });
    ok(pe.n > 0 && pe.n < total, 'Peitoral: lista reduzida (' + pe.n + ' de ' + total + ')');
    ok(pe.todos, 'Peitoral: todo exercício trabalha o músculo como principal');
    ok(pe.marcado && /Peitoral/.test(pe.texto), 'Peitoral: região marcada e nome exibido');

    // panturrilha: nada de agachamento (quadríceps), alongamento ou salto; só exercícios de panturrilha
    await page.evaluate(() => { state.bibMusculo = 'calves'; render(); });
    await espera(300);
    const pan = await page.evaluate(() => bibFiltrada().map(e => e.nome));
    ok(pan.length >= 5 && pan.every(n => /panturrilha/i.test(n)), 'Panturrilha: só exercícios de panturrilha (' + pan.length + ')');
    ok(!pan.some(n => /agachamento|alongamento|salto/i.test(n)), 'Panturrilha: sem agachamento, alongamento nem salto');
    await page.evaluate(() => { state.bibMusculo = 'abs'; render(); });
    await espera(300);
    ok(await page.evaluate(() => !bibFiltrada().some(e => /^agachamento livre$/i.test(e.nome))), 'Abdômen: sem agachamento livre');
    await page.evaluate(() => { state.bibMusculo = 'chest'; render(); });
    await espera(300);

    await page.evaluate(() => document.querySelector('.fr-bibmapa [data-bibmusc="chest"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await espera(300);
    ok(await page.evaluate(() => state.bibMusculo === null), 'Tocar de novo no mesmo músculo desmarca');

    await page.evaluate(() => document.querySelector('.fr-bibmapa [data-bibmusc="quads"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await espera(300);
    ok(await page.evaluate(() => bibFiltrada().length > 0 && state.bibMusculo === 'quads'), 'Quadríceps: lista com exercícios');
    await page.click('#bibMuscLimpar'); await espera(300);
    ok(await page.evaluate(t => state.bibMusculo === null && bibFiltrada().length === t, total), 'Limpar volta à lista completa');

    await page.evaluate(() => document.querySelector('.fr-bibmapa [data-bibmusc="lats"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await espera(300);
    await page.click('#bibMapaToggle'); await espera(300);
    ok(await page.evaluate(() => state.bibMusculo === null && !state.bibMapaAberto) && await page.$('.fr-bibmapa') === null, 'Fechar o mapa também limpa o músculo');
    ok(app.erros.length === 0, 'biblioteca por músculo: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
