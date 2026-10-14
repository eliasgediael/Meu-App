// Resumo do histórico de CORRIDA para a personalização por IA (Etapa 2, aprovada em 14/10/2026).
// Só lê o que o app já registra; não grava nada, não muda plano, pace ou validação. Ainda NÃO vai para o Gemini
// (o contrato v2, Etapa 3, decide quando e como).
//
// Fontes (todas já existentes no app):
//   state.treinos[]                     sessão planejada: day ('Seg 13/10'), type, totalKm, totalMin, steps, gpsSteps
//   state.corridaProgress[day]          execução: done, km, tempo, pace, data (ISO), comoFoi (1 Fácil … 4 Muito difícil), gpsRunId
//   gravações do GPS (IndexedDB 'runs') etapas_executadas[]: tipo, duracao_alvo, duracao_real_seg, distancia_real_km, pace_medio_real (min/km)
//   hybridPlanData.checkins[semana]     resposta do check-in semanal: 'facil' | 'bom' | 'dificil'
//   hybridPlanData.checkinsSemanais[semana].fatos   fadiga, sono, percepcao (1–5), dor (sim/não)
//   state.checkinDiario[iso]            energia 1–3, pernas 1–3, dor 1–3
//   state.atividadesLivres[]            corridas fora do plano (não concluem sessão)
//   hybridPlanData.pausa                dias de pausa não contam como não realizados
//
// O que NUNCA sai daqui: datas (só "semanas atrás"), chave do dia, GPS (pontos, rotas, local), ids de gravação,
// tênis, nomes, região de dor. Os números são arredondados.
//
// Ausente x insuficiente x ruim: cada bloco tem n (quantas observações); sem observação o valor é null; abaixo do
// mínimo o status é 'dados_insuficientes' e não se tira conclusão; desempenho ruim aparece como número (ex.: pace
// mais lento que o alvo, intervalados interrompidos), nunca como ausência.
/* eslint-disable */

const IA_HC_VERSAO = '1';
const IA_HC_JANELA_SEMANAS = 4;
const IA_HC_MIN_TENDENCIA = 4;        // corridas leves com pace para falar em tendência
const IA_HC_MIN_TIPO = 2;             // sessões com dado para resumir um tipo
const IA_HC_TOL_PACE_PCT = 0.05;      // dentro do alvo: até 5% de diferença no pace
const IA_HC_DIAS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

