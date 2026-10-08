// Resumo da corrida (decisões 4 e 6, 08/10/2026): métricas principais uma vez no topo, o resto em seções
// recolhíveis sem perder dados; corrida salva tem "Excluir atividade" (com confirmação) e fechar mantém salva.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');
const w = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  const key = await page.evaluate(() => Object.keys(state.corridaProgress).find(k => state.corridaProgress[k] && state.corridaProgress[k].gpsRunId));
  await page.evaluate((k) => abrirResumoCorrida(k), key); await w(1500);
  const r = await page.evaluate(() => {
    const topo = document.querySelector('.fr-summets');
    const det = [...document.querySelectorAll('details.fr-det')];
    det.forEach(d => { d.open = true; });
    const tudo = document.querySelector('.gps-sum').textContent;
    return {
      topo: topo ? [...topo.querySelectorAll('.k')].map(x => x.textContent) : [],
      metricasForaDoTopo: [...document.querySelectorAll('.gps-sum-main, .gps-sum-sec')].length,
      secoes: det.map(d => d.querySelector('summary').textContent.trim()),
      conteudo: ['Parciais', 'Planejado × Realizado', 'Avaliação do treino', 'No próximo treino', 'Ganho de elevação'].filter(t => tudo.includes(t)),
      descartar: !!document.getElementById('gpsBtnDescartarRun'),
      excluir: (document.getElementById('gpsBtnDeleteRun') || {}).textContent,
    };
  });
  ok(r.topo.join() === 'Distância,Tempo,Ritmo' || r.topo.join() === 'Distância,Tempo,Ritmo,Em movimento', 'métricas principais uma vez no topo (' + r.topo.join(', ') + ')');
  ok(r.metricasForaDoTopo === 0, 'sem a segunda linha de métricas repetidas');
  ok(r.secoes.length === 2 && r.conteudo.length >= 4, 'parciais, planejado × realizado e análise em seções recolhíveis (' + r.conteudo.join(', ') + ')');
  ok(!r.descartar && r.excluir === 'Excluir atividade', 'corrida salva tem "Excluir atividade" no lugar de "Descartar"');
  await page.evaluate(() => document.getElementById('gpsBtnDeleteRun').click()); await w(300);
  const conf = await page.evaluate(() => document.querySelector('.sheet').textContent);
  ok(/Excluir esta atividade\?/.test(conf) && /recordes/.test(conf) && /Não dá para desfazer/.test(conf), 'confirmação explícita ao excluir');
  await page.evaluate(() => document.getElementById('cfCancel').click()); await w(200);
  await page.evaluate(() => document.getElementById('gpsBtnCloseSummary2').click()); await w(300);
  ok(await page.evaluate((k) => !state.gpsRun && !!(state.corridaProgress[k] && state.corridaProgress[k].done && state.corridaProgress[k].gpsRunId), key), 'sair do resumo mantém a atividade salva');
  ok(!app.erros.length, 'sem erro na página' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
