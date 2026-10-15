// Releitura dos dados no meio do uso (conta confirmada pelo Firebase, internet de volta) não pode
// jogar a pessoa de volta para o Início nem fechar a folha que ela está vendo.
const { abrirApp, ok } = require('../harness/navegador');

const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) {
    console.log('SKIP releitura mantém tela: ' + (app?.indisponivel || 'navegador indisponível'));
    return;
  }
  const { page } = app;
  try {
    for (const tab of ['meusTreinos', 'perfil', 'progresso']) {
      await page.evaluate(t => { state.tab = t; render(); initQuandoLivre(); }, tab);
      await page.waitForFunction(() => _initPendente === null, { timeout: 10000 });
      await esperar(400);
      ok(await page.evaluate(() => state.tab) === tab, `releitura mantém a aba ${tab}`);
    }

    await page.evaluate(() => { state.tab='meusTreinos';state.weekOffset=-1;state.selectedDayMusc='Qua';state.selectedDayCorrida='Qua';render();initQuandoLivre(); });
    await page.waitForFunction(() => _initPendente === null, {timeout:10000});await esperar(400);
    ok(await page.evaluate(()=>state.weekOffset===-1 && state.selectedDayMusc==='Qua' && state.selectedDayCorrida==='Qua'),'releitura mantém semana e dia selecionados');
    await page.evaluate(()=>{state.tab='biblioteca';state.bibDetalhe=bibliotecaLista()[0].nome;state.bibTab='como';render();window.__bibEsperado=state.bibDetalhe;initQuandoLivre();});
    await page.waitForFunction(()=>_initPendente===null,{timeout:10000});await esperar(400);
    ok(await page.evaluate(()=>state.tab==='biblioteca' && state.bibDetalhe===window.__bibEsperado && state.bibTab==='como'),'releitura mantém exercício e aba de instruções');

    await page.evaluate(() => { state.tab = 'meusTreinos'; render(); openSheet('<div id="folhaTeste">x</div>'); initQuandoLivre(); });
    await esperar(800);
    ok(await page.$('#folhaTeste') !== null, 'releitura espera a folha aberta fechar');
    ok(await page.evaluate(() => _initPendente !== null), 'releitura fica pendente com folha aberta');
    await page.evaluate(() => closeSheet());
    await page.waitForFunction(() => _initPendente === null, { timeout: 12000 });
    await esperar(400);
    ok(await page.evaluate(() => state.tab) === 'meusTreinos', 'depois da folha fechar, releitura mantém a aba');

    await page.evaluate(() => { state.tab = 'perfil'; render(); });
    await page.evaluate(() => init());
    ok(await page.evaluate(() => state.tab) === 'hoje', 'abertura do app (init sem opção) continua no Início');

    ok(app.erros.length === 0, 'releitura mantém tela: sem erros de execução');
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
