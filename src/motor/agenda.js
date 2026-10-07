// HybridScheduler em MODO AUDITORIA (Bloco 6 do plano mestre). Avalia a semana (gerada pelo motor ou já alterada
// pelo usuário) e só REGISTRA conflitos: não move nem altera nenhuma sessão. Sugestões ao usuário e aplicação
// automática dependem de aprovação futura (decisão do usuário: começar só auditando).
// Restrições avaliadas (plano mestre 9.2), sobre a carga normalizada de cada sessão (cargaDaSessao):
//   - duas sessões fortes de pernas em dias seguidos
//   - perna pesada na véspera (ou no dia seguinte) de intervalado, limiar ou longão
//   - três ou mais dias fortes seguidos
//   - duas sessões fortes no mesmo dia
//   - soma do dia acima do tempo disponível
//   - sessão de pernas pesada com dor ativa em membro inferior
// Cada conflito tem mensagem curta e uma sugestão objetiva (para quando as sugestões forem liberadas).

const AGENDA_MODO = 'auditoria';
const CONFLITOS_AGENDA = {
  pernas_fortes_seguidas:      { peso:8, msg:'Treinos fortes de pernas em dias seguidos', sug:'Separar com um dia leve entre eles' },
  perna_pesada_e_corrida_forte:{ peso:10, msg:'Treino de pernas muito próximo do treino forte de corrida', sug:'Mudar o treino de pernas para outro dia' },
  dias_fortes_seguidos:        { peso:6, msg:'Três dias fortes seguidos', sug:'Trocar um deles por um treino leve' },
  duas_fortes_mesmo_dia:       { peso:8, msg:'Dois treinos fortes no mesmo dia', sug:'Passar um deles para outro dia' },
  tempo_acima_do_disponivel:   { peso:4, msg:'Treino maior que o tempo disponível no dia', sug:'Encurtar ou mudar de dia' },
  pernas_com_dor_ativa:        { peso:10, msg:'Treino pesado de pernas com dor ativa', sug:'Trocar por um treino sem pernas' },
};
const MEMBRO_INFERIOR = ['joelho','tornozelo','quadril','pe'];

