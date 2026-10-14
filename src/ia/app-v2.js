/* Integração assíncrona: a semana do motor já está disponível antes de qualquer leitura GPS/rede. */
import { IA_CONFIG } from './config.js';
import { iaRefinarSemanaV2, iaPersonalizacaoLigada } from './refino-v2.js';
import { iaCriarChamadaServidor } from './servidor.js';
import { iaColetarHistoricoCorrida, iaResumoCorrida } from './historico-corrida.js';
import { iaClone } from './contrato.js';
import { iaComTimeout } from './refino.js';

const IA_CAMPOS_ATOMICOS = ['hybridPlanData','treinos','musculacao','muscDayOrigin'];
function iaRetratoApp(s){
  return JSON.stringify({ dia:todayISO(), campos:IA_CAMPOS_ATOMICOS.map(k=>s[k]), perfil:s.athleteProfile, corrida:s.corridaProgress,
    checkin:s.checkinDiario, doms:s.domsPernas, ajuste:s.muscAjuste, log:s.workoutSessionsLog,
    usuario:s.authUser && s.authUser.uid });
}
function iaTreinoIniciado(s){
  return !!(s.workoutSession || (s.gpsRun && s.gpsRun.status!=='finished') ||
    Object.values(s.musculacao || {}).some(l=>l.some(e=>e.done)));
}
function iaAgendaDoMotorIntacta(s,w){
  for(const [d,lista] of Object.entries(w.muscPlan || {})) {
    const atual=s.musculacao[d] || [];
    if(atual.length!==lista.length || (s.muscDayOrigin || {})[d]) return false;
    for(let i=0;i<lista.length;i++) {
      const campos=new Set([...Object.keys(atual[i]),...Object.keys(lista[i])]);
      for(const k of campos) if(k!=='id' && k!=='done' && JSON.stringify(atual[i][k])!==JSON.stringify(lista[i][k])) return false;
    }
  }
  const hp=s.hybridPlanData, monday=new Date(hp.startMonday+'T00:00:00');monday.setDate(monday.getDate()+(w.weekNumber-1)*7);
  for(const c of w.corridaWeek || []) {
    const dt=new Date(monday);dt.setDate(dt.getDate()+DAY_ABBR.indexOf(c.day));
    const key=c.day+' '+vdotFormatDDMM(dt), atual=s.treinos.find(t=>t.day===key);
    if(!atual) { if(hp.inicioPlano && vdotISODate(dt)<hp.inicioPlano)continue;return false; }
    for(const k of ['type','mainDesc','mainPace','totalKm','totalMin','steps','gpsSteps']) if(JSON.stringify(atual[k] || null)!==JSON.stringify(c[k] || null))return false;
  }
  return true;
}
async function iaLerHistoricoGPS(dados, lerRun){
  const copia = iaClone(dados), gpsRuns = {};
  const ids = [...new Set(Object.values(copia.corridaProgress || {}).filter(p=>p && p.done && p.gpsRunId).map(p=>p.gpsRunId))];
  await Promise.all(ids.map(async id=>{ try { const r = await lerRun(id); if(r) gpsRuns[id] = { etapas_executadas:r.etapas_executadas }; } catch(e) { /* ausência de GPS não inventa execução */ } }));
  return iaResumoCorrida(iaColetarHistoricoCorrida({...copia,gpsRuns}));
}
// Preparação pura: nenhum campo da semana é aplicado antes de montar corrida E musculação.
function iaPrepararSemanaAtomica(s, semana){
  const hp = iaClone(s.hybridPlanData), n=hp.currentWeekIndex;
  if(!semana || semana.weekNumber!==n) throw Error('semana_mudou');
  const monday = new Date(hp.startMonday+'T00:00:00'); monday.setDate(monday.getDate()+(n-1)*7);
  const keys = DAY_ABBR.map((d,i)=>{ const dt=new Date(monday); dt.setDate(dt.getDate()+i); return d+' '+vdotFormatDDMM(dt); });
  if(keys.some(k=>s.corridaProgress && s.corridaProgress[k])) throw Error('corrida_iniciada_ou_concluida');
  const treinos = iaClone(s.treinos).filter(t=>!keys.includes(t.day));
  for(const w of semana.corridaWeek || []) {
    const old = s.treinos.find(t=>t.day===keys[DAY_ABBR.indexOf(w.day)]);
    if(!old) continue; // semana parcial: nunca cria sessão em dia passado
    treinos.push({...iaClone(old), ...iaClone(w), day:old.day});
  }
  const musculacao=iaClone(s.musculacao), muscDayOrigin=iaClone(s.muscDayOrigin || {});
  for(const d of Object.keys(semana.muscPlan || {})) {
    if(muscDayOrigin[d]) throw Error('treino_manual');
    musculacao[d]=semana.muscPlan[d].map((e,i)=>({...iaClone(e),id:(s.musculacao[d] || [])[i]?.id || 'ia_'+Date.now()+'_'+i,done:false}));
  }
  hp.plan[n-1]=iaClone(semana);
  return { hybridPlanData:hp,treinos,musculacao,muscDayOrigin };
}
function iaChaveAtomica(s){ return 'forza:iaSemanaAtomica:'+String(s.authUser && s.authUser.uid || 'sem-conta'); }
function iaCommitSemanaAtomica(s, antes, candidato, armazenamento){
  if(iaRetratoApp(s)!==antes || iaTreinoIniciado(s)) return false;
  const registro={ versao:2, dia:todayISO(), perfil:JSON.stringify(s.athleteProfile), progresso:JSON.stringify(s.corridaProgress), antes:Object.fromEntries(IA_CAMPOS_ATOMICOS.map(k=>[k,s[k]])), depois:candidato };
  // Um único setItem síncrono: se quota/armazenamento falhar, não muda nenhum campo do app.
  armazenamento.setItem(iaChaveAtomica(s),JSON.stringify(registro));
  Object.assign(s,candidato); // sem await: as duas modalidades mudam no mesmo turno
  return true;
}
function iaRecuperarSemanaAtomica(s, armazenamento){
  try {
    const r=JSON.parse(armazenamento.getItem(iaChaveAtomica(s)) || 'null');
    if(!r || r.versao!==2 || r.dia!==todayISO() || r.perfil!==JSON.stringify(s.athleteProfile) || r.progresso!==JSON.stringify(s.corridaProgress) || iaTreinoIniciado(s)) return false;
    if(!IA_CAMPOS_ATOMICOS.every(k=>JSON.stringify(s[k])===JSON.stringify(r.antes[k]) || JSON.stringify(s[k])===JSON.stringify(r.depois[k]))) return false;
    Object.assign(s,iaClone(r.depois)); return true;
  } catch(e) { return false; }
}
async function iaPersistirSemanaApp(){ await Promise.all([saveTreinos(),saveMusc(),saveMuscDayOrigin(),saveHybridPlanData()]); }
let iaPedidoEmCurso=0;
async function iaPersonalizarSemanaApp(semanaMotor, opcoes, perfilMotor){
  if(!IA_CONFIG.ativa || !IA_CONFIG.publicacaoAutorizada || !iaPersonalizacaoLigada(state.athleteProfile)) return {origem:'motor',motivo:'ia_desligada'};
  if(!state.authUser || state.viewingClient || !navigator.onLine || !IA_CONFIG.servidorUrl || iaTreinoIniciado(state)) return {origem:'motor',motivo:'indisponivel'};
  const seq=++iaPedidoEmCurso, antes=iaRetratoApp(state), hp=state.hybridPlanData;
  if(!hp || hp.pausa || !hp.motorV2 || hp.plan[hp.currentWeekIndex-1]!==semanaMotor) return {origem:'motor',motivo:'semana_mudou'};
  if(!iaAgendaDoMotorIntacta(state,semanaMotor)) return {origem:'motor',motivo:'usuario_alterou'};
  try {
    const dados={ treinos:state.treinos,corridaProgress:state.corridaProgress,checkins:hp.checkins,checkinsSemanais:hp.checkinsSemanais,checkinDiario:state.checkinDiario,atividadesLivres:state.atividadesLivres,pausa:hp.pausa,hoje:todayISO() };
    const historicoCorrida=await iaComTimeout(iaLerHistoricoGPS(dados,gpsDbGet),IA_CONFIG.timeoutMs);
    if(seq!==iaPedidoEmCurso || antes!==iaRetratoApp(state)) return {origem:'motor',motivo:'estado_mudou'};
    const r=await iaRefinarSemanaV2({perfil:perfilMotor || iaClone(state.athleteProfile),opcoes,semanaMotor,historicoCorrida,
      historico:{historicoCarga:state.historicoCarga,checkins:hp.checkins},online:navigator.onLine,usuario:state.authUser,
      chamarFuncao:iaCriarChamadaServidor({url:IA_CONFIG.servidorUrl,obterToken:()=>auth.currentUser.getIdToken()})});
    if(r.origem!=='ia') return r;
    if(!IA_CONFIG.ativa || !IA_CONFIG.publicacaoAutorizada || !iaPersonalizacaoLigada(state.athleteProfile) || seq!==iaPedidoEmCurso) return {origem:'motor',motivo:'cancelado'};
    const candidato=iaPrepararSemanaAtomica(state,r.semana);
    if(!iaCommitSemanaAtomica(state,antes,candidato,localStorage)) return {origem:'motor',motivo:'estado_mudou'};
    await iaPersistirSemanaApp();
    if(typeof render==='function') render();
    return r;
  } catch(e) { return {origem:'motor',motivo:'fallback_app'}; }
}
export { iaLerHistoricoGPS,iaRetratoApp,iaTreinoIniciado,iaAgendaDoMotorIntacta,iaPrepararSemanaAtomica,iaCommitSemanaAtomica,iaRecuperarSemanaAtomica,iaPersonalizarSemanaApp,iaPersistirSemanaApp };
