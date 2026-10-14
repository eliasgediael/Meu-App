const {ok,semErro}=require('../harness/carregar.js');
const {carregarAppComIA,prepararPerfil}=require('../harness/ia.js');
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
  const T=await carregarAppComIA(['todayISO','auth']); await prepararPerfil(T,'08');
  const S=T.state, w=S.hybridPlanData.plan[0];
  S.authUser={uid:'ficticio'}; S.workoutSession=null; S.gpsRun=null; S.corridaProgress={};
  const antes=globalThis.iaRetratoApp(S), frozen=JSON.stringify(S);
  const candidato=globalThis.iaPrepararSemanaAtomica(S,{...clone(w),iaRefino:{versaoContrato:'2'}});
  ok(JSON.stringify(S)===frozen,'v2 app: preparar semana não altera estado');
  const mem=new Map(), storage={setItem:(k,v)=>mem.set(k,v),getItem:k=>mem.get(k)};
  const bad=clone(S); bad.treinos[0].totalKm+=1;
  ok(!globalThis.iaCommitSemanaAtomica(bad,antes,candidato,storage),'v2 app: corrida editada bloqueia resposta tardia');
  const erroStore={setItem:()=>{throw Error('quota');}};
  try{globalThis.iaCommitSemanaAtomica(S,antes,candidato,erroStore);}catch(e){}
  ok(JSON.stringify(S)===frozen,'v2 app: falha de armazenamento não aplica nenhuma modalidade');
  ok(globalThis.iaCommitSemanaAtomica(S,antes,candidato,storage),'v2 app: commit integral');
  ok(S.hybridPlanData===candidato.hybridPlanData && S.treinos===candidato.treinos && S.musculacao===candidato.musculacao,'v2 app: plano e ambas as agendas aplicados juntos');
  const parcial=JSON.parse(frozen); parcial.hybridPlanData=clone(candidato.hybridPlanData);
  ok(globalThis.iaRecuperarSemanaAtomica(parcial,storage) && JSON.stringify(parcial.treinos)===JSON.stringify(candidato.treinos),'v2 app: recuperação de persistência parcial');
  const editado=JSON.parse(frozen); editado.musculacao[Object.keys(editado.musculacao)[0]][0].reps='999';
  ok(!globalThis.iaRecuperarSemanaAtomica(editado,storage),'v2 app: recuperação não sobrescreve edição do usuário');
  const outra=JSON.parse(frozen); outra.authUser.uid='outra';
  ok(!globalThis.iaRecuperarSemanaAtomica(outra,storage),'v2 app: registro isolado por conta');
  for(const campo of ['workoutSession','gpsRun']) {
    const active=JSON.parse(frozen);active[campo]={status:'paused'};
    ok(globalThis.iaTreinoIniciado(active),'v2 app: '+campo+' em andamento bloqueia aplicação');
  }
  const p=JSON.parse(frozen); const day=Object.keys(p.musculacao)[0]; p.musculacao[day][0].done=true;
  ok(globalThis.iaTreinoIniciado(p),'v2 app: musculação concluída bloqueia aplicação');
  const dados={hoje:T.todayISO(),treinos:[],corridaProgress:{a:{done:true,gpsRunId:'run_1'},b:{done:true,gpsRunId:'run_1'},c:{done:true,gpsRunId:'run_2'},d:{done:false,gpsRunId:'run_3'}}};
  let ids=[];const h=await globalThis.iaLerHistoricoGPS(dados,async id=>{ids.push(id);if(id==='run_2')throw Error('db');return {pontos:[{lat:1}],etapas_executadas:[]};});
  ok(ids.sort().join()==='run_1,run_2','v2 app: GPS assíncrono lê só ids concluídos únicos');
  ok(h.status==='sem_dados' && !JSON.stringify(h).includes('lat'),'v2 app: GPS ausente não inventa treino nem envia pontos');
  let chamadas=0; const antiga=globalThis.gpsDbGet; globalThis.gpsDbGet=async()=>{chamadas++;};
  T.IA_CONFIG.ativa=true;T.IA_CONFIG.publicacaoAutorizada=false;
  const r=await globalThis.iaPersonalizarSemanaApp(S.hybridPlanData.plan[0],{});
  ok(r.motivo==='ia_desligada' && chamadas===0,'v2 app: sem publicação autorizada nem lê GPS/chama servidor');
  globalThis.gpsDbGet=antiga;T.IA_CONFIG.ativa=false;
  // Fluxo concreto do app com rede simulada: GPS -> pedido -> validação -> commit -> persistência.
  const fetchOriginal=globalThis.fetch;
  const responder=pedido=>({versao:'2',dias:pedido.planoMotor,corrida:pedido.corrida.dias.map(d=>({dia:d.dia,opcao:d.sessaoMotor.opcao,mobilidade:[],educativos:[],alongamentos:[],strides:0,stridesFim:0,progressao:'manter'})),motivos:['manter_plano']});
  T.auth.currentUser={getIdToken:async()=> 'token-ficticio'};
  T.IA_CONFIG.ativa=true;T.IA_CONFIG.publicacaoAutorizada=true;T.IA_CONFIG.servidorUrl='https://ficticio.test';navigator.onLine=true;
  let ultimoPedido;
  globalThis.fetch=async(u,init)=>{ultimoPedido=JSON.parse(init.body).pedido;return {ok:true,json:async()=>({resposta:responder(ultimoPedido)})};};
  await prepararPerfil(T,'08');S.authUser={uid:'ficticio'};
  const sucesso=await globalThis.iaPersonalizarSemanaApp(S.hybridPlanData.plan[0],{});
  ok(sucesso.origem==='ia' && S.hybridPlanData.plan[0].iaRefino.versaoContrato==='2','v2 app: fluxo completo aplica semana validada');
  ok(ultimoPedido.versaoContrato==='2' && !/"(dor|dorForte|regioesDeDor|latitude|longitude)"/.test(JSON.stringify(ultimoPedido)),'v2 app: fluxo completo minimiza pedido conjunto');
  for(const [nome,mudar] of [
    ['edição de corrida',()=>{S.treinos[0].totalKm+=1;}],
    ['edição de musculação',()=>{S.musculacao[Object.keys(S.musculacao)[0]][0].reps='19';}],
    ['treino iniciado',()=>{S.workoutSession={phase:'exercise'};}],
    ['troca de conta',()=>{S.authUser={uid:'outra'};}],
    ['desligou personalização',()=>{S.athleteProfile.meta.personalizacaoIA=false;}],
  ]) {
    S.workoutSession=null;await prepararPerfil(T,'08');S.authUser={uid:'ficticio'};
    let liberar,chegou;const recebida=new Promise(r=>{chegou=r;});
    globalThis.fetch=(u,init)=>new Promise(resolve=>{const ped=JSON.parse(init.body).pedido;liberar=()=>resolve({ok:true,json:async()=>({resposta:responder(ped)})});chegou();});
    const pendente=globalThis.iaPersonalizarSemanaApp(S.hybridPlanData.plan[0],{});
    await recebida;mudar();const foto=globalThis.iaRetratoApp(S);liberar();const rr=await pendente;
    ok(rr.origem==='motor' && globalThis.iaRetratoApp(S)===foto,'v2 app: resposta tardia preserva '+nome);
  }
  S.workoutSession=null;await prepararPerfil(T,'08');S.authUser={uid:'ficticio'};
  const baseMotor=globalThis.iaRetratoApp(S);
  globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({erro:{codigo:'resource-exhausted'}})});
  const cota=await globalThis.iaPersonalizarSemanaApp(S.hybridPlanData.plan[0],{});
  ok(cota.origem==='motor' && globalThis.iaRetratoApp(S)===baseMotor,'v2 app: cota esgotada mantém ambas modalidades');
  S.musculacao[Object.keys(S.musculacao)[0]][0].carga='20';
  const cargaAntes=globalThis.iaRetratoApp(S);let tentativas=0;globalThis.fetch=async()=>{tentativas++;throw Error('não deve chamar');};
  const editadoAntes=await globalThis.iaPersonalizarSemanaApp(S.hybridPlanData.plan[0],{});
  ok(editadoAntes.motivo==='usuario_alterou' && tentativas===0 && globalThis.iaRetratoApp(S)===cargaAntes,'v2 app: preserva carga/edição anterior ao pedido');
  globalThis.fetch=fetchOriginal;T.IA_CONFIG.ativa=false;T.IA_CONFIG.publicacaoAutorizada=false;T.IA_CONFIG.servidorUrl='';
  semErro();
})().catch(e=>{console.log('FAIL '+e.stack);process.exitCode=1;});
