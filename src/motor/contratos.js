// Contratos versionados do motor (Bloco 4 do plano mestre). Só formalizam o que o Motor V2 já calcula — nenhuma
// regra de prescrição muda aqui.
// - Assessment: retrato do diagnóstico usado para gerar o plano, salvo com a versão do motor e a data.
// - PlannedSession: sessões planejadas com id estável (derivado da data e da modalidade, não precisa ser gravado).
// - WorkoutMatcher: vínculo da atividade com a sessão planejada. O vínculo explícito (gravação feita a partir da
//   sessão) tem confiança alta; para atividade livre o matcher só SUGERE (decisão do usuário: atividade extra não
//   conclui sessão sozinha).
// - Estados por modalidade: força e corrida têm semana e fase próprias (hoje ainda avançam juntas).

const CONTRATOS_VERSAO = 1;

function montarAssessment(r){
  if(!r || r.bloqueado) return null;
  const e = r.estado || {};
  const c = e.corrida || {}, m = e.musc || {};
  const disp = (e.disp || []).filter(d=>d.disponivel);
  return {
    versao:CONTRATOS_VERSAO, engineVersion:r.engineVersion || null, measuredAt:todayISO(),
    strengthLevel:(r.capacidade || {}).musc || null, runLevel:(r.capacidade || {}).corrida || null,
    // o motor atual calcula uma confiança só, para os dois eixos
    strengthConfidence:r.confianca || null, runConfidence:r.confianca || null,
    calibracao:r.calibracao || null,
    returnAfterBreak: c.situacao==='parado' || m.situacao==='parado',
    corrida:{ situacao:c.situacao || null, regime:c.regime || null, vdot:c.vdot || null, vdotFonte:c.vdotFonte || null,
      volumeMinSemana:(c.carga || {}).min || null, maiorMin:c.maiorMin || null },
    musculacao:{ situacao:m.situacao || null, freq:m.freq || null },
    availableDays:disp.map(d=>d.dia),
    minutesByDay:Object.fromEntries(disp.map(d=>[d.dia, d.minutos])),
    equipment:e.equipamentos || [],
    currentPain:(e.restricoes || {}).regioes || [],
    restricoes:(e.restricoes || {}).motivos || [],
    primaryGoal:(e.objetivo || {}).tipo || null,
    includedModalities:[...((r.resumo || {}).sessoesCorrida ? ['corrida'] : []), ...((r.resumo || {}).sessoesMusculacao ? ['musculacao'] : [])],
    alertas:r.alertas || [],
  };
}

function idSessaoPlanejada(iso, modalidade){ return 'ps:' + iso + ':' + modalidade; }
// "Seg 05/10" → "2026-10-05" (o ano vem da data de referência; vira o ano quando a chave é de janeiro e a referência de dezembro, e vice-versa)
function isoDaChaveDia(chave, isoRef){
  const m = /(\d{2})\/(\d{2})/.exec(String(chave || ''));
  if(!m) return null;
  let ano = parseInt(String(isoRef || todayISO()).slice(0, 4), 10);
  const mesRef = parseInt(String(isoRef || todayISO()).slice(5, 7), 10), mes = parseInt(m[2], 10);
  if(mesRef===12 && mes===1) ano++; else if(mesRef===1 && mes===12) ano--;
  return `${ano}-${m[2]}-${m[1]}`;
}

// Sessões planejadas da semana atual do plano (agenda viva), com papel interno (código da sessão) e prescrição resumida.
function sessoesPlanejadasDaSemana(){
  return naSemanaAtual(()=>{
    const out = [];
    DAY_ABBR.forEach(d=>{
      const iso = isoDoDiaAtual(d);
      const e = treinoEntryForDay(d);
      if(e) out.push({ id:idSessaoPlanejada(iso, 'corrida'), data:iso, dia:d, modalidade:'corrida', papel:e.sessao || null, titulo:e.type || 'Corrida',
        chave:e.day, chaveSessao:!!(e.chave), prescricao:{ totalKm:e.totalKm || null, totalMin:e.totalMin || null } });
      const l = muscListForDay(d);
      if(l.length) out.push({ id:idSessaoPlanejada(iso, 'musculacao'), data:iso, dia:d, modalidade:'musculacao', papel:(l[0] && l[0].sessao) || null,
        titulo:muscTituloDoDia(d, l), chave:d, chaveSessao:ehSessaoChaveMusc(l), prescricao:{ exercicios:l.length, series:l.reduce((t, x)=>t + (parseInt(x.series, 10) || 0), 0) } });
    });
    return out;
  });
}

// Vínculo de uma atividade com a sessão planejada.
function vinculoDaAtividade(a){
  if(!a || !a.sessao) return null;
  if(a.sessao.modalidade==='corrida'){
    const iso = isoDaChaveDia(a.sessao.chave, a.data);
    return iso ? { sessaoId:idSessaoPlanejada(iso, 'corrida'), confianca:'alta', origem:'gravada_da_sessao' } : null;
  }
  if(a.sessao.modalidade==='musculacao' && a.data) return { sessaoId:idSessaoPlanejada(a.data, 'musculacao'), confianca:'alta', origem:'gravada_da_sessao' };
  return null;
}
// Para atividade livre: sugere a sessão do mesmo dia e modalidade que ainda está pendente. Nunca aplica sozinho.
function sugerirVinculo(a){
  if(!a || !a.livre || !a.data || a.tipo==='caminhada') return null;
  const mod = a.tipo==='musculacao' ? 'musculacao' : 'corrida';
  const s = sessoesPlanejadasDaSemana().find(x=>x.data===a.data && x.modalidade===mod);
  if(!s) return null;
  if(mod==='corrida' && conclusaoCorrida(s.chave).status!=='pending') return null;
  return { sessaoId:s.id, confianca:'media', origem:'mesmo_dia_mesma_modalidade' };
}

// Estados por modalidade (semana e fase). Hoje avançam juntos; planos antigos sem o campo usam a semana única.
function estadosDaSemana(n, fase){ return { corrida:{ semana:n, fase:fase || null }, forca:{ semana:n, fase:fase || null } }; }
function estadoModalidade(mod){
  const hp = state.hybridPlanData;
  if(!hp) return null;
  const chave = mod==='musculacao' ? 'forca' : mod;
  if(hp.estados && hp.estados[chave]) return hp.estados[chave];
  const w = (hp.plan || []).find(x=>x.weekNumber===(hp.currentWeekIndex || 1));
  return { semana:hp.currentWeekIndex || 1, fase:w ? w.phaseLabel : null };
}

Object.assign(globalThis, {
  CONTRATOS_VERSAO, montarAssessment, idSessaoPlanejada, isoDaChaveDia, sessoesPlanejadasDaSemana, vinculoDaAtividade, sugerirVinculo,
  estadosDaSemana, estadoModalidade,
});