// Em sessões com blocos fortes o pace médio da sessão inteira (com trotes e aquecimento) não diz nada: a comparação
// com o alvo é feita só nos blocos fortes (blocos), e pace da sessão fica null.
const IA_HC_TIPOS_POR_BLOCO = ['intervalado', 'limiar', 'fartlek', 'prova'];
const iaHcR1 = (x)=>Math.round(x*10)/10;
const iaHcR2 = (x)=>Math.round(x*100)/100;
function iaHcMediana(v){ if(!v.length) return null; const s = v.slice().sort((a, b)=>a - b), m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1] + s[m])/2; }
function iaHcMedia(v){ return v.length ? v.reduce((a, b)=>a + b, 0)/v.length : null; }
function iaHcIsoParaDia(iso){ const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d)/86400000; }
function iaHcSegunda(diaNum){ const dow = (new Date(diaNum*86400000).getUTCDay() + 6)%7; return diaNum - dow; }
// 'Seg 13/10' → número do dia; ano inferido pela data de referência (nunca mais de ~2 meses no futuro).
function iaHcDiaDaChave(chave, hojeNum){
  const m = /(\d{1,2})\/(\d{1,2})/.exec(String(chave || ''));
  if(!m) return null;
  const anoHoje = new Date(hojeNum*86400000).getUTCFullYear();
  let d = Date.UTC(anoHoje, Number(m[2]) - 1, Number(m[1]))/86400000;
  if(d - hojeNum > 60) d = Date.UTC(anoHoje - 1, Number(m[2]) - 1, Number(m[1]))/86400000;
  return d;
}
function iaHcTipo(type, sessao){
  const t = String(type || '').toLowerCase();
  if(/regenera/.test(t)) return 'regenerativo';
  if(/long/.test(t) || sessao==='RUN_LONG_RUN') return 'longao';
  if(/interval|repeti|tiro/.test(t) || sessao==='RUN_INTERVALS_VO2MAX') return 'intervalado';
  if(/limiar|tempo/.test(t) || sessao==='RUN_TEMPO_THRESHOLD') return 'limiar';
  if(/fartlek/.test(t)) return 'fartlek';
  if(/prova/.test(t)) return 'prova';
  if(/rodagem|leve|facil|fácil/.test(t) || sessao==='RUN_EASY_Z2') return 'leve';
  return 'outro';
}
function iaHcClockSeg(txt){
  const p = String(txt || '').split(':').map(Number);
  if(!p.length || p.some(isNaN)) return null;
  return p.length===3 ? p[0]*3600 + p[1]*60 + p[2] : p.length===2 ? p[0]*60 + p[1] : null;
}
function iaHcPaceTexto(txt){ const r = parsePaceRangeToSec(txt); return r ? (r.lo + r.hi)/2 : null; }
// Pace médio planejado da sessão (média dos passos ponderada pelo km), igual a corridaPlanVsReal.
function iaHcPacePlanejado(entry){
  let km = 0, seg = 0;
  (entry.steps || []).forEach(s=>{ const p = iaHcPaceTexto(s.pace); if(p && s.km){ seg += p*s.km; km += s.km; } });
  return km>0 ? seg/km : null;
}
const iaHcForte = (step)=>/Z4|Z5/.test(String(step && step.zona || '')) || /^(Tiro|Limiar|Forte|Subida|Ritmo de prova|Ritmo de maratona)\b/.test(String(step && step.name || ''));
// Blocos fortes planejados × executados (as etapas do GPS são gravadas na mesma ordem dos passos planejados).
function iaHcBlocos(entry, rec){
  const plan = entry.gpsSteps || [];
  const fortes = plan.map((s, i)=>({ s, i })).filter(x=>iaHcForte(x.s));
  if(!fortes.length) return null;
  if(!rec || !Array.isArray(rec.etapas_executadas)) return { planejados:fortes.length, executados:null, completos:null, difPace:[] };
  const ex = rec.etapas_executadas;
  let executados = 0, completos = 0; const difPace = [];
  fortes.forEach(({ s, i })=>{
    const e = ex[i];
    if(!e) return;
    executados++;
    const alvoOk = s.tipo==='tempo' ? (e.duracao_real_seg || 0) >= 0.8*(s.metaSeg || 0) : (e.distancia_real_km || 0) >= 0.8*(s.km || 0);
    if(alvoOk) completos++;
    const alvo = iaHcPaceTexto(s.pace), real = e.pace_medio_real!=null ? e.pace_medio_real*60 : null;
    if(alvo && real && alvoOk) difPace.push(real - alvo);
  });
  return { planejados:fortes.length, executados, completos, difPace };
}

