// Botão de play no meio da barra inferior: começa o treino de hoje que ainda não foi feito.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP nav play: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    // dia da semana de 5/10/2026 (segunda): corrida; 7/10 (quarta): musculação; 11/10 (domingo): descanso
    const irPara = async (dia) => {
      await page.evaluate((d) => {
        __setAgora(new Date(2026, 9, d, 12, 0, 0).getTime());
        Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() {}, watchPosition() { return 1; }, clearWatch() {} }, configurable: true });
        state.workoutSession = null; state.gpsRun = null; state.tab = 'hoje'; state.weekOffset = 0; render();
      }, dia);
      await espera(300);
    };

    await irPara(5);
    const nav = await page.evaluate(() => ({ n: document.querySelectorAll('.mrt-nav > button').length, meio: document.querySelectorAll('.mrt-nav > button')[2].classList.contains('mrt-navplay'),
      rotulos: [...document.querySelectorAll('.mrt-nav > button')].map(b => b.textContent.trim()) }));
    ok(nav.n === 5 && nav.meio, 'Barra: 5 botões, play no meio (' + nav.rotulos.join(' | ') + ')');

    await page.click('.mrt-navplay'); await espera(400);
    ok(await page.evaluate(() => !!state.gpsRun && !state.workoutSession), 'Segunda (corrida): abre a corrida de hoje');

    await irPara(7);
    await page.click('.mrt-navplay'); await espera(400);
    ok(await page.evaluate(() => !!state.workoutSession && state.workoutSession.day === 'Qua' && !state.gpsRun), 'Quarta (musculação): começa o treino de hoje');

    await irPara(11);
    await page.click('.mrt-navplay'); await espera(400);
    ok(await page.evaluate(() => !state.workoutSession && !state.gpsRun) && /descanso/i.test(await page.evaluate(() => document.body.textContent)), 'Domingo (descanso): não inicia nada e avisa');

    await irPara(5);
    await page.evaluate(() => { state.tab = 'meusTreinos'; render(); });
    await espera(300);
    ok(await page.$('.mrt-navplay') !== null, 'Aba Treino também tem o play');
    ok(app.erros.length === 0, 'nav play: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
