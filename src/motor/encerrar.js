// Encerrar plano e fim natural do plano (regras aprovadas pelo usuário em 07/10/2026, item 5 do relatório):
// - encerrar tira só o planejado de hoje em diante; dias passados, atividades e histórico ficam; o plano vira uma
//   versão (origem "encerrado"), então pode ser restaurado; o Início volta para "Você ainda não tem um plano";
// - quando a última semana termina, o Início mostra "Plano concluído" com o resumo do período e duas opções:
//   "Criar próximo plano" (questionário já preenchido) ou "Agora não" (o plano é arquivado como versão).
// A musculação do plano é guardada por dia da semana (se repete toda semana), então sai inteira da agenda;
// os treinos feitos continuam no histórico e no Progresso.

function limparMusculacaoDoPlano(){
  DAY_ABBR.forEach(d=>{ if(!(state.muscDayOrigin || {})[d]) delete state.musculacao[d]; });
  saveMusc();
}
async function arquivarPlano(motivo, origem, rotuloDiario){
  const hp = state.hybridPlanData;
  if(!hp || !hp.plan || !hp.plan.length) return false;
  await guardarVersaoDoPlano(motivo, origem);
  limparPlanejadoDesdeHoje();
  limparMusculacaoDoPlano();
  const resumo = resumoDoPlano(hp);
  state.hybridPlanData = null;
  await saveHybridPlanData();
  registrarNoDiario({ alteracao:rotuloDiario, original:resumo, novo:'sem plano', motivo:motivo.toLowerCase() });
  return true;
}
function encerrarPlano(){ return arquivarPlano('Plano encerrado', 'encerrado', 'Plano encerrado'); }
function planoConcluido(){ const hp = state.hybridPlanData; return !!(hp && hp.plan && hp.plan.length && hp.concluido); }
// Chamado pelo avanço de semana quando a data passou da última semana do plano.
async function marcarPlanoConcluido(segISO){
  const hp = state.hybridPlanData;
  if(hp.concluido) return;
  hp.concluido = { data:todayISO(), semana:segISO };
  limparMusculacaoDoPlano();   // senão a última semana de musculação se repetiria sem plano
  await saveHybridPlanData();
  registrarNoDiario({ alteracao:'Plano concluído', original:resumoDoPlano(hp), novo:'', motivo:'fim do plano' });
}
// Resumo do período do plano: só atividades ligadas ao plano, registradas de verdade.
function resumoPlanoConcluido(){
  const hp = state.hybridPlanData; if(!hp) return null;
  const ini = hp.inicioPlano || hp.startMonday || '';
  const doPlano = listarAtividades().filter(a=>!a.livre && a.data && a.data >= ini);
  const corridas = doPlano.filter(a=>a.tipo==='corrida'), forca = doPlano.filter(a=>a.tipo==='musculacao');
  const km = corridas.reduce((t, a)=>t + (a.distKm || 0), 0);
  return { semanas:hp.plan.length, corridas:corridas.length, forca:forca.length, km };
}
function dispensarPlanoConcluido(){ return arquivarPlano('Plano concluído', 'concluido', 'Plano arquivado'); }

Object.assign(globalThis, { limparMusculacaoDoPlano, arquivarPlano, encerrarPlano, planoConcluido, marcarPlanoConcluido, resumoPlanoConcluido, dispensarPlanoConcluido });
