const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade, PERFIS } = require('../harness/ia.js');
const clone = x => JSON.parse(JSON.stringify(x));
(async () => {
  const T = await carregarAppComIA();
  for (const [nome] of PERFIS) {
    const n = nome.slice(0, 2), p = await prepararPerfil(T, n);
    const semana = T.gerarPlanoSemanal(p, {}).semana;
    const ctx = T.iaContextoDoMotor(p, {}, semana);
    ok(ctx.ok, `v2 ${n}: contexto do motor (${ctx.motivo || 'ok'})`);
    if (!ctx.ok) continue;
    const c = T.iaContextoCorridaV2(ctx);
    const resp = { ...respostaIdentidade(T, semana.muscPlan, ctx), versao: '2', corrida: Object.entries(c.dias).map(([dia, x]) => ({ dia, opcao:x.motorId, mobilidade:[], educativos:[], alongamentos:[], strides:0, stridesFim:0, progressao:'manter' })) };
    const valid = T.iaValidarPropostaV2(ctx, c, resp);
    ok(valid.ok, `v2 ${n}: identidade F/R/V (${JSON.stringify(valid.erros)})`);
    const pedido = T.iaMontarPedidoV2(ctx, c, { perfil:p });
    ok(pedido.versaoContrato === '2' && !('regioesDeDor' in pedido.perfil), `v2 ${n}: contrato e minimização`);
    const antes = JSON.stringify(semana);
    const base = { perfil:p, opcoes:{}, semanaMotor:semana, online:true, usuario:{uid:'ficticio'}, chamarFuncao:async()=>({resposta:resp}) };
    T.IA_CONFIG.ativa = false;
    let r = await T.iaRefinarSemanaV2(base);
    ok(r.semana === semana && r.motivo === 'ia_desligada', `v2 ${n}: desligada por padrão`);
    T.IA_CONFIG.ativa = true;
    if (!ctx.est.cautela.temAlerta && !ctx.est.conservador) {
      r = await T.iaRefinarSemanaV2(base);
      ok(r.origem === 'ia', `v2 ${n}: orquestração (${r.motivo})`);
      for (const [rotulo, mutar, codigo] of [
        ['campo extra', x=>{x.pace='4:00';}, 'F0'],
        ['JSON inválido', ()=>'{', 'R0'],
        ['dia ausente', x=>{x.corrida.pop();}, 'R1'],
        ['opção inventada', x=>{if(x.corrida.length)x.corrida[0].opcao='INVENTADA';}, 'R0'],
        ['item proibido', x=>{if(x.corrida.length)x.corrida[0].mobilidade=['INVENTADO'];}, 'R0'],
        ['duplicar dia', x=>{if(x.corrida.length)x.corrida.push(clone(x.corrida[0]));}, 'R1'],
      ]) {
        if (!resp.corrida.length && !['campo extra','JSON inválido'].includes(rotulo)) continue;
        const bad = clone(resp); const bruto = mutar(bad) || bad;
        const v = T.iaValidarPropostaV2(ctx, c, bruto);
        ok(!v.ok && v.erros.some(e=>e.cod===codigo), `v2 ${n}: ${rotulo} (${JSON.stringify(v.erros)})`);
        const fallback = await T.iaRefinarSemanaV2({...base,chamarFuncao:async()=>({resposta:bruto})});
        ok(fallback.origem==='motor' && fallback.semana===semana, `v2 ${n}: fallback integral ${rotulo}`);
      }
      for (const extra of [{online:false},{usuario:null},{chamarFuncao:async()=>{throw Error('falha');}},{timeoutMs:5,chamarFuncao:()=>new Promise(()=>{})}]) {
        r = await T.iaRefinarSemanaV2({...base,...extra});
        ok(r.origem==='motor' && r.semana===semana, `v2 ${n}: falha de transporte preserva motor`);
      }
    }
    ok(JSON.stringify(semana)===antes, `v2 ${n}: motor intacto`);
  }
  T.IA_CONFIG.ativa=false;
  semErro();
})().catch(e=>{console.log('FAIL '+e.stack);process.exitCode=1;});
