// Pausar plano (regras aprovadas pelo usuário em 07/10/2026, decisões 1A e 2):
// - durante a pausa a semana não avança, os dias pausados não contam como perdidos e os check-ins (diário e
//   semanal) não são pedidos; atividades livres continuam podendo ser registradas;
// - retomar com até 14 dias: volta na mesma semana do plano em que parou (a data de início do plano anda junto);
// - retomar com mais de 14 dias: propõe uma semana de retorno mais leve, mostrando o plano atual e a proposta,
//   e só aplica depois da confirmação (15–28 dias: volume da corrida 80%, sem qualidade, uma série a menos na
//   musculação; mais de 28 dias: 70% e sugestão, não automática, de revisar o questionário);
// - pausa no meio da semana (1A): a semana recomeça no dia da volta só com as sessões que não tinham sido feitas
//   antes da pausa, redistribuídas nos dias que restam pelo mesmo motor (mesma regra da semana 1 criada no meio
//   da semana);
// - nunca mexe em atividades, histórico, recordes, tênis ou carga. Antes de pausar e de retomar, guarda versão.
// Não há regra de treino nova: a semana de retorno usa os ajustes que o motor já aceita (volumeFator,
// semQualidade, semProgressao), e a série a menos é aplicada depois da geração, como o fator de séries da fase.

const PAUSA_LIMITE_DIAS = 14;
const PAUSA_RETORNO = [
  { ateDias:28, volumeFator:0.8, sugerirQuestionario:false },
  { ateDias:Infinity, volumeFator:0.7, sugerirQuestionario:true },
];
const PAUSA_MOTIVOS = { viagem:'Viagem', doenca:'Doença', lesao:'Lesão', outro:'Outro' };

function planoPausado(){ const hp = state.hybridPlanData; return !!(hp && hp.plan && hp.plan.length && hp.pausa && hp.pausa.inicio); }
function diasDePausa(){ return planoPausado() ? Math.max(0, diasEntre(state.hybridPlanData.pausa.inicio, todayISO())) : 0; }
// Dia exibido (aba Treino/Início) cai dentro da pausa?
function diaPausado(d){
  if(!planoPausado()) return false;
  const m = displayedWeekMonday();
  const dt = new Date(m.getFullYear(), m.getMonth(), m.getDate() + DAY_ABBR.indexOf(d));
  return vdotISODate(dt) >= state.hybridPlanData.pausa.inicio;
}
const corridaFeitaNaChave = (k)=>{ const p = (state.corridaProgress || {})[k]; return !!(p && (p===true || p.done)); };

// Tira da agenda só o planejado ainda não feito, de hoje até o fim da semana. Feito e manual ficam.
function limparPlanejadoDesdeHoje(){
  const hi = hojeIdx();
  const datas = new Set(DAY_ABBR.slice(hi).map(d=>chaveDiaAtual(d)));
  state.treinos = (state.treinos || []).filter(t=>!(datas.has(t.day) && !corridaFeitaNaChave(t.day)));
  DAY_ABBR.forEach((d, i)=>{
    const l = (state.musculacao || {})[d];
    if(!l || i < hi || (state.muscDayOrigin || {})[d] || l.some(e=>e.done)) return;
    delete state.musculacao[d];
  });
  saveTreinos(); saveMusc();
}

async function pausarPlano(motivo){
  const hp = state.hybridPlanData;
  if(!hp || !hp.plan || !hp.plan.length || hp.pausa) return false;
  await guardarVersaoDoPlano('Plano pausado', 'pausa');
  hp.pausa = { inicio:todayISO(), motivo:motivo || null, semana:hp.currentWeekIndex || 1, em:Date.now() };
  limparPlanejadoDesdeHoje();
  await saveHybridPlanData();
  registrarNoDiario({ alteracao:'Plano pausado', original:'', novo:'semana ' + hp.pausa.semana, motivo:PAUSA_MOTIVOS[motivo] || 'pausa' });
  return true;
}

