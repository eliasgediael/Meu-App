// Configurações em páginas: a raiz lista as categorias e cada uma abre a sua página, com os mesmos controles de antes.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP configurações em páginas: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    await page.evaluate(() => { state.tab = 'perfil'; state.prefPagina = 'corrida'; render(); });
    await espera(400);
    await page.click('[data-perfilgo="preferencias"]'); await espera(400);
    const raiz = await page.$$eval('.fr-prefroot', l => l.map(b => b.querySelector('.nm').firstChild.textContent.trim()));
    ok(raiz.join('|') === 'Corrida e voz|Musculação|Equipamentos e relógio|Aparência|Conta e sincronização|Dados e backup', 'Raiz: categorias em grupos (' + raiz.join(' | ') + ')');
    ok(await page.evaluate(() => state.prefPagina === null) && await page.$('.mrt-switch') === null, 'Entrar pelo Perfil abre sempre a raiz, sem controles soltos');
    ok(await page.$$eval('.fr-prefic', l => l.length === 6 && l.every(x => x.querySelector('svg'))), 'Cada categoria tem ícone colorido');

    // Corrida e voz
    await page.click('[data-prefpag="corrida"]'); await espera(400);
    ok(await page.$('#mrtPrefVoz') !== null && await page.$('[data-escolhervoz]') !== null && await page.$('.fr-prefvoltar') !== null, 'Corrida e voz: voz, escolha de voz e botão voltar');
    ok(/Corrida e voz/.test(await page.$eval('.fr-preftit', e => e.textContent)), 'A página mostra o título');
    const antes = await page.$eval('#mrtPrefVoz', e => e.getAttribute('aria-checked'));
    await page.click('#mrtPrefVoz'); await espera(300);
    ok(await page.$eval('#mrtPrefVoz', e => e.getAttribute('aria-checked')) !== antes, 'O controle da página continua funcionando (voz nos treinos liga e desliga)');
    await page.click('#mrtPrefVoz'); await espera(200);

    // Musculação
    await page.click('.fr-prefvoltar'); await espera(300);
    await page.click('[data-prefpag="musculacao"]'); await espera(400);
    ok(await page.$('[data-avisomodo]') !== null && await page.$('#avisoTestar') !== null, 'Musculação: aviso do fim do descanso');

    // Aparência com o corpo masculino/feminino
    await page.click('.fr-prefvoltar'); await espera(300);
    await page.click('[data-prefpag="exibicao"]'); await espera(400);
    ok(await page.$$eval('[data-corpo]', l => l.length === 2), 'Aparência: escolha do corpo do mapa muscular');

    // Equipamentos e relógio, Conta e Dados
    await page.click('.fr-prefvoltar'); await espera(300);
    await page.click('[data-prefpag="equip"]'); await espera(400);
    ok(await page.$('[data-perfilgo="equipamentos"]') !== null && await page.$('[data-perfilgo="saudeRelogio"]') !== null, 'Equipamentos e relógio: as duas entradas');
    await page.click('.fr-prefvoltar'); await espera(300);
    await page.click('[data-prefpag="conta"]'); await espera(400);
    ok(await page.$('[data-perfilgo="conta"]') !== null && await page.$('[data-perfilgo="sincronizacao"]') !== null, 'Conta e sincronização: as duas entradas');
    await page.click('.fr-prefvoltar'); await espera(300);
    await page.click('[data-prefpag="dados"]'); await espera(400);
    ok(await page.$('[data-perfilgo="maisOpcoes"]') !== null, 'Dados e backup: entrada de backup');
    await page.click('[data-perfilgo="maisOpcoes"]'); await espera(400);
    ok(await page.evaluate(() => state.tab === 'maisOpcoes'), 'Dados e backup: abre a tela de backup');
    ok(app.erros.length === 0, 'configurações em páginas: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
