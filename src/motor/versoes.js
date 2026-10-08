// Versões do plano (regras aprovadas pelo usuário em 07/10/2026):
// - guarda TODAS as versões relevantes, sem limite silencioso: antes de refazer/revisar o plano, de um ajuste do
//   check-in, de mover sessões, de restaurar e (nas próximas etapas) de pausa, lesões e encerramento;
// - cada versão tem data/hora, versão do motor, motivo, origem e resumo; guarda só o PLANEJAMENTO (plano, agenda
//   da semana, respostas do questionário que geraram o plano), nunca atividades, recordes, check-ins ou histórico;
// - restaurar troca só o planejamento de hoje em diante: dias passados, atividades, recordes, check-ins, histórico,
//   tênis, carga e progresso não mudam; o plano em uso vira uma versão antes (dá para desfazer) e o histórico
//   registra "Versão anterior restaurada";
// - a contagem de semanas segue a data de início da versão restaurada (decisão 4A).
// Armazenamento: um índice leve ("planoVersoes") e uma chave por versão ("planoVersao_<id>"), para nenhuma chave
// passar do limite de tamanho da nuvem.

const VERSOES_FORMATO = 1;
const VERSOES_INDICE = 'planoVersoes';
const versaoChave = (id)=>'planoVersao_' + id;
// Campos do plano que são HISTÓRICO (não voltam numa restauração).
const VERSOES_CAMPOS_HISTORICO = ['checkinsSemanais', 'decisoesSemanais', 'overlaysSemana', 'conflitosMantidos', 'checkins', 'checkinDetails', 'pausas'];

