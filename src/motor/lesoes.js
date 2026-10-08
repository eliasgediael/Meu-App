// Lesões e limitações (regras aprovadas pelo usuário em 07/10/2026, decisão 3A):
// - atalho para os MESMOS campos do questionário (restricoesTreino.dorAtual); as regras do motor não mudam
//   (qualquer dor tira a qualidade da corrida, membro inferior reduz volume, cada região bloqueia exercícios);
// - ao registrar: sessão arriscada e incompatível sai da agenda NA HORA (corrida de qualidade com dor, exercício
//   bloqueado pela região); o resto da semana é refeito pelo motor e mostrado como antes/depois, aplicado só com
//   confirmação; as semanas futuras passam a ser geradas com a limitação;
// - dor forte ou em repouso passa pela etapa de segurança que já existe (liberado / avaliação / por conta própria);
// - "melhorou" é aumento de carga: proposta com antes/depois e uma semana intermediária (90%, sem qualidade);
// - nada de atividade é apagado; tudo vai para o histórico de mudanças; versão guardada antes.

const LESAO_REGIOES = { joelho:'Joelho', tornozelo:'Tornozelo', quadril:'Quadril', pe:'Pé / canela', lombar:'Lombar / costas', ombro:'Ombro', punho:'Punho / cotovelo', outra:'Outra' };
const LESAO_INTENSIDADES = { leve:'Leve', moderada:'Moderada', forte:'Forte' };
const LESAO_RETORNO = { volumeFator:0.9, semQualidade:true, semProgressao:true };
const CORRIDA_QUALIDADE_RE = /interval|repeti|limiar|tempo|prova/i;

function lesoesAtivas(){
  const p = state.athleteProfile; if(!p) return [];
  const v = athleteGetPath(p, 'restricoesTreino.dorAtual');
  return (Array.isArray(v) ? v : []).map(x=>(x && typeof x==='object') ? x : { regiao:x });
}
function rotuloLesao(l){ return `${LESAO_REGIOES[motorRegiao(l.regiao)] || l.regiao}${l.intensidade ? ' · ' + (LESAO_INTENSIDADES[l.intensidade] || l.intensidade).toLowerCase() : ''}`; }
function motivoLesoes(lista){ return 'dor ' + lista.map(l=>(LESAO_REGIOES[motorRegiao(l.regiao)] || l.regiao).toLowerCase().split(' /')[0]).join(' e '); }
// Mesma assinatura do questionário: mudou o conjunto de alertas/dor forte, a decisão de segurança anterior não vale.
function assinaturaAlertas(p, dor){
  const itens = (athleteGetPath(p, 'sinaisDeAlerta.itens') || []).slice().sort().join(',');
  return itens + '|' + (dor.some(d=>d.intensidade==='forte' || d.emRepouso) ? 'dor' : '');
}
function perfilComLesoes(lista){
  const p = JSON.parse(JSON.stringify(state.athleteProfile));
  athleteSetPath(p, 'restricoesTreino.dorAtual', lista);
  const assin = assinaturaAlertas(p, lista);
  if(athleteGetPath(p, 'sinaisDeAlerta.assinatura')!==assin){
    athleteSetPath(p, 'sinaisDeAlerta.cautela', { estado:'nenhum', registradoEm:null });
    athleteSetPath(p, 'sinaisDeAlerta.assinatura', assin);
  }
  return p;
}
// Precisa da etapa de segurança? (dor forte/em repouso sem decisão registrada)
function lesaoPrecisaSeguranca(perfil){
  const dor = motorLerDor(perfil), cau = motorLerCautela(perfil, dor);
  return cau.bloqueado ? cau.motivo : null;
}

// Agenda atual de hoje até domingo, por dia (para o "antes").
function agendaRestanteDaSemana(){
  const hi = hojeIdx(), out = {};
  DAY_ABBR.slice(hi).forEach(d=>{
    const c = (state.treinos || []).find(t=>t.day===chaveDiaAtual(d));
    const m = (state.musculacao || {})[d];
    out[d] = { corrida: c || null, musc: (m && m.length && !(state.muscDayOrigin || {})[d]) ? m : null };
  });
  return out;
}
function textoDia(c, m, d){
  const partes = [];
  if(c) partes.push(resumoCorrida(c));
  if(m && m.length) partes.push(`${muscTituloDoDia(d, m)} · ${m.length} exercício${m.length===1?'':'s'}`);
  return partes.join(' + ') || 'Descanso';
}
const corridaFeitaLesao = (k)=>{ const p = (state.corridaProgress || {})[k]; return !!(p && (p===true || p.done)); };

