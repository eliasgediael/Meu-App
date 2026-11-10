// Musculação: sugestão de carga/repetições para a próxima série a partir do histórico. Movido sem alterações (Bloco 2).
/* eslint-disable */
// 1ª vez no exercício: usa a meta (carga/reps sugeridas por outra parte do sistema). Da 2ª vez em diante,
// puxa a última carga realizada e aplica dupla progressão (motorProgressaoDupla): sobe a carga quando a ÚLTIMA série
// bateu o topo da faixa de reps no RPE alvo ou abaixo; reduz quando ficou abaixo do mínimo; senão mantém. Sempre com motivo.
function suggestedForExercise(ex){
  const hist = cargaHistFor(ex);
  const metaReps = parseFloat(ex.reps) || 0;
  if(!hist) return { peso: ex.carga || 0, reps: ex.reps || 0, direction:null, motivo:null, reasonCode:'sem_historico' };
  const last = hist[hist.length-1];
  const lastSets = last && last.sets && last.sets.length ? last.sets
    : (last && last.carga!=null && last.carga!=='' ? [{ peso:last.carga, reps:ex.reps }] : null);
  if(!lastSets || !lastSets.length) return { peso: ex.carga || 0, reps: ex.reps || 0, direction:null, motivo:null, reasonCode:'sem_series' };
  // Ponto de partida é sempre a PRIMEIRA série registrada (não a mais pesada) — numa pirâmide
  // ascendente, começar já pela série mais pesada bagunça os ajustes de +/- daí pra frente.
  const firstPeso = parseFloat(lastSets[0].peso) || 0;
  const firstReps = lastSets[0].reps || ex.reps || metaReps;
  if(last.data === todayISO()){
    // Já editado/registrado hoje — retoma exatamente esse valor. A sugestão de progressão é
    // pra sessão seguinte, não faz sentido recalcular em cima do que você acabou de digitar agora.
    return { peso: firstPeso || ex.carga || 0, reps: firstReps, direction:null, motivo:null, reasonCode:'registrado_hoje' };
  }
  // Dupla progressão (progressao-dupla.js): topo da faixa de reps na última série, no RPE alvo ou abaixo, sobe a carga;
  // abaixo do mínimo reduz; senão mantém. O motivo vem em português.
  const dp = motorProgressaoDupla(ex, lastSets);
  let direction = dp.direction, motivo = dp.motivo, nextPeso = dp.peso, reasonCode = dp.reasonCode;
  // Musculação dentro do plano híbrido: perna não sobe carga quando a semana de corrida está pesada
  // (treino forte de corrida hoje/amanhã ou carga alta nas pernas).
  if(direction==='subir' && ex.grupo==='Pernas' && interferenciaCorridaNasPernas()){
    direction = 'manter'; nextPeso = firstPeso;
    motivo = 'Semana de corrida pesada: mantendo a carga das pernas por enquanto.'; reasonCode = 'pernas_semana_corrida_pesada';
  }
  return { peso: nextPeso || ex.carga || 0, reps: ex.reps || metaReps, direction, motivo, reasonCode };
}

// Estado de progressão por exercício (ProgressionDecision): a decisão usada em cada sessão, com o motivo
// (reasonCode), a evidência (datas do histórico usadas) e a versão do motor. Mesmo resultado da sugestão acima.
const ACAO_DA_DIRECAO = { subir:'increase', manter:'maintain', reduzir:'reduce' };
function decisaoDeProgressao(ex){
  const s = suggestedForExercise(ex);
  const hist = cargaHistFor(ex) || [];
  const action = !hist.length || s.reasonCode==='sem_series' ? 'introduce' : (ACAO_DA_DIRECAO[s.direction] || 'maintain');
  return { exerciseId: ex.repdbId || null, nome: ex.nome, suggestedLoad: parseFloat(s.peso) || 0, targetReps: s.reps, action,
    reasonCode: s.reasonCode, evidencia: hist.slice(-1).map(h=>h.data), engineVersion: (typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null) };
}
async function saveProgressaoExercicios(){ try{ await window.storage.set('progressaoExercicios', JSON.stringify(state.progressaoExercicios||{}), false); }catch(e){} }
// Registra a decisão de cada exercício no início da sessão (é a que vale para aquela execução).
function registrarDecisoesDaSessao(lista){
  state.progressaoExercicios = state.progressaoExercicios || {};
  (lista||[]).forEach(ex=>{ const k = ex.repdbId || ex.nome; if(k) state.progressaoExercicios[k] = { ...decisaoDeProgressao(ex), data:todayISO() }; });
  saveProgressaoExercicios();
}

// O app (script principal) e os testes usam estes nomes como globais.
Object.assign(globalThis, {
  suggestedForExercise, ACAO_DA_DIRECAO, decisaoDeProgressao, saveProgressaoExercicios, registrarDecisoesDaSessao,
});
