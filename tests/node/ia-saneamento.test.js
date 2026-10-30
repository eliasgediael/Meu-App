// Saneamento: dois movimentos iguais no mesmo dia (erro F5 mais comum da IA) voltam ao exercício do motor em vez de reprovar a semana.
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade, PERFIS } = require('../harness/ia.js');

(async () => {
  const T = await carregarAppComIA();
  let casos = 0, reprovadasAntes = 0, aceitasDepois = 0, intactas = 0;
  for (const [nome] of PERFIS) {
    const n = nome.slice(0, 2), p = await prepararPerfil(T, n);
    const semana = T.gerarPlanoSemanal(p, {}).semana;
    const ctx = T.iaContextoDoMotor(p, {}, semana);
    if (!ctx.ok || !Object.keys(ctx.muscServido || {}).length) continue;
    const c = T.iaContextoCorridaV2(ctx);
    const base = { ...respostaIdentidade(T, semana.muscPlan, ctx), versao: '2', corrida: Object.entries(c.dias).map(([dia, x]) => ({ dia, opcao: x.motorId, mobilidade: [], educativos: [], alongamentos: [], strides: 0, stridesFim: 0, progressao: 'manter' })) };
    ok(JSON.stringify(T.iaSanearFamilias(ctx, base)) === JSON.stringify(base), `${n}: resposta sem repetição passa intacta`);
    intactas++;
    // injeta, no primeiro dia, um exercício autorizado da MESMA família de um exercício do dia que o motor não usa
    const dia = base.dias[0], doMotor = ctx.muscServido[dia.dia];
    const fam = (id) => ctx.autorizados.porId.get(id).familia;
    const alvo = dia.exercicios.find(x => doMotor.filter(e => ctx.autorizados.porId.get(ctx.autorizados.chavePorNome.get(e.nome)).familia === fam(x.id)).length === 1);
    if (!alvo) continue;
    const intruso = [...ctx.autorizados.porId.values()].find(it => it.familia === fam(alvo.id) && !dia.exercicios.some(x => x.id === (ctx.autorizados.chavePorNome.get(it.nome))));
    if (!intruso) continue;
    const id = ctx.autorizados.chavePorNome.get(intruso.nome);
    const ruim = JSON.parse(JSON.stringify(base));
    ruim.dias[0].exercicios.push({ id, papel: 'isolado', series: 3, reps: 12, rpe: 7, descansoSeg: 60 });
    const antes = T.iaValidarPropostaV2(ctx, c, ruim);
    const saneada = T.iaSanearFamilias(ctx, ruim);
    const depois = T.iaValidarPropostaV2(ctx, c, saneada);
    casos++;
    if (!antes.ok && antes.erros.some(e => e.cod === 'F5')) reprovadasAntes++;
    if (depois.ok) aceitasDepois++;
    ok(!saneada.dias[0].exercicios.some(x => x.id === id), `${n}: o exercício repetido (${intruso.nome}) sai da lista`);
    ok(saneada.dias[0].exercicios.length <= base.dias[0].exercicios.length, `${n}: o dia não ganha exercícios`);
    ok(JSON.stringify(saneada.corrida) === JSON.stringify(ruim.corrida), `${n}: a corrida não é tocada`);
  }
  ok(casos >= 6, `saneamento: ${casos} perfis com repetição injetada`);
  ok(reprovadasAntes === casos, `saneamento: sem ele, ${reprovadasAntes} de ${casos} semanas seriam reprovadas por F5`);
  ok(aceitasDepois === casos, `saneamento: com ele, ${aceitasDepois} de ${casos} passam nos validadores`);
  semErro();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERRO ' + e.stack); process.exitCode = 1; });
