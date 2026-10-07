// Check-in semanal como contratos versionados (Bloco 7 do plano mestre):
//   WeeklyCheckin (fatos) → WeekDecision (o que muda) → WeekOverlay (como entra no plano).
// As regras são as mesmas de antes (fadiga ≥ 4 ou dor → volume −20%; dor → aliviar pernas; fadiga 5 → sem
// qualidade; semana fácil → +5%), com uma diferença decidida pelo usuário: nada AUMENTA sozinho por causa do
// check-in. Reduções conservadoras (dor/segurança) entram automaticamente e mostram o que mudou; o aumento vira
// uma proposta com antes/depois que a pessoa aceita ou não.
// Os ajustes do dia já existentes (musculação reduzida só na semana, corrida ajustada com o original guardado)
// aparecem aqui como overlays do dia, só para leitura.

const ADAPTACAO_VERSAO = 1;
const ACOES_SEMANA = ['manter', 'reduzir_volume', 'reduzir_acessorios_perna', 'converter_qualidade_em_facil', 'aumentar_volume'];

function criarWeeklyCheckin(semana, d, resposta){
  d = d || {};
  return { id:'chk:' + semana, versao:ADAPTACAO_VERSAO, semana, data:todayISO(), resposta:resposta || null,
    fatos:{ fadiga:d.fadiga==null ? null : d.fadiga, sono:d.sono==null ? null : d.sono, percepcao:d.percepcao==null ? null : d.percepcao,
      dor:!!d.dor, dorRegiao:d.dorRegiao || null, motivos:(d.motivos || []).slice() } };
}
// Prioridade (plano mestre 10.3): segurança/dor > recuperação > evolução.
function decidirSemana(chk){
  const f = chk.fatos;
  const severo = (f.fadiga && f.fadiga>=4) || f.dor;
  const ajustes = {}, acoes = [], motivos = [];
  if(severo){ ajustes.volumeFator = 0.8; acoes.push('reduzir_volume'); motivos.push(f.dor ? 'dor_relatada' : 'fadiga_alta'); }
  if(f.dor){ ajustes.aliviarInferior = true; acoes.push('reduzir_acessorios_perna'); }
  if(f.fadiga && f.fadiga>=5){ ajustes.semQualidade = true; acoes.push('converter_qualidade_em_facil'); motivos.push('fadiga_maxima'); }
  if(chk.resposta==='facil' && !severo){ ajustes.volumeFator = 1.05; acoes.push('aumentar_volume'); motivos.push('semana_facil'); }
  if(!acoes.length) acoes.push('manter');
  const aumenta = (ajustes.volumeFator || 1) > 1;
  return { id:'dec:' + chk.semana, versao:ADAPTACAO_VERSAO, checkinId:chk.id, semanaAlvo:chk.semana + 1, acoes, ajustes, reasonCodes:motivos,
    prioridade: f.dor ? 'seguranca_dor' : severo ? 'recuperacao' : aumenta ? 'evolucao' : 'manter',
    automatica: !aumenta && acoes[0]!=='manter', requerConfirmacao: aumenta,
    engineVersion:(typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null) };
}
function criarOverlaySemana(dec){
  if(dec.acoes[0]==='manter') return null;
  return { id:'ovl:' + dec.semanaAlvo, versao:ADAPTACAO_VERSAO, semana:dec.semanaAlvo, decisaoId:dec.id, ajustes:{ ...dec.ajustes },
    estado: dec.requerConfirmacao ? 'pendente' : 'aplicado', criadoEm:Date.now() };
}

// Semanas futuras já geradas voltam a "pendente" para serem geradas de novo com o ajuste (como antes).
function semanasFuturasPendentes(hp, semana){
  Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]);
  return hp.plan.map(w=> (w.weekNumber>semana && !w.pendente && w.motorV2) ? { ...w, corridaWeek:[], muscPlan:{}, pendente:true, alvo:(hp.trajetoria||[])[w.weekNumber-1]||null } : w);
}