const clonarJson = (o)=> o==null ? o : JSON.parse(JSON.stringify(o));
function versoesDoPlano(){ return state.planoVersoes || (state.planoVersoes = []); }
async function carregarVersoesPlano(){
  try{
    const r = await window.storage.get(VERSOES_INDICE, false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    state.planoVersoes = Array.isArray(v) ? v : [];
  }catch(e){ state.planoVersoes = []; }
}
async function saveVersoesIndice(){ try{ await window.storage.set(VERSOES_INDICE, JSON.stringify(versoesDoPlano()), false); }catch(e){} }

function resumoDoPlano(hp){
  if(!hp || !hp.plan || !hp.plan.length) return 'Sem plano';
  const partes = [`${hp.plan.length} semanas`];
  if(hp.currentWeekIndex) partes.push(`na semana ${hp.currentWeekIndex}`);
  const w = hp.plan[(hp.currentWeekIndex || 1) - 1];
  if(w && !w.pendente){
    const nC = (w.corridaWeek || []).length, nM = Object.keys(w.muscPlan || {}).filter(d=>(w.muscPlan[d] || []).length).length;
    partes.push(`${nC} corrida${nC===1?'':'s'} e ${nM} treino${nM===1?'':'s'} de força por semana`);
  }
  return partes.join(' · ');
}
function temPlanoParaVersionar(){ const hp = state.hybridPlanData; return !!(hp && hp.plan && hp.plan.length && hp.motorV2); }

// Fotografa o planejamento atual. A cópia é feita na hora da chamada (antes da mudança); a gravação é assíncrona.
function guardarVersaoDoPlano(motivo, origem){
  if(!temPlanoParaVersionar()) return Promise.resolve(null);
  const agora = new Date();
  const hp = clonarJson(state.hybridPlanData);
  const perfil = clonarJson(state.athleteProfile || null);
  if(perfil) delete perfil.identidade;   // dados pessoais nunca voltam numa restauração
  const meta = { id: agora.getTime().toString(36) + Math.random().toString(36).slice(2, 6), formato:VERSOES_FORMATO,
    em: agora.getTime(), data: todayISO(), hora: String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0'),
    engineVersion: hp.engineVersion || (typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null),
    motivo: motivo || 'Mudança no plano', origem: origem || 'outro', resumo: resumoDoPlano(hp), startMonday: hp.startMonday || null };
  const snap = { ...meta, hp, perfil, musculacao: clonarJson(state.musculacao || {}), muscDayOrigin: clonarJson(state.muscDayOrigin || {}) };
  versoesDoPlano().unshift(meta);
  return (async ()=>{
    try{ await window.storage.set(versaoChave(meta.id), JSON.stringify(snap), false); }catch(e){}
    await saveVersoesIndice();
    return meta;
  })();
}
async function lerVersaoDoPlano(id){
  try{ const r = await window.storage.get(versaoChave(id), false); return r && r.value ? JSON.parse(r.value) : null; }catch(e){ return null; }
}
function rotuloVersao(m){ const p = String(m.data || '').split('-'); return (p.length===3 ? p[2] + '/' + p[1] : m.data) + (m.hora ? ' ' + m.hora : ''); }

// Coloca na agenda a semana atual do plano restaurado, só de hoje em diante. Dias passados, sessões já feitas
// (corrida concluída ou musculação com exercício marcado) e treinos manuais ficam como estavam.
function rematerializarSemanaAtual(semanaPronta){
  const hp = state.hybridPlanData;
  const hoje = todayISO(), hi = hojeIdx();
  const seg = segundaAtual(), segISO = vdotISODate(seg);
  const n = semanaDoPlanoPara(hp.startMonday, seg);
  const isoDe = (t)=>isoDaChaveDia(t.day, hoje);
  const feitoCorrida = (t)=>{ const p = (state.corridaProgress || {})[t.day]; return !!(p && (p===true || p.done)); };
  const datasSemana = new Set(DAY_ABBR.map(d=>chaveDiaAtual(d)));
  const preservarTreinos = (state.treinos || []).filter(t=>datasSemana.has(t.day) && ((isoDe(t) || hoje) < hoje || feitoCorrida(t)));
  const preservarMusc = {};
  DAY_ABBR.forEach((d, i)=>{ const l = (state.musculacao || {})[d]; if(l && (i < hi || l.some(e=>e.done) || (state.muscDayOrigin || {})[d])) preservarMusc[d] = l; });
  let week = semanaPronta || ((n>=1 && n<=hp.plan.length) ? hp.plan[n-1] : null);
  if(week && week.pendente){ const g = gerarSemanaV2(n); if(g) week = hp.plan[n-1] = g; }
  if(week && !week.pendente){
    const diasAntes = Object.keys(state.musculacao || {}).filter(d=>!preservarMusc[d]);
    materializeHybridWeekIntoState(week, hp.startMonday, diasAntes, hoje);
    hp.currentWeekIndex = n; hp.materializadaSeg = segISO;
    try{ hp.estados = estadosDaSemana(n, week.phaseLabel); }catch(e){}
  }else{
    // Fora do período da versão: tira só o planejado não feito de hoje em diante.
    state.treinos = (state.treinos || []).filter(t=>!(datasSemana.has(t.day) && (isoDe(t) || hoje) >= hoje && !feitoCorrida(t)));
    DAY_ABBR.forEach((d, i)=>{ if(i >= hi && !preservarMusc[d]) delete state.musculacao[d]; });
    hp.materializadaSeg = segISO;
  }
  // devolve o que precisava ficar
  state.treinos = state.treinos.filter(t=>!preservarTreinos.some(p=>p.day===t.day)).concat(preservarTreinos);
  Object.assign(state.musculacao, preservarMusc);
  saveTreinos(); saveMusc(); saveMuscDayOrigin();
}

async function restaurarVersaoDoPlano(id){
  const snap = await lerVersaoDoPlano(id);
  if(!snap || !snap.hp || !snap.hp.plan) return false;
  await guardarVersaoDoPlano('Antes de restaurar a versão de ' + rotuloVersao(snap), 'restauracao');
  const atual = state.hybridPlanData || {};
  const hp = clonarJson(snap.hp);
  VERSOES_CAMPOS_HISTORICO.forEach(k=>{ if(atual[k]!==undefined) hp[k] = clonarJson(atual[k]); else delete hp[k]; });
  // Pausa ativa é estado de agora, não da versão: continua valendo depois de restaurar.
  if(atual.pausa) hp.pausa = clonarJson(atual.pausa); else delete hp.pausa;
  if(snap.perfil){
    const ident = state.athleteProfile && state.athleteProfile.identidade;
    state.athleteProfile = { ...clonarJson(snap.perfil), identidade: clonarJson(ident) || (state.athleteProfile && state.athleteProfile.identidade) };
    if(!state.athleteProfile.identidade) state.athleteProfile.identidade = criarAthleteProfile().identidade;
    if(state.athleteProfile.meta) state.athleteProfile.meta.atualizadoEm = athleteAgora();
    await salvarAthleteProfile();
  }
  state.hybridPlanData = hp;
  try{ Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]); }catch(e){}
  if(hp.pausa) limparPlanejadoDesdeHoje(); else rematerializarSemanaAtual();
  await saveHybridPlanData();
  registrarNoDiario({ alteracao:'Versão anterior restaurada', original:'', novo:resumoDoPlano(hp), motivo:'versão de ' + rotuloVersao(snap) + ' · ' + snap.motivo });
  return true;
}

// Chaves de versões para backup, migração para a nuvem e "apagar tudo".
function chavesDasVersoes(){ return versoesDoPlano().map(m=>versaoChave(m.id)); }

Object.assign(globalThis, {
  VERSOES_FORMATO, VERSOES_INDICE, VERSOES_CAMPOS_HISTORICO, versoesDoPlano, carregarVersoesPlano, saveVersoesIndice, resumoDoPlano,
  guardarVersaoDoPlano, lerVersaoDoPlano, rotuloVersao, rematerializarSemanaAtual, restaurarVersaoDoPlano, chavesDasVersoes, versaoChave,
});
