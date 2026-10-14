// Estrelas fora da Biblioteca (favorito no menu de três pontos) e foto do perfil pelo avatar.
const fs = require('fs'), os = require('os'), path = require('path');
const { abrirApp, ok, espera } = require('../harness/navegador');

// PNG 2×2 cinza (dado fictício de teste) e um arquivo que não é imagem.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12NoaGj4z8DAwMDEwMDAAAAiCAQBJrsBXQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP favoritos/foto: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forza-foto-'));
  const img = path.join(dir, 'foto-ficticia.png'), ruim = path.join(dir, 'nao-e-imagem.png');
  fs.writeFileSync(img, PNG); fs.writeFileSync(ruim, 'texto');
  try {
    // ---------- Favoritos ----------
    await page.evaluate(() => { state.favoritos = ['Supino reto com barra']; state.tab = 'biblioteca'; state.bibDetalhe = null; state.bibGrupo = ''; render(); });
    await espera(300);
    ok(await page.$('.mrt-bibcard .fav') === null && await page.$('.mrt-bibcard svg path[d^="M12 3l2.7"]') === null, 'Biblioteca: lista sem estrela');
    await page.evaluate(() => { state.bibGrupo = 'Favoritos'; render(); });
    ok(await page.evaluate(() => document.querySelectorAll('.mrt-bibcard').length === 1), 'Biblioteca: filtro Favoritos mostra o favorito salvo');
    await page.evaluate(() => { state.bibGrupo = ''; state.bibDetalhe = 'Supino reto com barra'; render(); });
    await espera(200);
    ok(await page.$('.mrt-favbig') === null && await page.$('[data-bibmenu]') !== null, 'Detalhe: sem estrela, com menu de três pontos');
    ok(await page.evaluate(() => { const b = document.querySelector('[data-bibmenu]').getBoundingClientRect(), t = document.querySelector('.mrt-runtitle').getBoundingClientRect(); return b.right <= innerWidth - 8 && b.top < t.bottom; }), 'Detalhe: menu alinhado ao título, dentro da tela');
    await page.click('[data-bibmenu]'); await espera(250);
    ok(/Remover dos favoritos/.test(await page.$eval('.sheet', el => el.textContent)), 'Menu do detalhe: oferece remover dos favoritos');
    await page.click('[data-favmenu]'); await espera(250);
    ok(await page.evaluate(() => !state.favoritos.includes('Supino reto com barra')), 'Menu do detalhe: remove dos favoritos');
    await page.click('[data-bibmenu]'); await espera(250);
    await page.click('[data-favmenu]'); await espera(250);
    ok(await page.evaluate(async () => { const r = await window.storage.get('favoritos', false); return JSON.parse(r.value).includes('Supino reto com barra'); }), 'Menu do detalhe: favorito volta e fica salvo');
    // menu do exercício no treino
    await page.evaluate(() => { const d = Object.keys(state.musculacao).find(k => (state.musculacao[k] || []).length); state.tab = 'meusTreinos'; state.weekOffset = 0; state.treinosSubTab = 'musculacao'; state.selectedDayMusc = d; render(); });
    await espera(300);
    await page.click('[data-mrtexmenu]'); await espera(250);
    ok(await page.$('.sheet [data-favmenu]') !== null, 'Treino: favorito no menu de três pontos do exercício');
    await page.evaluate(() => closeSheet());

    // ---------- Foto do perfil ----------
    await page.evaluate(() => { state.perfil = { ...state.perfil, foto: '' }; state.tab = 'perfil'; render(); });
    await espera(300);
    await page.click('#frAvatar'); await espera(250);
    ok(await page.$('[data-pffoto="galeria"]') !== null && await page.$('[data-pffoto="camera"]') !== null && await page.$('[data-pffoto="remover"]') === null, 'Avatar: galeria e câmera; sem remover quando não há foto');
    await page.click('[data-pffoto="cancelar"]'); await espera(250);
    ok(await page.$('.sheet') === null && await page.evaluate(() => !state.perfil.foto), 'Avatar: cancelar fecha sem mudar nada');
    // câmera pede captura
    await page.evaluate(() => { window.__capt = null; const c = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { window.__capt = this.getAttribute('capture'); return; } return c.call(this); }; window.__clickOrig = c; });
    await page.click('#frAvatar'); await espera(200); await page.click('[data-pffoto="camera"]'); await espera(200);
    ok(await page.evaluate(() => window.__capt === 'user'), 'Tirar foto: abre a câmera (capture)');
    await page.evaluate(() => { HTMLInputElement.prototype.click = window.__clickOrig; document.querySelectorAll('body > input[type=file]').forEach(i => i.remove()); });
    // cancelar a escolha do arquivo
    let [ch] = await Promise.all([page.waitForFileChooser(), (async () => { await page.click('#frAvatar'); await espera(200); await page.click('[data-pffoto="galeria"]'); })()]);
    await ch.cancel(); await espera(300);
    ok(await page.evaluate(() => !state.perfil.foto), 'Galeria: cancelar a escolha não muda a foto');
    // falha de carregamento
    [ch] = await Promise.all([page.waitForFileChooser(), (async () => { await page.click('#frAvatar'); await espera(200); await page.click('[data-pffoto="galeria"]'); })()]);
    await ch.accept([ruim]); await espera(800);
    ok(await page.evaluate(() => !state.perfil.foto && /Não consegui carregar/.test((document.getElementById('appToast') || {}).textContent || '')), 'Galeria: arquivo inválido avisa e não muda a foto');
    // foto válida
    [ch] = await Promise.all([page.waitForFileChooser(), (async () => { await page.click('#frAvatar'); await espera(200); await page.click('[data-pffoto="galeria"]'); })()]);
    await ch.accept([img]); await espera(800);
    ok(await page.evaluate(() => /^data:image\/jpeg/.test(state.perfil.foto) && /url\(/.test(document.getElementById('frAvatar').style.backgroundImage)), 'Galeria: foto aplicada no avatar');
    // fecha e reabre o app
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof state !== 'undefined' && state && typeof render === 'function');
    await espera(1500);
    await page.evaluate(() => { state.tab = 'perfil'; render(); });
    await espera(300);
    ok(await page.evaluate(() => /^data:image\/jpeg/.test(state.perfil.foto) && /url\(/.test(document.getElementById('frAvatar').style.backgroundImage)), 'Foto continua depois de fechar e reabrir');
    // remover
    await page.click('#frAvatar'); await espera(250);
    await page.click('[data-pffoto="remover"]'); await espera(400);
    await page.click('#cfOk'); await espera(500);
    ok(await page.evaluate(() => !state.perfil.foto), 'Remover foto (com confirmação)');
    ok(app.erros.length === 0, 'favoritos/foto: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
