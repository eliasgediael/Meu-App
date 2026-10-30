// Campos de tempo e pace (mm:ss): o ":" entra sozinho, porque o teclado numérico do iPhone não tem essa tecla.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP máscara de tempo: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    await page.evaluate(() => {
      const box = document.createElement('div'); box.id = 'caixaTeste';
      box.innerHTML = '<input id="tA" placeholder="24:30"><input id="tB" placeholder="mm:ss"><input id="tC" placeholder="ex: 24:30"><input id="tD" placeholder="5:20"><input id="tE" placeholder="outro">';
      document.body.appendChild(box);
    });
    const digita = async (id, txt) => { await page.$eval('#' + id, e => { e.value = ''; e.focus(); }); await page.type('#' + id, txt); return page.$eval('#' + id, e => e.value); };
    ok(await digita('tA', '2430') === '24:30', 'Digitar 2430 vira 24:30');
    ok(await digita('tB', '530') === '5:30', 'Digitar 530 vira 5:30');
    ok(await digita('tC', '1999') === '19:99', 'Campo "ex: 24:30" também formata (digitando 1999 não embaralha)');
    await page.$eval('#tC', e => e.blur()); await espera(100);
    ok(await page.$eval('#tC', e => e.value) === '19:59', 'Ao sair do campo, segundos acima de 59 viram 59');
    ok(await digita('tD', '10530') === '1:05:30', 'Cinco dígitos viram h:mm:ss (1:05:30)');
    ok(await digita('tA', '24') === '24', 'Dois dígitos ficam sem ":"');
    ok(await digita('tA', '24:30') === '24:30', 'Quem digita o ":" também funciona');
    ok(await digita('tE', '2430') === '2430', 'Outros campos não mudam');
    // apagar não reformata: 24:30 -> 24:3 continua 24:3
    await page.$eval('#tA', e => { e.value = ''; e.focus(); }); await page.type('#tA', '2430'); await page.keyboard.press('Backspace');
    ok(await page.$eval('#tA', e => e.value) === '24:3', 'Apagar não reembaralha o tempo');
    // o campo recebe o valor já formatado nos handlers do próprio campo
    ok(await page.evaluate(() => { let visto = null; const el = document.getElementById('tB'); el.value = ''; el.oninput = () => { visto = el.value; }; el.focus(); return true; })
      && (await page.type('#tB', '615'), await page.evaluate(() => document.getElementById('tB').value)) === '6:15', 'Handler do campo vê 6:15');
    ok(await page.evaluate(() => parseClockInput('2430') === 24 * 60 + 30 && parseClockInput('24:30') === 24 * 60 + 30 && parseClockInput('10530') === 3930 && parseClockInput('abc') === null), 'parseClockInput aceita com e sem ":"');
    ok(app.erros.length === 0, 'máscara de tempo: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