function auditarSemana(sessoes, opcoes){
  opcoes = opcoes || {};
  const cargas = (sessoes || []).map(cargaDaSessao);
  const porDia = {};
  cargas.forEach((c, i)=>{ const d = sessoes[i].dia; (porDia[d] = porDia[d] || []).push({ c, s:sessoes[i] }); });
  const conflitos = [];
  const add = (codigo, dias, sessoesIds)=>{ const def = CONFLITOS_AGENDA[codigo]; conflitos.push({ codigo, dias, sessoes:sessoesIds, mensagem:def.msg, sugestao:def.sug, peso:def.peso }); };
  const dias = DAY_ABBR;
  const forte = (d)=> (porDia[d] || []).filter(x=>x.c.hardSession);
  const pernaForte = (d)=> (porDia[d] || []).filter(x=>x.c.lowerBodyStress==='high');
  const legDay = (d)=> (porDia[d] || []).filter(x=>x.c.papel==='LEG_DAY_HEAVY');
  const corridaForte = (d)=> (porDia[d] || []).filter(x=>x.c.modality==='corrida' && x.c.hardSession);
  for(let i=0; i<7; i++){
    const d = dias[i], nx = dias[(i+1)%7];
    const fimDeSemana = i===6; // domingo → segunda já é outra semana do plano
    if(!fimDeSemana){
      const a = pernaForte(d), b = pernaForte(nx);
      if(a.length && b.length) add('pernas_fortes_seguidas', [d, nx], [...a, ...b].map(x=>x.c.sessaoId));
      const l1 = legDay(d), r2 = corridaForte(nx), r1 = corridaForte(d), l2 = legDay(nx);
      if(l1.length && r2.length) add('perna_pesada_e_corrida_forte', [d, nx], [...l1, ...r2].map(x=>x.c.sessaoId));
      if(r1.length && l2.length) add('perna_pesada_e_corrida_forte', [d, nx], [...r1, ...l2].map(x=>x.c.sessaoId));
    }
    if(i<=4 && forte(d).length && forte(dias[i+1]).length && forte(dias[i+2]).length) add('dias_fortes_seguidos', [d, dias[i+1], dias[i+2]], []);
    if(forte(d).length>1) add('duas_fortes_mesmo_dia', [d], forte(d).map(x=>x.c.sessaoId));
    const minDisp = (opcoes.minutosPorDia || {})[d];
    const soma = (porDia[d] || []).reduce((t, x)=>t + (x.s.minutos || x.c.durationEstimate || 0), 0);
    if(minDisp && soma > minDisp + 0.5) add('tempo_acima_do_disponivel', [d], (porDia[d] || []).map(x=>x.c.sessaoId));
    if((opcoes.dor || []).some(r=>MEMBRO_INFERIOR.includes(r)) && legDay(d).length) add('pernas_com_dor_ativa', [d], legDay(d).map(x=>x.c.sessaoId));
  }
  return {
    modo:AGENDA_MODO, engineVersion:(typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null),
    semana:opcoes.semana || null,
    placements:cargas.map((c, i)=>({ sessaoId:c.sessaoId, dia:sessoes[i].dia, modalidade:c.modality, papel:c.papel, hardSession:c.hardSession, lowerBodyStress:c.lowerBodyStress })),
    conflictsFound:conflitos, conflictsResolved:[], compromises:opcoes.compromissos || [], warnings:[],
    score:conflitos.reduce((t, c)=>t + c.peso, 0),
  };
}
// Auditoria da semana atual do plano (a agenda viva, com as mudanças que o usuário fez).
function auditarSemanaAtual(){
  const hp = state.hybridPlanData;
  const ass = hp && hp.assessment;
  return auditarSemana(sessoesPlanejadasDaSemana(), { semana:hp ? hp.currentWeekIndex : null, minutosPorDia:ass ? ass.minutesByDay : {}, dor:ass ? ass.currentPain : [] });
}
// Sessões de uma semana gerada pelo motor (antes de entrar na agenda), no mesmo formato de sessoesPlanejadasDaSemana.
function sessoesDaSemanaGerada(w){
  const out = [];
  (w.corridaWeek || []).forEach(c=>out.push({ id:'w'+w.weekNumber+':'+c.day+':corrida', dia:c.day, modalidade:'corrida', papel:c.sessao || null, titulo:c.type, chaveSessao:!!c.chave, minutos:c.totalMin || null, prescricao:{ totalKm:c.totalKm, totalMin:c.totalMin } }));
  Object.entries(w.muscPlan || {}).forEach(([d, l])=>out.push({ id:'w'+w.weekNumber+':'+d+':musculacao', dia:d, modalidade:'musculacao', papel:(l[0] && l[0].sessao) || null, titulo:'Musculação', chaveSessao:false, minutos:null, prescricao:{ exercicios:l.length } }));
  return out;
}
// Guarda o relatório da auditoria no plano (só registro; não muda nada).
function registrarAuditoriaDaSemana(){
  const hp = state.hybridPlanData;
  if(!hp) return null;
  const a = auditarSemanaAtual();
  hp.auditorias = hp.auditorias || {};
  hp.auditorias[hp.currentWeekIndex || 1] = { ...a, data:todayISO() };
  return a;
}

Object.assign(globalThis, {
  AGENDA_MODO, CONFLITOS_AGENDA, auditarSemana, auditarSemanaAtual, sessoesDaSemanaGerada, registrarAuditoriaDaSemana,
});