// Junta os dados (síncrono). dados = { treinos, corridaProgress, gpsRuns:{ id: gravação }, checkins, checkinsSemanais,
// checkinDiario, atividadesLivres, pausa:{ inicio, fim? } | null, hoje:'AAAA-MM-DD' }
function iaColetarHistoricoCorrida(dados){
  dados = dados || {};
  const hojeNum = iaHcIsoParaDia(dados.hoje);
  const segHoje = iaHcSegunda(hojeNum);
  const janelaIni = segHoje - (IA_HC_JANELA_SEMANAS - 1)*7;
  const pausaIni = dados.pausa && dados.pausa.inicio ? iaHcIsoParaDia(dados.pausa.inicio) : null;
  const pausaFim = dados.pausa && dados.pausa.fim ? iaHcIsoParaDia(dados.pausa.fim) : hojeNum;
  const prog = dados.corridaProgress || {}, runs = dados.gpsRuns || {};
  const sessoes = [];
  (dados.treinos || []).forEach(entry=>{
    if(!entry || !entry.day || entry.descanso) return;
    const diaPlan = iaHcDiaDaChave(entry.day, hojeNum);
    if(diaPlan===null || diaPlan<janelaIni || diaPlan>hojeNum) return;   // fora da janela ou futuro
    const p0 = prog[entry.day];
    const p = p0 && typeof p0==='object' ? p0 : (p0 ? { done:true } : null);
    const feito = !!(p && p.done);
    if(diaPlan===hojeNum && !feito) return;                          // hoje ainda pode acontecer
    if(!feito && pausaIni!==null && diaPlan>=pausaIni && diaPlan<=pausaFim) return;  // pausa não é treino perdido
    const diaReal = feito && p.data ? iaHcIsoParaDia(p.data) : diaPlan;
    const kmReal = feito ? parseFloat(p.km) : NaN, segReal = feito ? iaHcClockSeg(p.tempo) : null;
    const comRegistro = feito && ((kmReal>0) || !!p.gpsRunId || (segReal>0));
    let paceReal = null;
    if(comRegistro){ paceReal = iaHcPaceTexto(p.pace); if(!paceReal && kmReal>0 && segReal>0) paceReal = segReal/kmReal; }
    const rec = feito && p.gpsRunId ? (runs[p.gpsRunId] || null) : null;
    sessoes.push({
      semanasAtras: Math.floor((segHoje - iaHcSegunda(diaReal))/7), ordem: diaReal,
      tipo: iaHcTipo(entry.type, entry.sessao),
      status: !feito ? 'nao_realizada' : comRegistro ? 'concluida' : 'concluida_sem_registro',
      ajustada: !!entry.ajuste,
      comoFoi: feito && [1, 2, 3, 4].includes(p.comoFoi) ? p.comoFoi : null,
      pacePlan: iaHcPacePlanejado(entry), paceReal,
      minPlan: entry.totalMin || null, minReal: segReal ? segReal/60 : null,
      kmPlan: entry.totalKm || null, kmReal: kmReal>0 ? kmReal : null,
      blocos: feito ? iaHcBlocos(entry, rec) : null, temGps: !!rec,
    });
  });
  const livres = (dados.atividadesLivres || []).filter(a=>a && a.data && (a.tipo==='corrida' || a.tipo==='esteira')).map(a=>({ dia:iaHcIsoParaDia(a.data), km:a.distKm || 0 }))
    .filter(a=>a.dia>=janelaIni && a.dia<=hojeNum);
  const semanaDoNum = (iso)=>Math.floor((segHoje - iaHcSegunda(iaHcIsoParaDia(iso)))/7);
  const semanais = Object.keys(dados.checkinsSemanais || {}).map(k=>dados.checkinsSemanais[k]).filter(c=>c && c.fatos)
    .map(c=>({ semana:c.semana, semanasAtras:c.data ? semanaDoNum(c.data) : null, resposta:(dados.checkins || {})[c.semana] || c.resposta || null, f:c.fatos }))
    .filter(c=>c.semanasAtras===null || (c.semanasAtras>=0 && c.semanasAtras<IA_HC_JANELA_SEMANAS + 2));
  const diarios = Object.keys(dados.checkinDiario || {}).filter(iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso)).map(iso=>({ dia:iaHcIsoParaDia(iso), ...dados.checkinDiario[iso] }))
    .filter(c=>c.dia>hojeNum - 14 && c.dia<=hojeNum);
  return { sessoes, livres, semanais, diarios };
}

