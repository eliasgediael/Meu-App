// Segunda chance da IA: quando a validação do app reprova a resposta, a IA recebe a lista de erros e corrige uma vez.
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade } = require('../harness/ia.js');
const { criarRefinador, conferirPedido, ErroFuncao } = require('../../functions/src/refinar.js');

(async () => {
  const T = await carregarAppComIA();
  const p = await prepararPerfil(T, '08');
  const semana = T.gerarPlanoSemanal(p, {}).semana;
  const ctx = T.iaContextoDoMotor(p, {}, semana);
  const c = T.iaContextoCorridaV2(ctx);
  const certa = { ...respostaIdentidade(T, semana.muscPlan, ctx), versao: '2', corrida: Object.entries(c.dias).map(([dia, x]) => ({ dia, opcao: x.motorId, mobilidade: [], educativos: [], alongamentos: [], strides: 0, stridesFim: 0, progressao: 'manter' })) };
  const errada = JSON.parse(JSON.stringify(certa)); errada.corrida.pop();      // R1: dia de corrida ausente
  T.IA_CONFIG.ativa = true;
  const base = { perfil: p, opcoes: {}, semanaMotor: semana, online: true, usuario: { uid: 'ficticio' } };

  // 1) errada na primeira, certa depois do reparo
  let pedidos = [];
  let r = await T.iaRefinarSemanaV2({ ...base, chamarFuncao: async (pedido) => { pedidos.push(pedido); return { resposta: pedidos.length === 1 ? errada : certa }; } });
  ok(r.origem === 'ia' && r.motivo === 'ok_reparada', `reparo: a segunda resposta aceita vira a semana (${r.origem}/${r.motivo})`);
  ok(pedidos.length === 2 && !('reparo' in pedidos[0]) && pedidos[1].reparo && Array.isArray(pedidos[1].reparo.erros) && pedidos[1].reparo.erros.length > 0, 'reparo: o segundo pedido leva os erros');
  ok(pedidos[1].reparo.erros.every(e => typeof e.cod === 'string' && typeof e.detalhe === 'string') && JSON.stringify(pedidos[1].reparo.anterior) === JSON.stringify(errada), 'reparo: erros com código e detalhe, mais a resposta anterior');
  ok(JSON.stringify(Object.keys(pedidos[1]).filter(k => k !== 'reparo').sort()) === JSON.stringify(Object.keys(pedidos[0]).sort()), 'reparo: o resto do pedido não muda');

  // 2) errada nas duas: o motor, sem terceira chamada
  pedidos = [];
  r = await T.iaRefinarSemanaV2({ ...base, chamarFuncao: async (pedido) => { pedidos.push(pedido); return { resposta: errada }; } });
  ok(r.origem === 'motor' && r.motivo === 'validacao_reprovada' && r.semana === semana && pedidos.length === 2, 'reparo: reprovada duas vezes fica no motor, no máximo duas chamadas');

  // 3) certa na primeira: uma chamada só
  pedidos = [];
  r = await T.iaRefinarSemanaV2({ ...base, chamarFuncao: async (pedido) => { pedidos.push(pedido); return { resposta: certa }; } });
  ok(r.origem === 'ia' && r.motivo === 'ok' && pedidos.length === 1, 'reparo: resposta certa de primeira não gasta segunda chamada');

  // 4) a segunda chamada falha (rede): motor
  pedidos = [];
  r = await T.iaRefinarSemanaV2({ ...base, chamarFuncao: async (pedido) => { pedidos.push(pedido); if (pedidos.length === 2) throw new Error('rede'); return { resposta: errada }; } });
  ok(r.origem === 'motor' && r.semana === semana, 'reparo: falha de rede na segunda chamada mantém o motor');

  // 5) servidor: o campo "reparo" é conferido
  const pedido = T.iaMontarPedidoV2(ctx, c, { perfil: p });
  const confere = (x) => { try { conferirPedido(x, 90000); return null; } catch (e) { return e instanceof ErroFuncao ? e.codigo : 'outro'; } };
  ok(confere(pedido) === null, 'servidor: pedido v2 comum continua aceito');
  ok(confere({ ...pedido, reparo: { erros: [{ cod: 'F5', detalhe: 'Ter: dois exercícios do mesmo movimento (supino)' }], anterior: errada } }) === null, 'servidor: pedido com reparo aceito');
  ok(confere({ ...pedido, reparo: { erros: [], anterior: 'x' } }) === 'invalid-argument', 'servidor: reparo sem resposta anterior em objeto é recusado');
  ok(confere({ ...pedido, reparo: { erros: [{ cod: 'F5' }], anterior: errada } }) === 'invalid-argument', 'servidor: erro sem detalhe é recusado');
  ok(confere({ ...pedido, reparo: { erros: Array(13).fill({ cod: 'F5', detalhe: 'x' }), anterior: errada } }) === 'invalid-argument', 'servidor: mais de 12 erros é recusado');
  ok(confere({ ...pedido, reparo: { erros: [{ cod: 'F5', detalhe: 'x'.repeat(300) }], anterior: errada } }) === 'invalid-argument', 'servidor: detalhe longo demais é recusado');
  ok(confere({ ...pedido, versaoContrato: '1', reparo: { erros: [], anterior: errada } }) !== null, 'servidor: reparo só existe no contrato v2');
  ok(confere({ ...pedido, outro: 1 }) === 'invalid-argument', 'servidor: campo desconhecido continua recusado');
  semErro();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERRO ' + e.stack); process.exitCode = 1; });
