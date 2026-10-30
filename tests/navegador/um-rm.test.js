// 1RM estimado (Epley) na aba Histórico do exercício na Biblioteca.
const { abrirApp, ok, espera } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP 1RM: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    ok(await page.evaluate(() => estimar1RM([{ sets: [{ peso: '100', reps: '5' }] }]) === 116.5), '1RM: 100 kg × 5 = 116,5 kg (Epley)');
    ok(await page.evaluate(() => estimar1RM([{ sets: [{ peso: '80', reps: '10' }, { peso: '60', reps: '8' }] }]) === 106.5), '1RM: pega a melhor série (80 × 10 = 106,5 kg)');
    ok(await page.evaluate(() => estimar1RM([{ sets: [{ peso: '20', reps: '25' }, { peso: '0', reps: '10' }, { peso: '50', reps: '' }] }]) === 0), '1RM: ignora séries de mais de 12 reps, sem carga ou sem reps');
    ok(await page.evaluate(() => estimar1RM(null) === 0 && estimar1RM([]) === 0 && estimar1RM([{ carga: '40' }]) === 0), '1RM: sem histórico ou sem séries devolve 0');
    await page.evaluate(() => {
      const it = bibliotecaLista().find(x => x.nome === 'Supino reto com barra'); window.__k = (it && it.id) || 'Supino reto com barra';
      state.historicoCarga = { ...(state.historicoCarga || {}), [window.__k]: [{ data: '2026-10-01', sets: [{ peso: '60', reps: '8' }] }, { data: '2026-10-08', sets: [{ peso: '70', reps: '6' }] }] };
      state.tab = 'biblioteca'; state.bibDetalhe = 'Supino reto com barra'; state.bibTab = 'hist'; render();
    });
    await espera(400);
    const txt = await page.$eval('.mrt-abacorpo', e => e.textContent);
    ok(/Recorde\s*70 kg/.test(txt) && /1RM estimado\s*84 kg/.test(txt), 'Aba Histórico mostra recorde e 1RM estimado (' + txt.replace(/\s+/g, ' ').slice(0, 60) + ')');
    await page.evaluate(() => { state.historicoCarga[window.__k] = [{ data: '2026-10-01', sets: [{ peso: '20', reps: '30' }] }]; render(); });
    await espera(300);
    ok(!/1RM estimado/.test(await page.$eval('.mrt-abacorpo', e => e.textContent)), 'Sem série válida, a linha de 1RM não aparece');
    ok(app.erros.length === 0, '1RM: sem erros de execução' + (app.erros.length ? ': ' + app.erros[0] : ''));
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