// ---------- Sugestões da agenda (Bloco 9, aprovado pelo usuário) ----------
// Quando uma mudança MANUAL cria conflito (o gerador não cria: 0 conflitos em 160 semanas), o app mostra um aviso
// curto com uma sugestão objetiva. Nada muda sozinho: "Aceitar" move a sessão; "Manter assim" esconde o aviso.
const NOME_DIA_CURTO = { Seg:'segunda', Ter:'terça', Qua:'quarta', Qui:'quinta', Sex:'sexta', 'Sáb':'sábado', Dom:'domingo' };
function chaveConflito(c){ return c.codigo + ':' + c.dias.join('-'); }
function diaDaSessaoId(id){
  const m = /^ps:(\d{4}-\d{2}-\d{2}):(corrida|musculacao)$/.exec(id || '');
  if(!m) return null;
  const d = new Date(m[1] + 'T12:00:00');
  return { dia:DAY_ABBR[(d.getDay()+6)%7], mod:m[2] };
}
// Dias (de hoje em diante, sem sessão da mesma modalidade) para onde mover a sessão deixa a semana com MENOS
// conflitos na auditoria. Simulação pura: não muda nada.
function opcoesAuditoriaAtual(){ const hp = state.hybridPlanData; const ass = hp && hp.assessment; return { minutosPorDia:ass ? ass.minutesByDay : {}, dor:ass ? ass.currentPain : [] }; }
function destinosQueReduzemConflitos(sessao, antes){
  const base = sessoesPlanejadasDaSemana(), opc = opcoesAuditoriaAtual(), out = [];
  const chavesAntes = new Set(auditarSemana(base, opc).conflictsFound.map(c=>c.codigo + ':' + c.dias.join('-')));
  for(let i=hojeIdx(); i<7; i++){
    const alvo = DAY_ABBR[i];
    if(alvo===sessao.dia || base.some(x=>x.dia===alvo && x.modalidade===sessao.mod)) continue;
    const disp = (state.hybridPlanData && state.hybridPlanData.assessment || {}).availableDays;
    if(disp && disp.length && !disp.includes(alvo)) continue; // só dias que a pessoa marcou como disponíveis
    const sim = base.map(x=> x.dia===sessao.dia && x.modalidade===sessao.mod ? { ...x, dia:alvo, id:idSessaoPlanejada(isoDoDiaAtual(alvo), x.modalidade) } : x);
    const depois = auditarSemana(sim, opc).conflictsFound;
    // não pode criar conflito novo (nem trocar um por outro), só remover
    const novos = depois.filter(c=>!chavesAntes.has(c.codigo + ':' + c.dias.join('-')));
    if(depois.length < antes && !novos.length) out.push({ alvo, n:depois.length });
  }
  return out.sort((x, y)=>x.n - y.n).map(x=>x.alvo);
}
function conflitosMantidosDaSemana(){
  const hp = state.hybridPlanData; const seg = vdotISODate(segundaAtual());
  return ((hp && hp.conflitosMantidos) || {})[seg] || [];
}
// Primeiro conflito ainda não respondido, de hoje em diante, com a proposta de mudança (ou sem, se não houver dia livre).
function sugestaoDaAgenda(){
  const hp = state.hybridPlanData;
  if(!hp || !hp.plan) return null;
  const a = auditarSemanaAtual();
  const mantidos = conflitosMantidosDaSemana();
  const hoje = hojeIdx();
  for(const c of a.conflictsFound){
    if(mantidos.includes(chaveConflito(c))) continue;
    if(!c.dias.some(d=>DAY_ABBR.indexOf(d) >= hoje)) continue;
    // prefere mover a musculação; corrida-chave não é movida
    const candidatos = (c.sessoes || []).map(diaDaSessaoId).filter(Boolean)
      .sort((x, y)=>(x.mod==='musculacao' ? 0 : 1) - (y.mod==='musculacao' ? 0 : 1))
      .filter(x=>DAY_ABBR.indexOf(x.dia) >= hoje && !(x.mod==='corrida' && ehSessaoChaveDia(x.dia)));
    let proposta = null;
    for(const s of candidatos){
      const destinos = destinosQueReduzemConflitos(s, a.conflictsFound.length);
      if(destinos.length){ proposta = { de:s.dia, para:destinos[0], mod: s.mod==='musculacao' ? 'musc' : 'corrida' }; break; }
    }
    const texto = proposta ? `Mudar ${proposta.mod==='musc' ? 'a musculação' : 'a corrida'} de ${NOME_DIA_CURTO[proposta.de]} para ${NOME_DIA_CURTO[proposta.para]}` : c.sugestao;
    return { chave:chaveConflito(c), codigo:c.codigo, dias:c.dias, mensagem:c.mensagem, sugestao:texto, proposta };
  }
  return null;
}
async function aceitarSugestaoAgenda(){
  const s = sugestaoDaAgenda();
  if(!s || !s.proposta) return false;
  await moverSessao(s.proposta.de, s.proposta.para, s.proposta.mod, 'sugestão da agenda');
  return true;
}
async function manterConflitoAgenda(chave){
  const hp = state.hybridPlanData; if(!hp) return;
  const seg = vdotISODate(segundaAtual());
  hp.conflitosMantidos = hp.conflitosMantidos || {};
  hp.conflitosMantidos[seg] = [...new Set([...(hp.conflitosMantidos[seg] || []), chave])];
  await saveHybridPlanData();
}
Object.assign(globalThis, { opcoesAuditoriaAtual, destinosQueReduzemConflitos, NOME_DIA_CURTO, chaveConflito, diaDaSessaoId, sugestaoDaAgenda, aceitarSugestaoAgenda, manterConflitoAgenda });