// O que fica arriscado com as limitações novas (só o que ainda não foi feito, de hoje em diante).
function sessoesArriscadas(perfil){
  const dor = motorLerDor(perfil), cau = motorLerCautela(perfil, dor), r = motorLerRestricoes(perfil, dor, cau);
  const out = [];
  const ag = agendaRestanteDaSemana();
  Object.entries(ag).forEach(([d, x])=>{
    if(x.corrida && !corridaFeitaLesao(x.corrida.day) && r.corridaSemQualidade && CORRIDA_QUALIDADE_RE.test(x.corrida.type || ''))
      out.push({ dia:d, mod:'corrida', titulo:resumoCorrida(x.corrida) });
    (x.musc || []).forEach(e=>{
      if(e.done) return;
      const n = normalizeNoAccents(String(e.nome || ''));
      if(r.regexBloqueio.some(re=>re.test(n)) || r.evitarNomes.has(e.nome)) out.push({ dia:d, mod:'musc', exId:e.id, titulo:e.nome });
    });
  });
  return out;
}
function bloquearSessoes(lista, motivo){
  lista.forEach(s=>{
    if(s.mod==='corrida'){
      state.treinos = (state.treinos || []).filter(t=>!(t.day===chaveDiaAtual(s.dia) && !corridaFeitaLesao(t.day)));
    }else{
      const l = (state.musculacao || {})[s.dia]; if(!l) return;
      state.musculacao[s.dia] = l.filter(e=>e.id!==s.exId);
      if(!state.musculacao[s.dia].length) delete state.musculacao[s.dia];
    }
    registrarNoDiario({ dia:s.dia, alteracao:'Sessão bloqueada', original:s.titulo, novo:'removida', motivo });
  });
  if(lista.length){ saveTreinos(); saveMusc(); }
}

// Proposta de semana (dias que restam) com o perfil dado; compara com a agenda de agora.
function propostaSemanaLesao(perfil, ajustes){
  const hp = state.hybridPlanData;
  const n = hp.currentWeekIndex || 1;
  const aj = { ...((hp.ajusteProximaSemana && hp.ajusteProximaSemana.semana===n) ? hp.ajusteProximaSemana.ajustes : {}), ...(ajustes || {}) };
  const w = gerarSemanaRetomada(n, Object.keys(aj).length ? aj : null, perfil);
  if(!w) return null;
  const ag = agendaRestanteDaSemana();
  const mudancas = [];
  Object.entries(ag).forEach(([d, x])=>{
    if(x.corrida && corridaFeitaLesao(x.corrida.day)) return;
    if(x.musc && x.musc.some(e=>e.done)) return;
    const antes = textoDia(x.corrida, x.musc, d);
    const depois = textoDia((w.corridaWeek || []).find(c=>c.day===d), (w.muscPlan || {})[d], d);
    if(antes!==depois) mudancas.push({ dia:d, antes, depois });
  });
  return { semana:n, week:w, mudancas };
}
function aplicarSemanaProposta(prop, motivo){
  const hp = state.hybridPlanData;
  hp.plan = semanasFuturasPendentes(hp, prop.semana);   // semanas futuras saem de novo, já com a limitação
  hp.plan[prop.semana-1] = prop.week;
  rematerializarSemanaAtual(prop.week);
  prop.mudancas.forEach(m=>registrarNoDiario({ dia:m.dia, alteracao:'Ajuste por lesão', original:m.antes, novo:m.depois, motivo }));
}