function iaHcPaceBloco(lista){
  const com = lista.filter(s=>s.paceReal && s.pacePlan);
  if(!com.length) return null;
  const difs = com.map(s=>s.paceReal - s.pacePlan);
  const dentro = com.filter(s=>Math.abs(s.paceReal - s.pacePlan) <= s.pacePlan*IA_HC_TOL_PACE_PCT).length;
  return { n:com.length, difMedianaSegKm:Math.round(iaHcMediana(difs)), dentroDoAlvo:dentro,
    maisLento:com.filter(s=>s.paceReal - s.pacePlan > s.pacePlan*IA_HC_TOL_PACE_PCT).length,
    maisRapido:com.filter(s=>s.pacePlan - s.paceReal > s.pacePlan*IA_HC_TOL_PACE_PCT).length };
}
function iaHcResumoBlocos(lista){
  const com = lista.filter(s=>s.blocos && s.blocos.executados!==null);
  if(!com.length) return null;
  const d = com.flatMap(s=>s.blocos.difPace);
  return { sessoesComGravacao:com.length, completas:com.filter(s=>s.blocos.completos===s.blocos.planejados).length,
    interrompidas:com.filter(s=>s.blocos.completos<s.blocos.planejados).length,
    blocosPlanejados:com.reduce((t, s)=>t + s.blocos.planejados, 0), blocosCompletos:com.reduce((t, s)=>t + s.blocos.completos, 0),
    paceNosBlocosDifMedianaSegKm: d.length ? Math.round(iaHcMediana(d)) : null };
}
function iaHcEsforco(lista){
  const v = lista.map(s=>s.comoFoi).filter(x=>x!==null);
  return v.length ? { n:v.length, media:iaHcR1(iaHcMedia(v)), dificeis:v.filter(x=>x>=3).length } : null;
}

