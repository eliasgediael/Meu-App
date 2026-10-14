// Artes de compartilhamento: escala da NOVA-06, transparência real (sem quadriculado gravado) e rota só com GPS.
const { abrirApp, ok } = require('../harness/navegador');

(async () => {
  const app = await abrirApp();
  if (!app || app.indisponivel) { console.log('SKIP artes: ' + (app?.indisponivel || 'navegador indisponível')); return; }
  const { page } = app;
  try {
    const r = await page.evaluate(async () => {
      // Corrida FICTÍCIA de teste (~5 km, 1 ponto a cada 5 s).
      const pts = [], t0 = new Date('2026-08-02T07:10:00').getTime();
      for (let i = 0; i < 370; i++) { const a = i / 370 * 2 * Math.PI; pts.push({ lat: -23.5874 + 0.0105 * Math.sin(a), lng: -46.6576 + 0.0045 * Math.cos(a), timestamp: t0 + i * 5000, alt: 620 + 10 * Math.sin(a * 3) }); }
      const gr = { status: 'finished', mode: 'gps', day: 'Dom', data: '2026-08-02', steps: [], etapasExecutadas: [], points: pts, totalDistKm: 5.03, finalElapsedSec: 1849 };
      const caixa = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, opaco = 0, xadrez = 0;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i + 3] > 0) { opaco++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        // quadriculado gravado = pixels cinza opacos na faixa da borda
        for (let x = 0; x < cv.width; x += 7) { const i = (5 * cv.width + x) * 4; if (d[i + 3] === 255) xadrez++; }
        return { w: x1 - x0, h: y1 - y0, opaco: opaco / (cv.width * cv.height), xadrez, canto: d[3] }; };
      ARTE_TINTA = '#FFFFFF';
      const artes = artesGaleriaCorrida(gr, {});
      const por = (n) => artes.find(a => a.nome === n);
      const recibo = caixa(await por('Recibo').gerar('story'));
      const tabela = caixa(await por('Tabela').gerar('story'));
      const etiquetas = caixa(await por('Etiquetas').gerar('story'));
      const quad = caixa(await por('Recibo').gerar('quadrado'));
      const semGps = artesCompartilharCorrida({ ...gr, mode: 'esteira', points: [] })({ tinta: 'claro' }).map(a => a.nome);
      return { recibo, tabela, etiquetas, quad, semGps };
    });
    ok(r.recibo.w >= 640 && r.recibo.h >= 820, `Recibo na escala da NOVA-06 (${r.recibo.w}×${r.recibo.h})`);
    ok(r.tabela.w >= 880, `Tabela ocupa a largura da referência (${r.tabela.w})`);
    ok(r.etiquetas.h <= 520 && r.etiquetas.h >= 400, `Etiquetas em 3 linhas (${r.etiquetas.h})`);
    ok(r.quad.h <= 1040, `Recibo cabe no quadrado (${r.quad.h})`);
    ok([r.recibo, r.tabela, r.etiquetas, r.quad].every(c => c.canto === 0 && c.xadrez === 0 && c.opaco < 0.1), 'PNG com transparência real, sem quadriculado gravado');
    ok(!r.semGps.some(n => /Rota|Trajeto|Mapa/.test(n)), 'Sem GPS: nenhuma arte com rota');
    ok(app.erros.length === 0, 'artes: sem erros de execução');
  } finally { await app.fechar(); }
})().catch(e => { console.error('FAIL ' + e.stack); process.exitCode = 1; });
