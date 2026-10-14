// Contrato v2 (Etapa 3): personalização CONJUNTA de corrida e musculação. O v1 (só musculação) continua igual.
//
// Pedido v2 = pedido v1 (musculação: mesmos campos, mesma minimização) + seção "corrida":
//   perfil de corrida (nível, regime, prova, semanas até a prova, fase, origem do VDOT), ajustes que o motor JÁ aplicou
//   (para a IA não reduzir duas vezes), se progressão pode ser pedida, e para cada dia de corrida do motor o MENU
//   fechado de opções do catálogo (src/motor/corrida-catalogo.js), já montadas pelo motor (minutos, km, carga, texto do
//   principal com o pace calculado) e os itens de aquecimento/alongamento permitidos para a pessoa; + resumo do
//   histórico de corrida (src/ia/historico-corrida.js).
// A IA só escolhe códigos (opção do menu e ids de itens). Pace, distância, duração e carga são sempre do motor.
// Dados de saúde (regiões de dor) nunca vão no v2: o motor já os aplicou nos menus (decisão do usuário, opção A).
/* eslint-disable */
import { iaMontarPedido, IA_DIAS } from './contrato.js';

const IA_V2_VERSAO = '2';

// O resumo local pode conter saúde; o contrato externo v2 nunca a inclui.
function iaHistoricoCorridaSemSaude(h){
  if(!h) return null;
  const out = JSON.parse(JSON.stringify(h));
  if(out.checkinsSemanais) out.checkinsSemanais.forEach(c=>{ delete c.dor; });
  if(out.checkinDiario14dias) delete out.checkinDiario14dias.dorForte;
  return out;
}

// Ajustes que vieram de fora do motor (check-in, pausa, lesão) e já reduziram a semana.
function iaV2ReduzidoPorCheckin(opcoes){
  const a = opcoes && opcoes.ajustesIniciais;
  return !!(a && ((a.volumeFator && a.volumeFator<1) || a.semQualidade || a.aliviarInferior || a.reduzir>0));
}

// Contexto da corrida sobre o contexto do motor (iaContextoDoMotor). Determinístico.
function iaContextoCorridaV2(ctx){
  const est = ctx.est;
  const dias = {};
  const corridaWeek = (ctx.semana && ctx.semana.corridaWeek) || [];
  for(const w of corridaWeek){
    const cdia = corridaContextoDoDia(est, ctx.semana, w.day, ctx.ajustes);
    if(!cdia) return { ok:false, motivo:'corrida_contexto' };
    const menu = corridaOpcoesDoDia(est, cdia);
    const motorId = CORRIDA_OPCAO_DO_MOTOR[cdia.tipoDia];
    if(!menu.includes(motorId)) menu.unshift(motorId);       // a sessão do motor é sempre uma opção válida
    const montadas = {};
    menu.forEach(id=>{ montadas[id] = id===motorId ? null : corridaMontarOpcao(est, id, cdia); });
    dias[w.day] = { cdia, menu, motorId, montadas };
  }
  const reduzido = iaV2ReduzidoPorCheckin(ctx.opcoes);
  const progressaoPermitida = est.recuperacao.prontidao==='normal' && !est.restricoes.temDorRelevante && !est.conservador
    && !(ctx.ajustes && ctx.ajustes.semProgressao) && !reduzido && !(est.calibracao && est.calibracao.corrida);
  return { ok:true, dias, permitidos:corridaItensPermitidos(est), reduzidoPorCheckin:reduzido, progressaoPermitida };
}

function iaV2MuscNoDia(ctx, d){
  const s = (ctx.semana.sessoes || []).find(x=>x.dia===d && x.modalidade==='musculacao');
  return s ? s.tipo : null;
}
function iaV2Escolhas(s){
  const b = (s && s.blocos) || [];
  const ids = (fase, grupo)=>b.filter(x=>x.fase===fase).flatMap(x=>(x.itens || []).filter(i=>!grupo || i.grupo===grupo).map(i=>i.id));
  const nStr = (onde)=>{ const x = b.find(y=>y.fase==='strides' && y.onde===onde); return x ? Math.round(x.min*60/(CORRIDA_STRIDES.seg + CORRIDA_STRIDES.recSeg)) : 0; };
  return { mobilidade:ids('preparacao', 'mobilidade'), educativos:ids('preparacao', 'educativos'), alongamentos:ids('alongamento'), strides:nStr('inicio'), stridesFim:nStr('fim') };
}

