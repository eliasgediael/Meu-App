// Musculação: sugestão de carga/repetições para a próxima série a partir do histórico. Movido sem alterações (Bloco 2).
/* eslint-disable */
// 1ª vez no exercício: usa a meta (carga/reps sugeridas por outra parte do sistema). Da 2ª vez em diante,
// puxa a última carga realizada e aplica progressão dupla: sobe a carga quando TODAS as séries bateram a
// meta de reps E o esforço (PSE, 1-10) não estava no limite; mantém quando ficou na média; reduz quando o
// PSE veio muito alto ou as reps ficaram bem abaixo da meta — nunca sobe sozinho quando a pessoa forçou
// demais ou não completou a série. PSE é opcional: sem ele, cai no critério antigo (só reps).
function suggestedForExercise(ex){
  const hist = cargaHistFor(ex);
  const metaReps = parseFloat(ex.reps) || 0;
  if(!hist) return { peso: ex.carga || 0, reps: ex.reps || 0, direction:null, motivo:null };
  const last = hist[hist.length-1];
  const lastSets = last && last.sets && last.sets.length ? last.sets
    : (last && last.carga!=null && last.carga!=='' ? [{ peso:last.carga, reps:ex.reps }] : null);
  if(!lastSets || !lastSets.length) return { peso: ex.carga || 0, reps: ex.reps || 0, direction:null, motivo:null };
  // Ponto de partida é sempre a PRIMEIRA série registrada (não a mais pesada) — numa pirâmide
  // ascendente, começar já pela série mais pesada bagunça os ajustes de +/- daí pra frente.
  const firstPeso = parseFloat(lastSets[0].peso) || 0;
  const firstReps = lastSets[0].reps || ex.reps || metaReps;
  if(last.data === todayISO()){
    // Já editado/registrado hoje — retoma exatamente esse valor. A sugestão de progressão é
    // pra sessão seguinte, não faz sentido recalcular em cima do que você acabou de digitar agora.
    return { peso: firstPeso || ex.carga || 0, reps: firstReps, direction:null, motivo:null };
  }
  const allMetTarget = lastSets.every(s => (parseFloat(s.reps)||0) >= metaReps);
  const avgReps = lastSets.reduce((s,x)=>s+(parseFloat(x.reps)||0),0)/lastSets.length;
  const pseVals = lastSets.map(s=>parseFloat(s.pse)).filter(v=>!isNaN(v));
  const avgPse = pseVals.length ? pseVals.reduce((a,b)=>a+b,0)/pseVals.length : null;
  let direction = 'manter', motivo = 'Repetiu a mesma carga da última vez.', nextPeso = firstPeso;
  if(avgPse!=null && avgPse>=9){
    direction = 'reduzir'; motivo = 'O esforço (PSE) ficou muito alto na última vez — reduzindo a carga.';
    nextPeso = Math.round(firstPeso*0.90*2)/2;
  }else if(avgReps < metaReps*0.8){
    direction = 'reduzir'; motivo = 'Ficou bem abaixo da meta de reps na última vez — reduzindo a carga.';
    nextPeso = Math.round(firstPeso*0.90*2)/2;
  }else if(allMetTarget && (avgPse==null || avgPse<=8)){
    direction = 'subir'; motivo = avgPse!=null ? 'Bateu a meta com esforço controlado — hora de subir.' : 'Bateu a meta de reps na última vez.';
    nextPeso = Math.round(firstPeso*1.025*2)/2;
  }else{
    motivo = 'Quase lá — mantendo a carga por mais uma sessão.';
  }
  // Musculação dentro do plano híbrido: perna não sobe carga quando a semana de corrida está pesada
  // (treino forte de corrida hoje/amanhã ou carga alta nas pernas).
  if(direction==='subir' && ex.grupo==='Pernas' && interferenciaCorridaNasPernas()){
    direction = 'manter'; nextPeso = firstPeso;
    motivo = 'Semana de corrida pesada: mantendo a carga das pernas por enquanto.';
  }
  return { peso: nextPeso || ex.carga || 0, reps: ex.reps || metaReps, direction, motivo };
}

// O app (script principal) e os testes usam estes nomes como globais.
Object.assign(globalThis, {
  suggestedForExercise,
});
