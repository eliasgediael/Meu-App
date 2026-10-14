const fs=require('fs'),path=require('path');
const {ok}=require('../harness/carregar.js');
const {carregarAppComIA,prepararPerfil,respostaIdentidade}=require('../harness/ia.js');
(async()=>{
  const T=await carregarAppComIA(), exemplos=[];
  for(const n of ['01','08','10']) {
    const p=await prepararPerfil(T,n), w=T.gerarPlanoSemanal(p,{}).semana,ctx=T.iaContextoDoMotor(p,{},w),c=T.iaContextoCorridaV2(ctx);
    const resp={...respostaIdentidade(T,w.muscPlan,ctx),versao:'2',corrida:Object.entries(c.dias).map(([dia,x])=>({dia,opcao:x.motorId,mobilidade:[],educativos:[],alongamentos:[],strides:0,stridesFim:0,progressao:'manter'}))};
    resp.dias.forEach(d=>d.exercicios.forEach(e=>{e.rpe=Math.max(5,e.rpe-1);}));resp.motivos=['reduz_volume_recuperacao'];
    let val=T.iaValidarPropostaV2(ctx,c,resp);
    ok(val.ok,'exemplo '+n+': proposta simulada válida');
    for(const [dia,dc] of Object.entries(c.dias)) {
      let achou=false;
      for(const id of dc.menu) {
        if(id===dc.motorId || !dc.montadas[id])continue;
        const tentativa=JSON.parse(JSON.stringify(resp));Object.assign(tentativa.corrida.find(x=>x.dia===dia),{opcao:id},globalThis.iaV2Escolhas(dc.montadas[id]));
        const v=T.iaValidarPropostaV2(ctx,c,tentativa);
        if(v.ok){Object.assign(resp,tentativa);val=v;achou=true;break;}
      }
      if(achou)break;
    }
    const semana=T.iaMontarSemanaFinalV2(ctx,c,w,val);
    exemplos.push({perfil:'Fictício '+n,nivelCorrida:ctx.est.capacidade.corrida,nivelForca:ctx.est.capacidade.musc,fonte:'Motor V2 + proposta simulada validada; nenhuma chamada real ao Gemini',
      corrida:semana.corridaWeek.map(d=>({dia:d.day,tipo:d.type,opcao:val.corrida.escolhidas[d.day],minutos:d.totalMin,km:d.totalKm,principal:d.mainDesc,pace:d.mainPace,aquecimento:d.warmupDesc,desaquecimento:d.cooldownDesc})),
      musculacao:Object.entries(semana.muscPlan).map(([dia,exercicios])=>({dia,exercicios:exercicios.map(e=>({nome:e.nome,series:e.series,reps:e.reps,rpe:e.rpe,descanso:e.descanso,carga:e.carga}))}))});
  }
  fs.writeFileSync(path.resolve('docs/ia-v2-exemplos.json'),JSON.stringify(exemplos,null,2)+'\n');
})().catch(e=>{console.log('FAIL '+e.stack);process.exitCode=1;});