// Pedido v2. opcoes: { perfil, historico (musculação, como no v1), historicoCorrida (iaResumoCorrida), tipo }
function iaMontarPedidoV2(ctx, ctxC, opcoes){
  opcoes = opcoes || {};
  const base = iaMontarPedido(ctx, { ...opcoes, perfil:opcoes.perfil });
  delete base.perfil.regioesDeDor;                            // v2: nunca dado de saúde
  const est = ctx.est, c = est.corrida;
  const usados = new Set();
  const dias = Object.keys(ctxC.dias).sort((a, b)=>IA_DIAS.indexOf(a) - IA_DIAS.indexOf(b)).map(d=>{
    const x = ctxC.dias[d], cd = x.cdia, w = cd.sessaoMotor;
    const opcoesDia = x.menu.map(id=>{
      usados.add(id);
      if(id===x.motorId) return { id, min:w.totalMin, km:w.totalKm, carga:cd.ref.carga, principal:w.mainDesc || '', padrao:{ mobilidade:[], educativos:[], alongamentos:[], strides:0, stridesFim:0 } };
      const s = x.montadas[id];
      return { id, min:s.totalMin, km:s.totalKm, carga:s.cargaIntensa, principal:s.mainDesc, padrao:iaV2Escolhas(s) };
    });
    return { dia:d, tipoDia:cd.tipoDia, sessaoMotor:{ opcao:x.motorId, tipo:w.type, min:w.totalMin, km:w.totalKm, carga:cd.ref.carga },
      musculacaoNoDia:iaV2MuscNoDia(ctx, d), pernaPesadaNaVespera:!!cd.aposPernaPesada, vesperaDeQualidade:!!cd.vesperaDeQualidade, opcoes:opcoesDia };
  });
  const P = ctxC.permitidos;
  const catalogo = {
    opcoes:Object.fromEntries([...usados].sort().map(id=>{ const o = CORRIDA_OPCOES[id]; return [id, { nome:o.nome, familia:o.familia, dia:o.dia }]; })),
    itens:Object.fromEntries([...P.mobilidade.map(i=>[i, CORRIDA_MOBILIDADE[i].nome]), ...P.educativos.map(i=>[i, CORRIDA_EDUCATIVOS[i].nome]), ...P.alongamentos.map(i=>[i, CORRIDA_ALONGAMENTOS[i].nome])]),
  };
  const aj = ctx.ajustes || {};
  return {
    ...base,
    versaoContrato:IA_V2_VERSAO,
    corrida:{
      perfil:{ nivel:est.capacidade.corrida, regime:c.regime, prova:est.objetivo.tipo==='prova' ? c.goalKey : null, semanasAteProva:est.objetivo.semanasAteProva,
        fase:base.semana.fase, vdotFonte:c.vdotFonte || null, objetivo:est.objetivo.tipo || null },
      ajustesJaAplicados:{ volumeFator:aj.volumeFator || 1, semQualidade:!!aj.semQualidade, aliviarInferior:!!aj.aliviarInferior, reduzidoPorCheckin:ctxC.reduzidoPorCheckin },
      progressaoPermitida:ctxC.progressaoPermitida,
      permitidos:{ mobilidade:P.mobilidade, educativos:P.educativos, alongamentos:P.alongamentos, strides:P.strides },
      dias,
      historico:iaHistoricoCorridaSemSaude(opcoes.historicoCorrida),
    },
    catalogo,
  };
}

export { IA_V2_VERSAO, iaV2ReduzidoPorCheckin, iaContextoCorridaV2, iaMontarPedidoV2, iaV2Escolhas };
