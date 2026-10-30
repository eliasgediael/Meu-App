// Escolha Masculino / Feminino em Configurações: o mapa muscular troca a figura e as máscaras em todo o app.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP corpo feminino: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    await page.evaluate(() => { state.perfil = { ...state.perfil, corpo: undefined }; state.tab = 'preferencias'; state.subOrigin = 'perfil'; state.prefPagina = 'exibicao'; render(); });
    await espera(400);
    const seg = await page.$$eval('[data-corpo]', l => l.map(b => b.getAttribute('data-corpo') + ':' + b.classList.contains('on')));
    ok(seg.join() === 'masculino:true,feminino:false', 'Configurações: escolha Masculino / Feminino, masculino por padrão (' + seg.join() + ')');

    await page.click('[data-corpo="feminino"]'); await espera(400);
    ok(await page.evaluate(() => state.perfil.corpo === 'feminino'), 'Tocar em Feminino guarda a escolha');
    ok(await page.$eval('[data-corpo="feminino"]', b => b.classList.contains('on')), 'Feminino fica marcado');
    ok(await page.evaluate(async () => { const r = await window.storage.get('perfil', false); return JSON.parse(r.value).corpo === 'feminino'; }), 'A escolha fica salva no perfil');

    // mapa do exercício
    const mapa = await page.evaluate(() => { const a = muscleRegionsForExercise('Supino reto com barra'); return anatomiaFiguraHtml('frente', a, 'x') + anatomiaFiguraHtml('costas', a, 'y'); });
    ok(/gifs\/anatomia\/frente-fem\.webp/.test(mapa) && /gifs\/anatomia\/costas-fem\.webp/.test(mapa), 'Mapa do exercício usa as figuras femininas');
    ok(await page.evaluate(() => { const f = anatomiaCorpo('frente'); return f.arq === 'frente-fem' && f.f === ANATOMIA_FEM.frente; }), 'As máscaras são as femininas');
    ok(await page.evaluate(() => ['frente', 'costas'].every(l => { const a = ANATOMIA[l], b = ANATOMIA_FEM[l]; return JSON.stringify(Object.keys(a.lados)) === JSON.stringify(Object.keys(b.lados)) && JSON.stringify(Object.keys(a.centro)) === JSON.stringify(Object.keys(b.centro)); })), 'Feminino tem as mesmas regiões do masculino');

    // biblioteca por músculo
    await page.evaluate(() => { state.tab = 'biblioteca'; state.bibDetalhe = null; state.bibMapaAberto = true; state.bibMusculo = null; render(); });
    await espera(400);
    ok(await page.$$eval('.fr-bibmapa image', l => l.length === 2 && l.every(i => /-fem\.webp$/.test(i.getAttribute('href')))), 'Biblioteca por músculo usa o corpo feminino');
    const respostas = await Promise.all(['frente-fem', 'costas-fem'].map(n => page.evaluate(async (n) => (await fetch('gifs/anatomia/' + n + '.webp')).status, n)));
    ok(respostas.join() === '200,200', 'As imagens femininas existem no app');

    // volta ao masculino
    await page.evaluate(() => { state.tab = 'preferencias'; state.prefPagina = 'exibicao'; render(); });
    await espera(300);
    await page.click('[data-corpo="masculino"]'); await espera(300);
    ok(await page.evaluate(() => anatomiaCorpo('frente').arq === 'frente'), 'Voltar para Masculino restaura a figura masculina');
    ok(app.erros.length === 0, 'corpo feminino: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
