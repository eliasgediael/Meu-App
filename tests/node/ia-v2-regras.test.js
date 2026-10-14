const {ok,semErro}=require('../harness/carregar.js');
const {carregarAppComIA,prepararPerfil,respostaIdentidade}=require('../harness/ia.js');
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
  const T=await carregarAppComIA(), p=await prepararPerfil(T,'08'), w=T.gerarPlanoSemanal(p,{}).semana;
  const ctx=T.iaContextoDoMotor(p,{},w), c=T.iaContextoCorridaV2(ctx);
  const r={...respostaIdentidade(T,w.muscPlan,ctx),versao:'2',corrida:Object.entries(c.dias).map(([dia,x])=>({dia,opcao:x.motorId,mobilidade:[],educativos:[],alongamentos:[],strides:0,stridesFim:0,progressao:'manter'}))};
  const leve=r.corrida.find(x=>c.dias[x.dia].cdia.tipoDia==='leve');
  const longa=r.corrida.find(x=>c.dias[x.dia].cdia.tipoDia==='longa');
  ok(!!leve && !!longa,'v2 regras: perfil com rodagem e longão');
  function recusa(codigo,resp=r,contexto=ctx,corrida=c){const v=T.iaValidarPropostaV2(contexto,corrida,resp);ok(!v.ok && v.erros.some(e=>e.cod===codigo),`v2 regras ${codigo}: ${JSON.stringify(v.erros)}`);}
  let x=clone(r);x.corrida.find(d=>d.dia===leve.dia).opcao='LONGO';recusa('R2',x);
  x=clone(r);x.corrida[0].mobilidade=['tornozelo','tornozelo'];recusa('R3',x);
  x=clone(r);x.corrida.forEach(d=>{if(c.dias[d.dia].cdia.tipoDia==='leve')d.opcao='REGENERATIVO';});
  recusa('R4',x,ctx,{...c,reduzidoPorCheckin:true});
  x=clone(r);x.corrida[0].progressao='pedir_progressao';recusa('R2',x,ctx,{...c,progressaoPermitida:false});
  x=clone(r);x.corrida.find(d=>d.dia===leve.dia).stridesFim=4;
  const c7={...c,dias:{...c.dias,[leve.dia]:{...c.dias[leve.dia],cdia:{...c.dias[leve.dia].cdia,vesperaDeQualidade:true}}}};
  recusa('R7',x,ctx,c7);
  x=clone(r);x.corrida.find(d=>d.dia===longa.dia).opcao='LEVE';
  const c9={...c,dias:{...c.dias,[longa.dia]:{...c.dias[longa.dia],menu:[...c.dias[longa.dia].menu,'LEVE']}}};
  recusa('R9',x,ctx,c9);
  x=clone(r);x.corrida.find(d=>d.dia===leve.dia).opcao='I_400';
  const c8={...c,dias:{...c.dias,[leve.dia]:{...c.dias[leve.dia],menu:[...c.dias[leve.dia].menu,'I_400']}}};
  const ctx8={...ctx,est:{...ctx.est,capacidade:{...ctx.est.capacidade,corrida:'iniciante'}}};
  const erros8=[];T.iaValidarCorridaV2(ctx8,c8,x.corrida,(cod,detalhe)=>erros8.push({cod,detalhe}));
  ok(erros8.some(e=>e.cod==='R8'),'v2 regras R8: defesa do nível/regime mesmo com menu corrompido');
  // Falhas internas do montador: defesa em profundidade, sem alterar o motor de produção.
  const montar=globalThis.corridaMontarOpcao;
  const sessao=montar(ctx.est,'LEVE',c.dias[leve.dia].cdia,{mobilidade:['tornozelo'],educativos:[],alongamentos:[],strides:0,stridesFim:0});
  ok(!!sessao,'v2 regras: sessão real montada para testes de coerência');
  x=clone(r);x.corrida.find(d=>d.dia===leve.dia).mobilidade=['tornozelo'];
  if(sessao) for(const [cod,mutar] of [
    ['R3',s=>{s.totalMin=999;}],['R4',s=>{s.totalMin+=1;}],['R5',s=>{s.cargaIntensa=999;}],
    ['R6',s=>{s.blocos[0].min+=10;}],['R6',s=>{s.totalKm+=2;}],['R6',s=>{s.gpsSteps[0].metaSeg+=600;}],
    ['R6',s=>{s.gpsSteps.find(g=>g.pace).pace='1:00–1:05/km';}],
  ]) {
    globalThis.corridaMontarOpcao=()=>{const s=clone(sessao);mutar(s);return s;};
    try{recusa(cod,x);}finally{globalThis.corridaMontarOpcao=montar;}
  }
  x=clone(r);x.dias.forEach(d=>{d.exercicios.forEach(e=>{e.series=Math.max(2,e.series-1);});});
  recusa('J1',x,ctx,{...c,reduzidoPorCheckin:true});
  const validar=globalThis.validarPlano;
  let validacoes=0;
  globalThis.validarPlano=(...args)=>++validacoes===1 ? validar(...args) : ({ok:false,erros:[{cod:'V9',detalhe:'conflito simulado'}],avisos:[]});
  try{const v=T.iaValidarPropostaV2(ctx,c,r);ok(!v.ok && v.erros.some(e=>/V9/.test(e.detalhe)),'v2 regras: validação final da semana conjunta obrigatória');}finally{globalThis.validarPlano=validar;}
  for(const bruto of [null,[],42,'{', 'x'.repeat(30001),{...r,corrida:null},{...r,versao:'1'}]) {
    const v=T.iaValidarPropostaV2(ctx,c,bruto);ok(!v.ok,'v2 regras: rejeita estrutura inválida');
  }
  const hist={checkinsSemanais:[{dor:true,fadiga:2}],checkinDiario14dias:{dorForte:3,energiaBaixa:2}};
  const ped=T.iaMontarPedidoV2(ctx,c,{perfil:p,historicoCorrida:hist});
  ok(!/"(dor|dorForte|regioesDeDor)"/.test(JSON.stringify(ped)) && hist.checkinsSemanais[0].dor,'v2 regras: saúde removida só do pedido, histórico local preservado');
  let aceitas=0,rejeitadas=0;
  for(const [dia,dc] of Object.entries(c.dias)) for(const id of dc.menu) {
    if(id===dc.motorId)continue;
    const s=dc.montadas[id]; if(!s)continue;
    const resp=clone(r), escolha=resp.corrida.find(d=>d.dia===dia);
    Object.assign(escolha,{opcao:id},globalThis.iaV2Escolhas(s));
    const v=T.iaValidarPropostaV2(ctx,c,resp);
    if(v.ok){aceitas++;const final=T.iaMontarSemanaFinalV2(ctx,c,w,v);ok(final.corridaWeek.find(d=>d.day===dia).opcao===id && JSON.stringify(final.sessoes)===JSON.stringify(v.semanaConjunta.sessoes),'v2 regras: alternativa segura aplicada com metadados coerentes '+id);}else{rejeitadas++;ok(v.erros.length>0,'v2 regras: alternativa insegura rejeitada '+id);}
  }
  ok(aceitas>0,`v2 regras: menus exercitados (${aceitas} aceitas, ${rejeitadas} rejeitadas)`);
  semErro();
})().catch(e=>{console.log('FAIL '+e.stack);process.exitCode=1;});
