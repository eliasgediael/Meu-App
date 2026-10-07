const { abrirApp, ok } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) {
    console.log('SKIP Perfil/configurações: ' + (app?.indisponivel || 'navegador indisponível'));
    return;
  }
  const { page } = app;
  try {
    for (const width of [320, 430]) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.evaluate(() => { state.tab = 'perfil'; render(); });
      ok(await page.$('[data-perfilgo="turma"]') === null, `Perfil ${width}: sem atalho da antiga Turma`);
      await page.click('[aria-label="Configurações"]');
      ok(await page.evaluate(() => state.tab === 'preferencias'), `Perfil ${width}: abre Configurações`);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Configurações ${width}: sem transbordamento horizontal`);
      const antes = await page.$eval('[data-prefsw="autoPause"]', el => el.getAttribute('aria-checked'));
      await page.click('[data-prefsw="autoPause"]');
      const depois = await page.$eval('[data-prefsw="autoPause"]', el => el.getAttribute('aria-checked'));
      ok(antes !== depois, `Configurações ${width}: pausa automática muda com o toque`);
      await page.click('[data-prefsw="autoPause"]');
      await page.click('[data-perfilgo="maisOpcoes"]');
      ok(await page.$('#btnExportBackup') !== null, `Configurações ${width}: acesso real ao backup`);
    }
    ok(app.erros.length === 0, 'Perfil/configurações: sem erros de execução');
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