// Resumo (o que a IA vai ver). Mesma entrada → mesmo resumo (ordem estável, números arredondados).
function iaResumoCorrida(coleta){
  const S = (coleta && coleta.sessoes || []).slice().sort((a, b)=>a.ordem - b.ordem || a.tipo.localeCompare(b.tipo) || a.status.localeCompare(b.status));
  const feitas = S.filter(s=>s.status!=='nao_realizada');
  const planejadas = S.length;
  const status = !planejadas ? 'sem_dados' : planejadas<3 ? 'dados_insuficientes' : 'ok';
  const porSemana = [];
  for(let w=IA_HC_JANELA_SEMANAS - 1; w>=0; w--){
    const l = S.filter(s=>s.semanasAtras===w);
    if(l.length) porSemana.push({ semanasAtras:w, planejadas:l.length, feitas:l.filter(s=>s.status!=='nao_realizada').length });
  }
  const tipos = {};
  ['leve', 'regenerativo', 'longao', 'intervalado', 'limiar', 'fartlek', 'prova', 'outro'].forEach(t=>{
    const l = S.filter(s=>s.tipo===t);
    if(!l.length) return;
    const f = l.filter(s=>s.status!=='nao_realizada');
    const comMin = f.filter(s=>s.minReal && s.minPlan);
    const r = {
      planejadas:l.length, concluidas:l.filter(s=>s.status==='concluida').length, semRegistro:l.filter(s=>s.status==='concluida_sem_registro').length,
      naoRealizadas:l.filter(s=>s.status==='nao_realizada').length,
      esforco:iaHcEsforco(f), pace: IA_HC_TIPOS_POR_BLOCO.includes(t) ? null : iaHcPaceBloco(f),
      ...(IA_HC_TIPOS_POR_BLOCO.includes(t) ? { blocos:iaHcResumoBlocos(f), semGravacao:f.filter(s=>s.blocos && s.blocos.executados===null).length } : {}),
      duracaoRealSobrePlanejada: comMin.length ? iaHcR2(iaHcMediana(comMin.map(s=>s.minReal/s.minPlan))) : null,
    };
    const comDado = IA_HC_TIPOS_POR_BLOCO.includes(t) ? (r.blocos ? r.blocos.sessoesComGravacao : 0) : f.filter(s=>s.status==='concluida').length;
    r.status = comDado >= IA_HC_MIN_TIPO ? 'ok' : (f.length ? 'dados_insuficientes' : 'sem_execucao');
    tipos[t] = r;
  });
  // Intervalados e limiar: blocos fortes completos x interrompidos (só onde há gravação do GPS)
  const blocosFortes = iaHcResumoBlocos(feitas);
  const qualidadeSemGravacao = feitas.filter(s=>s.blocos && s.blocos.executados===null).length;
  // Tendência do pace nas corridas leves (pace real − alvo, para descontar mudanças de zona) e do esforço
  const leves = feitas.filter(s=>(s.tipo==='leve' || s.tipo==='regenerativo' || s.tipo==='longao') && s.paceReal && s.pacePlan);
  let tendencia = { status:'dados_insuficientes', n:leves.length, difSegKm:null, esforco:null };
  if(leves.length>=IA_HC_MIN_TENDENCIA){
    const meio = Math.floor(leves.length/2), a = leves.slice(0, meio), b = leves.slice(leves.length - meio);
    const dA = iaHcMediana(a.map(s=>s.paceReal - s.pacePlan)), dB = iaHcMediana(b.map(s=>s.paceReal - s.pacePlan));
    const delta = Math.round(dB - dA);                     // negativo = mais rápido em relação ao alvo
    const eA = iaHcMedia(a.map(s=>s.comoFoi).filter(x=>x!==null)), eB = iaHcMedia(b.map(s=>s.comoFoi).filter(x=>x!==null));
    tendencia = { status: delta<=-5 ? 'melhorando' : delta>=5 ? 'piorando' : 'estavel', n:leves.length, difSegKm:delta,
      esforco: (eA===null || eB===null) ? null : (eB - eA <= -0.5 ? 'menor' : eB - eA >= 0.5 ? 'maior' : 'igual') };
  }
  // Check-ins (sem região de dor)
  const sem = (coleta.semanais || []).slice().sort((a, b)=>(a.semana || 0) - (b.semana || 0)).slice(-IA_HC_JANELA_SEMANAS)
    .map(c=>({ semanasAtras:c.semanasAtras, resposta:['facil', 'bom', 'dificil'].includes(c.resposta) ? c.resposta : (c.resposta==='normal' ? 'bom' : null),
      fadiga:c.f.fadiga==null ? null : c.f.fadiga, sono:c.f.sono==null ? null : c.f.sono, percepcao:c.f.percepcao==null ? null : c.f.percepcao, dor:!!c.f.dor }));
  const dia = coleta.diarios || [];
  const diario = dia.length ? { dias:dia.length, energiaBaixa:dia.filter(c=>c.energia===1).length, pernasPesadas:dia.filter(c=>c.pernas===3).length, dorForte:dia.filter(c=>c.dor===3).length } : null;
  const livres = coleta.livres || [];
  return {
    versao:IA_HC_VERSAO, janelaSemanas:IA_HC_JANELA_SEMANAS, status,
    sessoes:{ planejadas, concluidas:S.filter(s=>s.status==='concluida').length, concluidasSemRegistro:S.filter(s=>s.status==='concluida_sem_registro').length,
      naoRealizadas:S.filter(s=>s.status==='nao_realizada').length, ajustadasPeloApp:S.filter(s=>s.ajustada).length },
    aderencia:{ geral: planejadas ? iaHcR2(feitas.length/planejadas) : null, porSemana },
    porTipo:tipos,
    blocosFortes, qualidadeSemGravacao,
    tendenciaPaceLeve:tendencia,
    checkinsSemanais: sem.length ? sem : null,
    checkinDiario14dias: diario,
    corridasLivres: livres.length ? { quantidade:livres.length, kmTotal:Math.round(livres.reduce((t, a)=>t + a.km, 0)) } : null,
  };
}

export { IA_HC_VERSAO, IA_HC_JANELA_SEMANAS, iaColetarHistoricoCorrida, iaResumoCorrida, iaHcTipo };
