// Corrida ou atividade sem gravação neste aparelho (resumo não abre): tocar em "Últimas atividades" oferece
// excluir o registro (08/10/2026).
const { carregarApp, espera, ok, semErro } = require('../harness/carregar.js');
(async () => {
  const T = await carregarApp(['state', 'abrirAtividadeDaLista', 'listarAtividades', 'atividadesLivres', 'saveAtividades']);
  const S = T.state;
  S.corridaProgress['Dom 04/10'] = { done: true, km: '3.2', tempo: '18:00', data: '2026-10-04', gpsRunId: 'run_1759600000000' };
  S.atividadesLivres = [{ id: 'run:run_1759500000000', tipo: 'corrida', livre: true, data: '2026-10-03', distKm: 2, tempoSeg: 600, gpsRunId: 'run_1759500000000' }];
  await T.saveAtividades();
  const ids = T.listarAtividades().map(a => a.id);
  ok(ids.includes('run:run_1759600000000') && ids.includes('run:run_1759500000000'), 'as duas aparecem nas últimas atividades');
  await T.abrirAtividadeDaLista('run:run_1759600000000'); await espera(200);
  ok(!S.corridaProgress['Dom 04/10'], 'corrida do plano sem gravação excluída');
  await T.abrirAtividadeDaLista('run:run_1759500000000'); await espera(200);
  ok(!T.atividadesLivres().some(a => a.id === 'run:run_1759500000000'), 'atividade livre sem gravação excluída');
  ok(!T.listarAtividades().some(a => /1759[56]00000000/.test(a.id)), 'somem das últimas atividades');
  semErro();
})();