// Aplica o check-in: grava os três contratos e o ajuste da próxima semana. Idempotente: refazer o check-in da
// mesma semana substitui o anterior (mesmos ids), nunca acumula.
function aplicarCheckinContratos(hp, semana, d, resposta){
  const chk = criarWeeklyCheckin(semana, d, resposta);
  const dec = decidirSemana(chk);
  const ovl = criarOverlaySemana(dec);
  const aplicado = ovl && ovl.estado==='aplicado';
  return {
    ...hp,
    plan: semanasFuturasPendentes(hp, semana),
    ajusteProximaSemana: aplicado ? { semana:dec.semanaAlvo, ajustes:{ ...dec.ajustes } } : null,
    checkinsSemanais: { ...(hp.checkinsSemanais || {}), [semana]:chk },
    decisoesSemanais: { ...(hp.decisoesSemanais || {}), [semana]:dec },
    overlaysSemana: { ...(hp.overlaysSemana || {}), [dec.semanaAlvo]:ovl },
    decisaoPendente: ovl && ovl.estado==='pendente' ? { semana:dec.semanaAlvo, decisaoId:dec.id } : null,
  };
}
// Aceitar ou recusar a proposta pendente (aumento). Recusar mantém a semana como planejada.
function responderDecisaoPendente(hp, aceitar){
  const p = hp && hp.decisaoPendente;
  if(!p) return hp;
  const ovl = (hp.overlaysSemana || {})[p.semana];
  const novoOvl = ovl ? { ...ovl, estado: aceitar ? 'aplicado' : 'recusado', respondidoEm:Date.now() } : null;
  return { ...hp,
    plan: aceitar ? semanasFuturasPendentes(hp, p.semana - 1) : hp.plan,
    ajusteProximaSemana: aceitar && ovl ? { semana:p.semana, ajustes:{ ...ovl.ajustes } } : hp.ajusteProximaSemana,
    overlaysSemana: { ...(hp.overlaysSemana || {}), [p.semana]:novoOvl },
    decisaoPendente:null };
}
// Antes/depois da semana-alvo (minutos de corrida e sessões de qualidade), sem gravar nada.
function antesDepoisDoAjuste(hp, semana, ajustes){
  const salvo = state.hybridPlanData;
  const resumo = (aj)=>{
    state.hybridPlanData = { ...hp, ajusteProximaSemana: aj ? { semana, ajustes:aj } : null };
    Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]);
    const w = gerarSemanaV2(semana);
    return w ? { corridaMin:(w.corridaWeek || []).reduce((t, c)=>t + (c.totalMin || 0), 0), qualidade:(w.corridaWeek || []).filter(c=>ehTipoCorridaChave(c.type) && !/long/i.test(c.type)).length,
      seriesPerna:Object.values(w.muscPlan || {}).flat().filter(e=>e.grupo==='Pernas').reduce((t, e)=>t + (parseInt(e.series, 10) || 0), 0) } : null;
  };
  try{ return { antes:resumo(null), depois:resumo(ajustes) }; }
  finally{ state.hybridPlanData = salvo; Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]); }
}
// Overlays do dia (leitura): ajustes já feitos na semana atual, com o original guardado.
function overlaysDoDia(){
  const out = [];
  Object.entries(state.muscAjusteOrig || {}).forEach(([d, o])=>{
    const atual = state.musculacao[d] || [];
    if(JSON.stringify((o.lista || []).map(e=>[e.nome, e.series])) !== JSON.stringify(atual.map(e=>[e.nome, e.series])))
      out.push({ dia:d, modalidade:'musculacao', semana:o.semana, original:(o.lista || []).length + ' exercícios', atual:atual.length + ' exercícios' });
  });
  (state.treinos || []).forEach(e=>{ if(e.ajuste && e.ajuste.original) out.push({ dia:dayAbbrevOf(e.day), chave:e.day, modalidade:'corrida', motivo:e.ajuste.motivo || null,
    original:resumoCorrida(e.ajuste.original), atual: e.descanso ? 'descanso' : resumoCorrida(e) }); });
  return out;
}

Object.assign(globalThis, {
  ADAPTACAO_VERSAO, ACOES_SEMANA, criarWeeklyCheckin, decidirSemana, criarOverlaySemana, semanasFuturasPendentes, aplicarCheckinContratos,
  responderDecisaoPendente, antesDepoisDoAjuste, overlaysDoDia,
});
