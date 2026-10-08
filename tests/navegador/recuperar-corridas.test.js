// Recuperação das gravações que ficaram sem aparecer (decisão 2, 08/10/2026): backup antes, sem duplicar, sem apagar.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  const r = await page.evaluate(async () => {
    const out = {};
    const base = (await corridasOrfas()).length;
    const t0 = Date.parse('2026-09-30T07:00:00-03:00');
    const pts = Array.from({ length: 200 }, (_, i) => ({ lat: -23.58 + i * 0.00014, lng: -46.66, timestamp: t0 + i * 5000 }));
    await gpsDbPut({ id: 'run_' + t0, day: 'Qua', finishedAt: t0 + 1000000, distancia_total_km: 3.1, tempo_total_seg: 1000, pontos_gps: pts, etapas_executadas: [] });
    await gpsDbPut({ id: 'run_' + (t0 + 1), day: 'Qua', finishedAt: t0 + 1000001, distancia_total_km: 5, tempo_total_seg: 1500, pontos_gps: pts, etapas_executadas: [], ownerUid: 'outra-conta' });
    const orfas = await corridasOrfas();
    out.encontrou = orfas.length - base;
    out.ignoraOutraConta = !orfas.some(x => x.ownerUid === 'outra-conta');
    const nAntes = listarAtividades().length;
    const n1 = await recuperarCorridasOrfas();
    const n2 = await recuperarCorridasOrfas();
    out.recuperadas = [n1, n2];
    out.historico = [nAntes, listarAtividades().length];
    const a = atividadesLivres().find(x => x.gpsRunId === 'run_' + t0);
    out.atividade = a ? { data: a.data, km: a.distKm, recuperada: a.recuperada } : null;
    out.gravacaoMantida = !!(await gpsDbGet('run_' + t0));
    const b = await window.storage.get('backupRecuperacaoCorridas_' + todayISO(), false);
    out.backup = !!(b && b.value && JSON.parse(b.value).gravacoes.includes('run_' + t0));
    return out;
  });
  ok(r.encontrou === 1 && r.ignoraOutraConta, 'encontra a gravação sem atividade e ignora a de outra conta');
  ok(r.recuperadas[0] >= 1 && r.recuperadas[1] === 0 && r.historico[1] === r.historico[0] + r.recuperadas[0], `recupera sem duplicar (1ª vez ${r.recuperadas[0]}, 2ª vez ${r.recuperadas[1]})`);
  ok(r.atividade && r.atividade.data === '2026-09-30' && r.atividade.km === 3.1 && r.atividade.recuperada, 'volta como atividade própria com data e distância da gravação');
  ok(r.gravacaoMantida && r.backup, 'nada é apagado e o backup é feito antes');
  ok(!app.erros.length, 'sem erro na página' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
