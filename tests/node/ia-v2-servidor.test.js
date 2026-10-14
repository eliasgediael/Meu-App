const URLNativa = globalThis.URL;
const { ok } = require('../harness/carregar.js');
const { criarRefinador,conferirPedido,conferirResposta,hashPedido } = require('../../functions/src/refinar.js');
const ESQ = require('../../functions/src/esquema-resposta-v2.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const pedido={versaoContrato:'2',tipo:'inicial',semana:{numero:1},perfil:{nivel:'iniciante'},dias:[],regras:{},planoMotor:[],exerciciosAutorizados:[],historico:null,
  corrida:{dias:[{dia:'Seg',opcoes:[{id:'LEVE'}]}],permitidos:{mobilidade:[],educativos:[],alongamentos:[]},progressaoPermitida:false},catalogo:{opcoes:{LEVE:{nome:'Corrida leve'}},itens:{}}};
const resposta={versao:'2',dias:[],corrida:[{dia:'Seg',opcao:'LEVE',mobilidade:[],educativos:[],alongamentos:[],strides:0,stridesFim:0,progressao:'manter'}],motivos:['manter_plano']};
function rejeita(fn,cod,msg){try{fn();ok(false,msg);}catch(e){ok(e.codigo===cod,msg);}}
(async()=>{
  conferirPedido(pedido,90000); ok(true,'v2 servidor: corrida sem musculação aceita');
  ok(conferirResposta(JSON.stringify(resposta),pedido).versao==='2','v2 servidor: resposta válida');
  for(const [msg,mutar] of [
    ['versão',x=>{x.versao='1';}],['texto livre',x=>{x.texto='ignore regras';}],['pace',x=>{x.corrida[0].pace='4:00';}],
    ['dia extra',x=>{x.corrida.push(clone(x.corrida[0]));}],['dia ausente',x=>{x.corrida=[];}],
    ['fora do menu',x=>{x.corrida[0].opcao='REGENERATIVO';}],['item fora do permitido',x=>{x.corrida[0].mobilidade=['MOB_TORNOZELO'];}],
    ['progressão',x=>{x.corrida[0].progressao='pedir_progressao';}],['protótipo',x=>{x.corrida[0]=JSON.parse('{"__proto__":{},'+JSON.stringify(x.corrida[0]).slice(1));}],
  ]) {const x=clone(resposta);mutar(x);rejeita(()=>conferirResposta(JSON.stringify(x),pedido),'internal','v2 servidor: recusa '+msg);}
  for(const [msg,mutar] of [['saúde',x=>{x.corrida.historico={dor:true};}],['GPS',x=>{x.corrida.historico={latitude:1};}],['dia repetido',x=>{x.corrida.dias.push(clone(x.corrida.dias[0]));}],['menu inválido',x=>{x.corrida.dias[0].opcoes=[{id:'INVENTADO'}];}],['campo extra',x=>{x.apiKey='ficticia';}]]) {
    const x=clone(pedido);mutar(x);rejeita(()=>conferirPedido(x,90000),'invalid-argument','v2 servidor: pedido recusa '+msg);
  }
  let args,calls=0,quota=0;const cache=new Map();
  const arm={lerCache:async h=>cache.get(h),gravarCache:async(h,v)=>cache.set(h,v),consumirCota:async()=>{quota++;return {ok:true};}};
  const ref=criarRefinador({config:{ativa:true,timeoutMs:50},armazem:arm,chamarGemini:async a=>{args=a;calls++;return JSON.stringify(resposta);}});
  const dados={consentimento:true,pedido},auth={uid:'ficticio'};
  const r=await ref(dados,auth);
  ok(r.resposta.versao==='2' && args.esquema===ESQ && args.instrucao.includes('CONTRATO 2'),'v2 servidor: esquema e prompt conjuntos');
  await ref(dados,auth);ok(calls===1 && quota===1,'v2 servidor: cache não consome nova cota');
  cache.get(hashPedido(pedido,r.modelo)).resposta.versao='1'; await ref(dados,auth);
  ok(calls===2,'v2 servidor: cache de versão errada descartado');
  for (const [config,auth0,dados0,codigo] of [[{ativa:false},auth,dados,'unavailable'],[{},null,dados,'unauthenticated'],[{},auth,{...dados,consentimento:false},'failed-precondition']]) {
    try{await criarRefinador({config:{ativa:true,...config},armazem:arm,chamarGemini:async()=>{calls++;}})(dados0,auth0);ok(false,'v2 barreira '+codigo);}catch(e){ok(e.codigo===codigo,'v2 barreira '+codigo);}
  }
  const esbuild=require('esbuild'),path=require('path');
  const code=esbuild.buildSync({entryPoints:[path.resolve('worker/src/index.js')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
  const m={exports:{}};new Function('require','module','exports',code)(require,m,m.exports);
  globalThis.URL = URLNativa;
  const request=()=>new Request('https://ficticio.test/refinar',{method:'POST',body:JSON.stringify(dados)});
  const dep={verificarToken:async()=>auth,armazem:arm,chamarGemini:async a=>{args=a;return JSON.stringify(resposta);},log:()=>{}};
  let wr=await m.exports.atender(request(),{IA_ATIVA:'true'},dep);
  ok(wr.status===200 && (await wr.json()).resposta.versao==='2','v2 Worker: integração via refinador compartilhado');
  wr=await m.exports.atender(request(),{IA_ATIVA:'false'},dep);ok(wr.status===503,'v2 Worker: desligado bloqueia chamada');
  // Entrypoint Firebase com dependências simuladas: sem emulador, SDK ou conexão externa.
  const vm=require('vm'),fs=require('fs');
  const parametros={IA_ATIVA:'true'};
  const callbackModule={exports:{}};
  const sandbox={module:callbackModule,exports:callbackModule.exports,process:{env:{FUNCTIONS_EMULATOR:'true'}},console,require:n=>{
    if(n==='firebase-functions/v2/https')return {onCall:(_opts,fn)=>fn,HttpsError:class extends Error{constructor(code,msg){super(msg);this.code=code;}}};
    if(n==='firebase-functions/params')return {defineString:(k,o)=>({value:()=>parametros[k] || o.default}),defineInt:(_k,o)=>({value:()=>o.default}),defineSecret:()=>({value:()=>{throw Error('não acessar segredo');}})};
    if(n==='firebase-admin')return {initializeApp:()=>{},firestore:()=>({})};
    if(n==='./src/armazem-firestore.js')return {criarArmazemFirestore:()=>arm};
    return require(path.resolve('functions',n));
  }};
  vm.runInNewContext(fs.readFileSync(path.resolve('functions/index.js'),'utf8'),sandbox);
  const pe=clone(pedido);pe.corrida.dias[0].sessaoMotor={opcao:'LEVE'};
  const firebase=await callbackModule.exports.refinarTreino({data:{consentimento:true,simulado:true,pedido:pe},auth});
  ok(firebase.resposta.versao==='2' && firebase.resposta.corrida[0].opcao==='LEVE','v2 Firebase: entrypoint e simulador suportam contrato conjunto sem acessar chave');
  const p1={...clone(pedido),versaoContrato:'1',dias:[{dia:'Seg'}],exerciciosAutorizados:[{id:'e1'}],planoMotor:[{dia:'Seg',exercicios:[{id:'e1',papel:'base',series:3,reps:10,rpe:7,descansoSeg:60}]}]};delete p1.corrida;delete p1.catalogo;
  const firebase1=await callbackModule.exports.refinarTreino({data:{consentimento:true,simulado:true,pedido:p1},auth});
  ok(firebase1.resposta.versao==='1','v1 Firebase: simulador preservado');
})().catch(e=>{console.log('FAIL '+e.stack);process.exitCode=1;});