// Semana N do plano gerada só nos dias que restam desta semana (como a semana 1 criada no meio da semana).
function gerarSemanaRetomada(n, ajustes, perfilBase){
  const hp = state.hybridPlanData;
  if(!(perfilBase || state.athleteProfile)) return null;
  const alvo = (hp.trajetoria || [])[n-1] || null;
  const hi = hojeIdx();
  let perfil = perfilBase || state.athleteProfile;
  if(hi > 0){
    perfil = JSON.parse(JSON.stringify(perfil));
    const porDia = {};
    DAY_ABBR.slice(0, hi).forEach(d=>{ porDia[d] = { disponivel:false, minutos:null }; });
    definirAthleteDisponibilidade(perfil, porDia, { origem:'informado', confianca:'alta', forcar:true });
  }
  let r;
  try{ r = gerarPlanoSemanal(perfil, { alvoSemana:alvo, ajustesIniciais:ajustes || null }); }catch(e){ console.warn('[pausa] semana de retomada', e); return null; }
  if(!r || r.bloqueado || !r.semana) return null;
  const w = r.semana;
  w.weekNumber = n; w.totalWeeks = hp.plan.length;
  if(alvo && alvo.fase) w.phaseLabel = alvo.fase;
  const { fator:f, piso } = fatorSeriesDaSemana(alvo);
  if(f && f!==1) Object.keys(w.muscPlan || {}).forEach(d=>w.muscPlan[d].forEach(e=>{ const s = parseInt(e.series, 10); if(s) e.series = String(Math.min(s, Math.max(piso, Math.round(s*f)))); }));
  (w.corridaWeek || []).forEach(c=>{ if(ehTipoCorridaChave(c.type)) c.chave = true; });
  return w;
}
// 1A: tira da semana retomada o que já tinha sido feito na semana N antes da pausa.
function removerFeitasAntesDaPausa(w, pausa){
  const iniISO = vdotISODate(vdotMondayOf(new Date(pausa.inicio + 'T12:00:00')));
  const corridasFeitas = (state.treinos || []).filter(t=>{
    const iso = isoDaChaveDia(t.day, pausa.inicio);
    return iso && iso >= iniISO && iso < pausa.inicio && corridaFeitaNaChave(t.day);
  }).map(t=>t.type);
  corridasFeitas.forEach(tp=>{
    let i = (w.corridaWeek || []).findIndex(c=>c.type===tp);
    if(i < 0) i = (w.corridaWeek || []).findIndex(c=>!c.chave);
    if(i >= 0) w.corridaWeek.splice(i, 1);
  });
  const nMusc = (state.workoutSessionsLog || []).filter(l=>l && l.data && l.data >= iniISO && l.data < pausa.inicio).length;
  const diasMusc = DAY_ABBR.filter(d=>(w.muscPlan || {})[d] && w.muscPlan[d].length);
  diasMusc.slice(0, nMusc).forEach(d=>{ delete w.muscPlan[d]; });
  return w;
}
function retornoParaDias(dias){
  if(dias <= PAUSA_LIMITE_DIAS) return null;
  return PAUSA_RETORNO.find(x=>dias <= x.ateDias);
}
function aplicarSerieAMenos(w){
  Object.keys(w.muscPlan || {}).forEach(d=>w.muscPlan[d].forEach(e=>{ const s = parseInt(e.series, 10); if(s > 1) e.series = String(s - 1); }));
  return w;
}
// O que a retomada faria: a semana normal e, depois de mais de 14 dias, a semana de retorno proposta.
function propostaRetomada(){
  if(!planoPausado()) return null;
  const hp = state.hybridPlanData, pausa = hp.pausa;
  const dias = diasDePausa(), n = pausa.semana || 1;
  const normal = gerarSemanaRetomada(n, null);
  if(normal) removerFeitasAntesDaPausa(normal, pausa);
  const ret = retornoParaDias(dias);
  let leve = null;
  if(ret){
    leve = gerarSemanaRetomada(n, { volumeFator:ret.volumeFator, semQualidade:true, semProgressao:true });
    if(leve){ removerFeitasAntesDaPausa(leve, pausa); aplicarSerieAMenos(leve); }
  }
  return { dias, semana:n, normal, leve, retorno:ret, sugerirQuestionario: !!(ret && ret.sugerirQuestionario) };
}
async function retomarPlano(usarLeve, proposta){
  if(!planoPausado()) return false;
  const hp = state.hybridPlanData, pausa = hp.pausa;
  const p = proposta || propostaRetomada();
  const week = (usarLeve && p.leve) ? p.leve : p.normal;
  await guardarVersaoDoPlano('Plano retomado', 'pausa');
  const n = p.semana;
  const seg = segundaAtual();
  const novoInicio = new Date(seg); novoInicio.setDate(novoInicio.getDate() - (n-1)*7);
  hp.startMonday = vdotISODate(novoInicio);
  hp.pausas = (hp.pausas || []).concat([{ inicio:pausa.inicio, fim:todayISO(), dias:p.dias, motivo:pausa.motivo || null, semana:n, retorno:(usarLeve && p.leve) ? 'leve' : 'normal' }]);
  delete hp.pausa;
  try{ Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]); }catch(e){}
  if(week){
    hp.plan[n-1] = week;
    rematerializarSemanaAtual(week);
  }else{
    hp.currentWeekIndex = n; hp.materializadaSeg = vdotISODate(seg);
  }
  await saveHybridPlanData();
  registrarNoDiario({ alteracao:'Plano retomado', original:'pausa de ' + p.dias + ' dia' + (p.dias===1 ? '' : 's'),
    novo:'semana ' + n + ((usarLeve && p.leve) ? ' com retorno mais leve' : ''), motivo:PAUSA_MOTIVOS[pausa.motivo] || 'pausa' });
  return true;
}
// Semana nova durante a pausa: não avança; tira da lista de musculação (por dia da semana) o que veio do plano.
async function semanaDuranteAPausa(segISO){
  const hp = state.hybridPlanData;
  if(hp.materializadaSeg===segISO) return;
  DAY_ABBR.forEach(d=>{ if(!(state.muscDayOrigin || {})[d]) delete state.musculacao[d]; });
  saveMusc();
  hp.materializadaSeg = segISO;
  await saveHybridPlanData();
}

Object.assign(globalThis, {
  PAUSA_LIMITE_DIAS, PAUSA_RETORNO, PAUSA_MOTIVOS, planoPausado, diasDePausa, diaPausado, limparPlanejadoDesdeHoje, pausarPlano,
  gerarSemanaRetomada, removerFeitasAntesDaPausa, retornoParaDias, aplicarSerieAMenos, propostaRetomada, retomarPlano, semanaDuranteAPausa,
});