// Passo 1 ao salvar uma limitação nova: grava no perfil, bloqueia o que é arriscado e devolve a proposta.
async function registrarLesao(l){
  const atual = lesoesAtivas();
  const nova = { regiao:l.regiao, intensidade:l.intensidade || 'moderada', emRepouso:l.emRepouso===true, desde:todayISO() };
  const lista = atual.filter(x=>motorRegiao(x.regiao)!==motorRegiao(nova.regiao)).concat([nova]);
  const perfil = perfilComLesoes(lista);
  await guardarVersaoDoPlano('Lesão: ' + rotuloLesao(nova), 'lesao');
  state.athleteProfile = perfil; await salvarAthleteProfile();
  const motivo = motivoLesoes([nova]);
  registrarNoDiario({ alteracao:'Lesão registrada', original:'', novo:rotuloLesao(nova), motivo:'lesões e limitações' });
  const seguranca = lesaoPrecisaSeguranca(perfil);
  const arriscadas = sessoesArriscadas(perfil);
  bloquearSessoes(arriscadas, motivo);
  const temPlano = !!(state.hybridPlanData && state.hybridPlanData.plan && state.hybridPlanData.plan.length && !planoPausado());
  return { seguranca, arriscadas, motivo, proposta: (temPlano && !seguranca) ? propostaSemanaLesao(perfil) : null };
}
// Resposta da etapa de segurança: 'liberado' | 'avaliacao' (pausa o plano) | 'conta_propria' (plano conservador).
async function responderSegurancaLesao(escolha){
  const p = state.athleteProfile;
  const orient = athleteGetPath(p, 'restricoesTreino.vindasDeOrientacao') || [];
  const estado = escolha==='liberado' ? (orient.length ? 'liberado_com_restricoes' : 'liberado') : escolha==='avaliacao' ? 'em_andamento' : 'seguir_por_conta_propria';
  athleteSetPath(p, 'sinaisDeAlerta.cautela', { estado, registradoEm:athleteAgora() });
  if(estado==='seguir_por_conta_propria') athleteSetPath(p, 'sinaisDeAlerta.reconhecimento', { registradoEm:athleteAgora(), texto:'Ciente de que não é uma liberação médica' });
  await salvarAthleteProfile();
  if(estado==='em_andamento'){ if(!planoPausado()) await pausarPlano('lesao'); return null; }
  return (state.hybridPlanData && state.hybridPlanData.plan && !planoPausado()) ? propostaSemanaLesao(p) : null;
}
async function confirmarAjusteLesao(prop, motivo){
  if(!prop) return false;
  aplicarSemanaProposta(prop, motivo);
  await saveHybridPlanData();
  return true;
}
// "Melhorou" (3A): proposta com semana intermediária; só tira a limitação se confirmar.
function propostaMelhorou(regiao){
  const lista = lesoesAtivas().filter(x=>motorRegiao(x.regiao)!==motorRegiao(regiao));
  const perfil = perfilComLesoes(lista);
  const temPlano = !!(state.hybridPlanData && state.hybridPlanData.plan && state.hybridPlanData.plan.length && !planoPausado());
  return { lista, perfil, proposta: temPlano ? propostaSemanaLesao(perfil, LESAO_RETORNO) : null };
}
async function confirmarMelhorou(regiao, pm){
  const saiu = lesoesAtivas().find(x=>motorRegiao(x.regiao)===motorRegiao(regiao));
  await guardarVersaoDoPlano('Lesão melhorou: ' + (saiu ? rotuloLesao(saiu) : regiao), 'lesao');
  const hist = athleteGetPath(pm.perfil, 'restricoesTreino.historicoDor') || [];
  if(saiu) athleteSetPath(pm.perfil, 'restricoesTreino.historicoDor', hist.concat([{ ...saiu, ate:todayISO() }]));
  state.athleteProfile = pm.perfil; await salvarAthleteProfile();
  registrarNoDiario({ alteracao:'Lesão melhorou', original:saiu ? rotuloLesao(saiu) : regiao, novo:'semana intermediária', motivo:'lesões e limitações' });
  if(pm.proposta){ aplicarSemanaProposta(pm.proposta, 'volta gradual depois da lesão'); await saveHybridPlanData(); }
  return true;
}

Object.assign(globalThis, {
  LESAO_REGIOES, LESAO_INTENSIDADES, LESAO_RETORNO, lesoesAtivas, rotuloLesao, motivoLesoes, perfilComLesoes, lesaoPrecisaSeguranca,
  agendaRestanteDaSemana, sessoesArriscadas, bloquearSessoes, propostaSemanaLesao, registrarLesao, responderSegurancaLesao,
  confirmarAjusteLesao, propostaMelhorou, confirmarMelhorou,
});
