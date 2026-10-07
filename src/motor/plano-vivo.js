// Plano vivo e treinador: semana atual do plano, carga real, check-in diário, conflitos de 24 h, escada de ajuste,
// treino perdido e check-in semanal. Movido sem alterações de treino-app.html (Bloco 2).
/* eslint-disable */
/* ===== PLANO VIVO + TREINADOR (motor do dia a dia) =====
   Tudo aqui trabalha em cima dos dados que o app já tem: state.treinos (corrida datada), state.musculacao
   (lista por dia da semana), state.corridaProgress e state.workoutSessionsLog (o que foi feito de verdade),
   state.hybridPlanData / state.corridaVdotData (planos). Novos dados persistidos: diarioTreinador,
   checkinDiario, muscAjusteOrig, perdidosTratados (todos no BACKUP_KEYS). */

/* ---------- datas da semana REAL (independe de qual semana a tela está mostrando) ---------- */
function hojeAbbr(){ return DAY_ABBR[(new Date().getDay()+6)%7]; }
function hojeIdx(){ return (new Date().getDay()+6)%7; }
function segundaAtual(){ return vdotMondayOf(new Date()); }
function dataDoDiaSemanaAtual(d){ const m = segundaAtual(); m.setDate(m.getDate()+DAY_ABBR.indexOf(d)); return m; }
function chaveDiaAtual(d){ return d+' '+vdotFormatDDMM(dataDoDiaSemanaAtual(d)); }
function isoDoDiaAtual(d){ return vdotISODate(dataDoDiaSemanaAtual(d)); }
// Roda fn com a tela "apontando" pra semana atual (treinoEntryForDay/dayDateLabel dependem de weekOffset).
function naSemanaAtual(fn){
  const off = state.weekOffset;
  state.weekOffset = 0;
  try{ return fn(); } finally{ state.weekOffset = off; }
}

/* ---------- sessões-chave ---------- */
function ehTipoCorridaChave(tipo){ return /interval|repeti|limiar|tempo|longão|longao|prova/i.test(String(tipo||'')); }
function corridaIntensa(entry){ return !!entry && (ehTipoCorridaChave(entry.type)); }
function muscPernasPesado(lista){
  if(!lista || !lista.length) return false;
  if(lista[0] && lista[0].sessao==='LEG_DAY_HEAVY') return true;
  return lista.filter(e=>e.grupo==='Pernas').length >= 3;
}
function muscTemPernas(lista){ return !!(lista && lista.some(e=>e.grupo==='Pernas')); }
// Musculação é chave quando o objetivo principal é força/massa e o dia é de perna pesada (sessão que
// mais pesa e que o plano protege).
function focoDoPlanoMusc(){
  const hp = state.hybridPlanData;
  const f = hp && (hp.foco || (hp.draft && focoFromObjetivo(hp.draft.objetivo)));
  return f==='musculacao' || f==='massa' || f==='forca';
}
function ehSessaoChaveMusc(lista){ return focoDoPlanoMusc() && muscPernasPesado(lista); }
function ehSessaoChaveDia(d){
  return naSemanaAtual(()=>{
    const e = treinoEntryForDay(d);
    return !!((e && (e.chave || corridaIntensa(e))) || ehSessaoChaveMusc(muscListForDay(d)));
  });
}
// Para a semana exibida na tela (pode não ser a atual).
function ehSessaoChaveDiaExibido(d){
  const e = treinoEntryForDay(d);
  return !!((e && (e.chave || corridaIntensa(e))) || ehSessaoChaveMusc(muscListForDay(d)));
}

/* ---------- plano vivo: a semana atual do plano entra sozinha na agenda ---------- */
function semanaDoPlanoPara(startMondayISO, segunda){
  return Math.floor((segunda - new Date(startMondayISO+'T00:00:00'))/(7*86400000)) + 1;
}
// Gera a semana N do plano V2 com o perfil atual + meta da trajetória + ajuste vindo do check-in.
function gerarSemanaV2(n){
  const hp = state.hybridPlanData;
  if(!hp || !state.athleteProfile) return null;
  const alvo = (hp.trajetoria||[])[n-1] || null;
  const aj = (hp.ajusteProximaSemana && hp.ajusteProximaSemana.semana===n) ? hp.ajusteProximaSemana.ajustes : null;
  let r;
  try{ r = gerarPlanoSemanal(state.athleteProfile, { alvoSemana:alvo, ajustesIniciais:aj }); }
  catch(e){ console.warn('[plano] não consegui gerar a semana', n, e); return null; }
  if(!r || r.bloqueado || !r.semana) return null;
  const w = r.semana;
  w.weekNumber = n; w.totalWeeks = hp.plan.length;
  if(alvo && alvo.fase) w.phaseLabel = alvo.fase;
  const f = alvo && alvo.muscSeriesFator;
  if(f && f!==1){
    Object.keys(w.muscPlan||{}).forEach(d=>w.muscPlan[d].forEach(e=>{ const s = parseInt(e.series,10); if(s) e.series = String(Math.max(2, Math.round(s*f))); }));
  }
  (w.corridaWeek||[]).forEach(c=>{ if(ehTipoCorridaChave(c.type)) c.chave = true; });
  return w;
}
// Chamada no init: descobre em que semana do plano estamos pela data e coloca essa semana na agenda (uma
// vez por semana — materializadaSeg). Semanas passadas ficam como histórico; nada concluído é apagado.
async function atualizarSemanaDoPlano(){
  const seg = segundaAtual();
  const segISO = vdotISODate(seg);
  restaurarAjustesMuscAntigos(segISO);
  const hp = state.hybridPlanData;
  if(hp && hp.plan && hp.plan.length && hp.startMonday){
    const n = semanaDoPlanoPara(hp.startMonday, seg);
    if(n<1 || n>hp.plan.length) return;
    if(hp.currentWeekIndex===n && hp.materializadaSeg===segISO) return;
    const anterior = hp.plan[(hp.currentWeekIndex||1)-1];
    const diasMuscAnteriores = anterior && anterior.muscPlan ? Object.keys(anterior.muscPlan) : [];
    let week = hp.plan[n-1];
    if(hp.motorV2 && (!week || week.pendente)){
      if(!state.athleteProfile){ try{ await carregarAthleteProfile(); }catch(e){} }
      const gerada = gerarSemanaV2(n);
      if(gerada) week = hp.plan[n-1] = gerada;
    }
    if(!week || week.pendente) return; // não deu pra gerar (perfil ausente): tenta de novo na próxima abertura
    if(hp.materializadaSeg!==segISO || hp.currentWeekIndex!==n){
      // A semana 1 já foi materializada na criação do plano; as outras entram aqui.
      if(!(n===1 && !hp.materializadaSeg)) materializeHybridWeekIntoState(week, hp.startMonday, diasMuscAnteriores);
      hp.currentWeekIndex = n;
      hp.estados = estadosDaSemana(n, week.phaseLabel); // força e corrida com estado próprio (hoje juntos)
      hp.materializadaSeg = segISO;
      await saveHybridPlanData();
    }
    return;
  }
  const cv = state.corridaVdotData;
  if(cv && cv.plan && cv.plan.length && cv.startMonday){
    const n = semanaDoPlanoPara(cv.startMonday, seg);
    if(n<1 || n>cv.plan.length) return;
    if(cv.currentWeekIndex===n && cv.materializadaSeg===segISO) return;
    const week = cv.plan.find(w=>w.weekNumber===n);
    if(!week) return;
    materializeVdotWeekIntoTreinos(week, cv.startMonday);
    state.corridaVdotData = { ...cv, currentWeekIndex:n, materializadaSeg:segISO };
    await saveCorridaVdotData();
  }
}
// Prévia de semana futura (tela Treino): corrida do plano daquela semana sem gravar na agenda.
const _previaSemanas = {};
function entradaPreviaDoPlano(d){
  if((state.weekOffset||0)<=0) return null;
  const hp = state.hybridPlanData, cv = state.corridaVdotData;
  const seg = displayedWeekMonday();
  const dataTxt = vdotFormatDDMM(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate()+DAY_ABBR.indexOf(d)));
  if(hp && hp.plan && hp.startMonday){
    const n = semanaDoPlanoPara(hp.startMonday, seg);
    if(n<1 || n>hp.plan.length) return null;
    let w = hp.plan[n-1];
    if(w && w.pendente && hp.motorV2){
      if(!_previaSemanas[n]) _previaSemanas[n] = gerarSemanaV2(n);
      w = _previaSemanas[n];
    }
    const c = w && w.corridaWeek ? w.corridaWeek.find(x=>x.day===d) : null;
    return c ? { ...c, day: d+' '+dataTxt, previa:true, chave: !!(c.chave || ehTipoCorridaChave(c.type)) } : null;
  }
  if(cv && cv.plan && cv.startMonday){
    const n = semanaDoPlanoPara(cv.startMonday, seg);
    const w = cv.plan.find(x=>x.weekNumber===n);
    const c = w && w.days ? w.days.find(x=>x.day===d) : null;
    return c ? { ...c, type: c.title || c.type, day: d+' '+dataTxt, previa:true, chave: ehTipoCorridaChave(c.type) } : null;
  }
  return null;
}

/* ---------- carga real (o que foi FEITO, não o planejado) ---------- */
function pontosPernasCorrida(tipo){
  const t = String(tipo||'');
  if(/interval|repeti/i.test(t)) return 40;
  if(/longão|longao/i.test(t)) return 35;
  if(/limiar|tempo/i.test(t)) return 30;
  if(/regenerat|recupera/i.test(t)) return 5;
  return 10;
}
function minutosDeTempo(txt){
  const p = String(txt||'').split(':').map(x=>parseInt(x,10));
  if(p.some(isNaN) || !p.length) return 0;
  return p.length===3 ? p[0]*60+p[1]+p[2]/60 : p[0]+(p[1]||0)/60;
}
const COMO_FOI_FATOR = { 1:0.85, 2:1, 3:1.2, 4:1.4 };
function eventosDeCarga(){
  const ev = [];
  Object.entries(state.corridaProgress||{}).forEach(([k,v])=>{
    if(!v || typeof v!=='object' || !v.done || !v.data) return;
    // concluído sem registro não gera carga (Bloco 3)
    if(!progressoTemRegistro(v)) return;
    const e = (state.treinos||[]).find(t=>t.day===k);
    const tipo = e ? e.type : '';
    const min = minutosDeTempo(v.tempo) || (e && e.totalMin) || ((parseFloat(v.km)||0)*6.5);
    const f = COMO_FOI_FATOR[v.comoFoi] || 1;
    const intens = ehTipoCorridaChave(tipo) ? 1.5 : 1;
    ev.push({ data:v.data, pernas: pontosPernasCorrida(tipo)*f, geral: min*intens*f, tipo:'corrida' });
  });
  // Atividades livres também contam na carga real (Bloco 3): corrida/esteira como corrida leve, caminhada como regenerativo.
  (state.atividadesLivres||[]).forEach(a=>{
    if(!a || !a.data) return;
    const min = (a.tempoSeg||0)/60 || (a.distKm||0)*6.5;
    const caminhada = a.tipo==='caminhada';
    ev.push({ data:a.data, pernas: pontosPernasCorrida(caminhada ? 'regenerativo' : ''), geral: min*(caminhada ? 0.5 : 1), tipo:'corrida' });
  });
  (state.workoutSessionsLog||[]).forEach(s=>{
    if(!s || !s.data) return;
    const seriesPerna = (s.exercicios||[]).filter(x=>x.grupo==='Pernas').reduce((t,x)=>t+(parseInt(x.series,10)||0), 0);
    const f = COMO_FOI_FATOR[s.comoFoi] || 1;
    const pernas = (seriesPerna>=9 ? 40 : seriesPerna>=4 ? 20 : seriesPerna>0 ? 10 : 0) * f;
    ev.push({ data:s.data, pernas, geral: ((s.duracaoSeg||2700)/60)*1.2*f, tipo:'musc' });
  });
  return ev;
}
function diasEntre(isoA, isoB){ return Math.round((new Date(isoB+'T00:00:00') - new Date(isoA+'T00:00:00'))/86400000); }
// Estados simples pra interface: baixa / moderada / alta (sem números na tela).
function cargaReal(){
  const hoje = todayISO();
  const ev = eventosDeCarga();
  // Pernas: cada sessão soma seus pontos e recupera ~25 pontos por dia.
  let pernas = 0;
  ev.forEach(e=>{ const d = diasEntre(e.data, hoje); if(d>=0 && d<=3) pernas += Math.max(0, e.pernas - 25*d); });
  // Geral: últimos 7 dias × média semanal das 4 semanas anteriores.
  let aguda = 0, cronica = 0, semanaAnterior = 0;
  ev.forEach(e=>{ const d = diasEntre(e.data, hoje); if(d>=0 && d<7) aguda += e.geral; if(d>=7 && d<35) cronica += e.geral; if(d>=7 && d<14) semanaAnterior += e.geral; });
  const cronSem = cronica/4;
  const ci = (state.checkinDiario||{})[hoje];
  let nivelPernas = pernas>=50 ? 2 : pernas>=25 ? 1 : 0;
  if(ci && ci.pernas===3) nivelPernas = Math.min(2, nivelPernas+1);
  if(ci && ci.dor===3) nivelPernas = 2;
  const razao = cronSem>0 ? aguda/cronSem : (aguda>0 ? 1 : 0);
  let nivelGeral = cronSem>0 ? (razao>1.3 ? 2 : razao>=0.8 ? 1 : 0) : (aguda>240 ? 2 : aguda>60 ? 1 : 0);
  if(ci && ci.energia===1) nivelGeral = Math.min(2, nivelGeral+1);
  const nomes = ['baixa','moderada','alta'];
  const tendencia = semanaAnterior>0 ? (aguda>semanaAnterior*1.15 ? 'subindo' : aguda<semanaAnterior*0.85 ? 'caindo' : 'estável') : (aguda>0 ? 'subindo' : 'estável');
  return { pernas:nomes[nivelPernas], geral:nomes[nivelGeral], nivelPernas, nivelGeral, tendencia, pontosPernas:Math.round(pernas), razao: Math.round(razao*100)/100 };
}

/* ---------- check-in diário (3 toques) — unifica com a dor nas pernas (DOMS) ---------- */
async function saveCheckinDiario(){ try{ await window.storage.set('checkinDiario', JSON.stringify(state.checkinDiario||{}), false); }catch(e){} }
function checkinDiarioPendente(){ return !(state.checkinDiario||{})[todayISO()]; }
// energia: 1 baixa · 2 ok · 3 alta | pernas: 1 leves · 2 normais · 3 pesadas | dor: 1 nenhuma · 2 leve · 3 forte
const DOR_PARA_DOMS = { 1:0, 2:4, 3:7 };
async function registrarCheckinDiario(resp){
  state.checkinDiario = state.checkinDiario || {};
  state.checkinDiario[todayISO()] = { ...resp, em:Date.now() };
  await saveCheckinDiario();
  // A dor nas pernas do check-in é a mesma informação da escala de DOMS: alimenta a regra existente
  // (dor ≥7 → corrida regenerativa e −25% nas séries de perna só hoje).
  if(resp.dor){
    state.domsPernas = state.domsPernas || {};
    state.domsPernas[todayISO()] = DOR_PARA_DOMS[resp.dor];
    saveDomsPernas();
    aplicarDomsDeHoje(DOR_PARA_DOMS[resp.dor]);
  }
}

/* ---------- conflitos de 24 h entre corrida e musculação ---------- */
function retratoDia(d, sim){
  if(sim && sim[d]) return sim[d];
  return naSemanaAtual(()=>({ corrida: treinoEntryForDay(d), musc: muscListForDay(d) }));
}
function conflitosDoDia(d, sim){
  const i = DAY_ABBR.indexOf(d);
  const out = [];
  const hoje = retratoDia(d, sim);
  const ontem = i>0 ? retratoDia(DAY_ABBR[i-1], sim) : null;
  const amanha = i<6 ? retratoDia(DAY_ABBR[i+1], sim) : null;
  const intensa = (r)=> r && corridaIntensa(r.corrida);
  const pesado = (r)=> r && muscPernasPesado(r.musc);
  if(intensa(hoje) && pesado(hoje)) out.push('corrida forte e pernas pesadas no mesmo dia');
  if(intensa(hoje) && pesado(ontem)) out.push('corrida forte no dia seguinte às pernas pesadas');
  if(pesado(hoje) && intensa(amanha)) out.push('pernas pesadas na véspera de corrida forte');
  if(pesado(hoje) && intensa(ontem)) out.push('pernas pesadas no dia seguinte a corrida forte');
  if(intensa(hoje) && (intensa(ontem) || intensa(amanha))) out.push('dois treinos fortes de corrida seguidos');
  return out;
}

/* ---------- diário do treinador ---------- */
async function saveDiarioTreinador(){ try{ await window.storage.set('diarioTreinador', JSON.stringify(state.diarioTreinador||[]), false); }catch(e){} }
function registrarNoDiario(reg){
  state.diarioTreinador = state.diarioTreinador || [];
  state.diarioTreinador.unshift({ data:todayISO(), em:Date.now(), ...reg });
  saveDiarioTreinador();
}
function resumoCorrida(e){ return e ? `${e.type||'Corrida'}${e.totalKm ? ' · '+String(e.totalKm).replace('.',',')+' km' : ''}` : 'sem corrida'; }
function resumoMusc(l){ return l && l.length ? `${muscTituloDoDia(hojeAbbr(), l)} · ${l.length} exercício${l.length===1?'':'s'}` : 'sem musculação'; }

/* ---------- ajustes de musculação são da semana: guardam o original e voltam sozinhos ---------- */
async function saveMuscAjusteOrig(){ try{ await window.storage.set('muscAjusteOrig', JSON.stringify(state.muscAjusteOrig||{}), false); }catch(e){} }
function guardarOriginalMusc(d){
  state.muscAjusteOrig = state.muscAjusteOrig || {};
  const seg = vdotISODate(segundaAtual());
  if(state.muscAjusteOrig[d] && state.muscAjusteOrig[d].semana===seg) return; // já guardado nesta semana
  state.muscAjusteOrig[d] = { semana:seg, lista: JSON.parse(JSON.stringify(state.musculacao[d]||[])) };
}
function restaurarAjustesMuscAntigos(segISO){
  const o = state.muscAjusteOrig || {};
  let mudou = false;
  Object.keys(o).forEach(d=>{
    if(o[d].semana===segISO) return;
    const lista = o[d].lista || [];
    if(lista.length) state.musculacao[d] = lista.map(e=>({ ...e, done:false }));
    else delete state.musculacao[d];
    delete o[d]; mudou = true;
  });
  if(mudou){ saveMusc(); saveMuscAjusteOrig(); }
}

/* ---------- "Por quê?" do dia ---------- */
function papelCorrida(e){
  const t = String(e.type||'');
  if(/interval|repeti/i.test(t)) return 'Treino forte da semana para ganhar velocidade';
  if(/limiar|tempo/i.test(t)) return 'Ritmo de limiar para sustentar velocidade por mais tempo';
  if(/longão|longao/i.test(t)) return 'Longão para construir resistência';
  if(/regenerat/i.test(t)) return 'Corrida bem leve para recuperar';
  if(/fartlek/i.test(t)) return 'Variação leve de ritmo sem picos de cansaço';
  return 'Corrida leve para somar quilômetros sem cansar';
}
function papelMusc(l){
  if(muscPernasPesado(l)) return 'Força de pernas';
  if(!muscTemPernas(l)) return 'Força de superiores, sem cansar as pernas';
  return 'Força do corpo todo com pernas moderadas';
}
// Uma ou duas frases: papel do treino + contexto (ontem/carga/check-in) + o que protege (amanhã).
function porQueHoje(d, sub){
  const exibido = { corrida: treinoEntryForDay(d), musc: muscListForDay(d) };
  const i = DAY_ABBR.indexOf(d);
  const e = (sub==='musculacao') ? null : exibido.corrida;
  const l = (sub==='corrida') ? [] : exibido.musc;
  const ehHoje = (state.weekOffset||0)===0 && d===hojeAbbr();
  const nota = ehHoje ? (state.domsPernas||{})[todayISO()] : null;
  if(nota!=null && nota>=7){
    if(e) return `Dor nas pernas ${nota}/10: hoje a corrida vira regenerativa para não piorar.`;
    if(muscTemPernas(l)) return `Dor nas pernas ${nota}/10: séries de perna −25% só hoje.`;
  }
  if(e && e.ajuste && e.ajuste.motivo) return `Ajustado: ${e.ajuste.motivo}`;
  let papel = e ? papelCorrida(e) : (l && l.length ? papelMusc(l) : '');
  if(!papel) return '';
  const ontem = i>0 ? { corrida: treinoEntryForDay(DAY_ABBR[i-1]), musc: muscListForDay(DAY_ABBR[i-1]) } : null;
  const amanha = i<6 ? { corrida: treinoEntryForDay(DAY_ABBR[i+1]), musc: muscListForDay(DAY_ABBR[i+1]) } : null;
  const partes = [];
  if(ontem && muscPernasPesado(ontem.musc)) partes.push('ontem foi dia de pernas');
  else if(ontem && corridaIntensa(ontem.corrida)) partes.push(`ontem teve ${String(ontem.corrida.type).toLowerCase()}`);
  if(ehHoje){
    const c = cargaReal();
    if(c.pernas==='alta' && !partes.length) partes.push('suas pernas estão carregadas');
    const ci = (state.checkinDiario||{})[todayISO()];
    if(ci && ci.energia===1) partes.push('você marcou energia baixa');
  }
  let protege = '';
  if(amanha && corridaIntensa(amanha.corrida) && !(e && corridaIntensa(e))) protege = ` para chegar inteiro ao ${String(amanha.corrida.type).toLowerCase()} de amanhã`;
  else if(amanha && muscPernasPesado(amanha.musc) && e && !corridaIntensa(e)) protege = ' e deixar as pernas prontas para amanhã';
  const ctx = partes.join(' e ');
  return `${papel}${protege}.` + (ctx ? ' '+ctx.charAt(0).toUpperCase()+ctx.slice(1)+'.' : '');
}

/* ---------- escada de ajuste (manter → mais leve → reduzir → trocar → mover → descansar) ---------- */
function paceFacil(){
  const cv = state.corridaVdotData;
  return cv && cv.paces && cv.paces.E ? cv.paces.E : '';
}
function copiaCorrida(e){ return { type:e.type, totalKm:e.totalKm, totalMin:e.totalMin, steps:e.steps, gpsSteps:e.gpsSteps, mainPace:e.mainPace, mainDesc:e.mainDesc }; }
function marcarAjusteCorrida(e, motivo){ if(!e.ajuste) e.ajuste = { original: copiaCorrida(e) }; e.ajuste.motivo = motivo; }
function escalarPassos(steps, f){ return (steps||[]).map(s=>({ ...s, km: s.km ? roundToHalf(s.km*f) || s.km : s.km, metaSeg: s.metaSeg ? Math.round(s.metaSeg*f) : s.metaSeg })); }
// Destinos possíveis pra mover a sessão de `d` (até o fim da semana), sem criar conflito de 24 h e sem
// ocupar dia que já tem a mesma modalidade. `aPartir` = índice do primeiro dia permitido.
function destinosParaMover(d, mod, aPartir){
  const atual = {};
  DAY_ABBR.forEach(x=>{ atual[x] = retratoDia(x); });
  const out = [];
  for(let i=aPartir; i<7; i++){
    const alvo = DAY_ABBR[i];
    if(alvo===d) continue;
    if(mod==='corrida' && atual[alvo].corrida) continue;
    if(mod==='musc' && atual[alvo].musc && atual[alvo].musc.length) continue;
    const sim = {};
    DAY_ABBR.forEach(x=>{ sim[x] = { corrida: atual[x].corrida, musc: atual[x].musc }; });
    if(mod==='corrida'){ sim[alvo].corrida = atual[d].corrida; sim[d].corrida = null; }
    else { sim[alvo].musc = atual[d].musc; sim[d].musc = []; }
    const novos = [alvo, DAY_ABBR[i-1], DAY_ABBR[i+1]].filter(Boolean).flatMap(x=>conflitosDoDia(x, sim));
    if(!novos.length) out.push(alvo);
  }
  return out;
}
async function moverSessao(d, alvo, mod, motivo){
  if(mod==='corrida'){
    const e = naSemanaAtual(()=>treinoEntryForDay(d));
    if(!e) return false;
    const antes = resumoCorrida(e);
    marcarAjusteCorrida(e, motivo || `movido de ${DAY_FULLNAME[d]||d} para ${DAY_FULLNAME[alvo]||alvo}`);
    e.day = chaveDiaAtual(alvo);
    saveTreinos();
    registrarNoDiario({ dia:alvo, original:`${DAY_FULLNAME[d]||d}: ${antes}`, alteracao:'Movido', motivo: motivo||'', novo:`${DAY_FULLNAME[alvo]||alvo}: ${antes}` });
  }else{
    guardarOriginalMusc(d); guardarOriginalMusc(alvo);
    const lista = state.musculacao[d] || [];
    state.musculacao[alvo] = lista; delete state.musculacao[d];
    saveMusc(); saveMuscAjusteOrig();
    registrarNoDiario({ dia:alvo, original:`${DAY_FULLNAME[d]||d}: musculação`, alteracao:'Movido', motivo: motivo||'', novo:`${DAY_FULLNAME[alvo]||alvo}: musculação` });
  }
  return true;
}
// Opções calculadas pro dia: cada uma com título, explicação, se é a recomendada e a ação.
function opcoesAjuste(d){
  return naSemanaAtual(()=>{
    const e = treinoEntryForDay(d);
    const l = muscListForDay(d);
    const corridaPendente = e && !isCorridaDone(d) ? e : null;
    const muscPendente = l.length && !l.every(x=>x.done) ? l : null;
    if(!corridaPendente && !muscPendente) return [];
    const carga = cargaReal();
    const ci = (state.checkinDiario||{})[todayISO()] || null;
    const chave = !!((corridaPendente && corridaIntensa(corridaPendente)) || (muscPendente && ehSessaoChaveMusc(muscPendente)));
    const cansado = carga.nivelPernas>=2 || carga.nivelGeral>=2 || (ci && (ci.energia===1 || ci.pernas===3 || ci.dor===3));
    const i = DAY_ABBR.indexOf(d);
    const motivoBase = ci && ci.energia===1 ? 'energia baixa no check-in' : ci && ci.pernas===3 ? 'pernas pesadas no check-in' : carga.nivelPernas>=2 ? 'carga alta nas pernas' : carga.nivelGeral>=2 ? 'carga alta na semana' : 'escolha sua';
    const opcoes = [];
    const mod = corridaPendente ? 'corrida' : 'musc';
    // 1. manter + orientação
    opcoes.push({ id:'manter', titulo:'Manter como está', desc: cansado ? 'Aqueça bem e pare se sentir dor fora do normal.' : 'Tudo certo para o treino planejado.', recomendado: !cansado,
      aplicar: ()=>{ registrarNoDiario({ dia:d, original: corridaPendente ? resumoCorrida(corridaPendente) : resumoMusc(muscPendente), alteracao:'Mantido', motivo: motivoBase, novo:'igual' }); return 'Treino mantido.'; } });
    // 2. mais leve (intensidade)
    if(corridaPendente && corridaIntensa(corridaPendente) && !/longão|longao/i.test(corridaPendente.type)){
      opcoes.push({ id:'leve', titulo:'Deixar mais leve', desc:'Troca o treino forte por corrida leve na mesma distância.', recomendado: cansado && !chave,
        aplicar: ()=>{ const antes = resumoCorrida(corridaPendente); marcarAjusteCorrida(corridaPendente, `mais leve hoje (${motivoBase})`);
          corridaPendente.type = 'Rodagem Leve'; corridaPendente.chave = false; if(paceFacil()) corridaPendente.mainPace = paceFacil();
          corridaPendente.steps = null; corridaPendente.gpsSteps = null; saveTreinos();
          registrarNoDiario({ dia:d, original:antes, alteracao:'Mais leve', motivo:motivoBase, novo:resumoCorrida(corridaPendente) }); return 'Treino ficou mais leve.'; } });
    }else if(muscPendente){
      opcoes.push({ id:'leve', titulo:'Deixar mais leve', desc:'Mesmos exercícios com esforço moderado (~10% menos carga).', recomendado: cansado && !chave && !corridaPendente,
        aplicar: ()=>{ guardarOriginalMusc(d); state.musculacao[d] = (state.musculacao[d]||[]).map(x=>({ ...x, rpe: Math.min(x.rpe||7, 6), leve:true })); saveMusc(); saveMuscAjusteOrig();
          registrarNoDiario({ dia:d, original:resumoMusc(muscPendente), alteracao:'Mais leve', motivo:motivoBase, novo:'mesmos exercícios, esforço moderado' }); return 'Musculação mais leve hoje.'; } });
    }
    // 3. reduzir volume
    if(corridaPendente && parseFloat(corridaPendente.totalKm)>0){
      const novoKm = Math.max(1, roundToHalf(parseFloat(corridaPendente.totalKm)*0.7));
      opcoes.push({ id:'reduzir', titulo:`Reduzir para ${String(novoKm).replace('.',',')} km`, desc:'Mesmo tipo de treino, cerca de 30% menos volume.', recomendado: cansado && chave,
        aplicar: ()=>{ const antes = resumoCorrida(corridaPendente); const f = novoKm/parseFloat(corridaPendente.totalKm); marcarAjusteCorrida(corridaPendente, `volume reduzido (${motivoBase})`);
          corridaPendente.totalKm = novoKm; if(corridaPendente.totalMin) corridaPendente.totalMin = Math.round(corridaPendente.totalMin*f);
          corridaPendente.steps = corridaPendente.steps ? escalarPassos(corridaPendente.steps, f) : corridaPendente.steps;
          corridaPendente.gpsSteps = corridaPendente.gpsSteps ? escalarPassos(corridaPendente.gpsSteps, f) : corridaPendente.gpsSteps; saveTreinos();
          registrarNoDiario({ dia:d, original:antes, alteracao:'Volume reduzido', motivo:motivoBase, novo:resumoCorrida(corridaPendente) }); return 'Volume reduzido.'; } });
    }else if(muscPendente){
      opcoes.push({ id:'reduzir', titulo:'Versão curta', desc:'Mantém os exercícios principais e tira uma série de cada.', recomendado:false,
        aplicar: ()=>{ guardarOriginalMusc(d); const base = (state.musculacao[d]||[]);
          // O plano já vem com os exercícios principais primeiro (base → auxiliar → isolado).
          const manter = base.slice(0, Math.min(4, base.length));
          state.musculacao[d] = manter.map(x=>({ ...x, series: String(Math.max(2, (parseInt(x.series,10)||3)-1)) })); saveMusc(); saveMuscAjusteOrig();
          registrarNoDiario({ dia:d, original:resumoMusc(muscPendente), alteracao:'Versão curta', motivo:motivoBase, novo:resumoMusc(state.musculacao[d]) }); return 'Versão curta pronta.'; } });
    }
    // 4. trocar tipo (corrida forte/longão → regenerativo curto)
    if(corridaPendente && corridaIntensa(corridaPendente)){
      opcoes.push({ id:'trocar', titulo:'Trocar por regenerativo', desc:'30 min bem leves no lugar do treino forte.', recomendado:false,
        aplicar: ()=>{ const antes = resumoCorrida(corridaPendente); marcarAjusteCorrida(corridaPendente, `trocado por regenerativo (${motivoBase})`);
          corridaPendente.type = 'Regenerativo'; corridaPendente.chave = false; corridaPendente.totalKm = Math.max(2, roundToHalf(Math.min(5, (parseFloat(corridaPendente.totalKm)||5)*0.5)));
          corridaPendente.totalMin = 30; if(paceFacil()) corridaPendente.mainPace = paceFacil(); corridaPendente.steps = null; corridaPendente.gpsSteps = null; saveTreinos();
          registrarNoDiario({ dia:d, original:antes, alteracao:'Trocado', motivo:motivoBase, novo:resumoCorrida(corridaPendente) }); return 'Trocado por regenerativo.'; } });
    }
    // 5. mover (protege sessão-chave)
    const destinos = destinosParaMover(d, mod, Math.max(hojeIdx(), i)+1);
    if(destinos.length){
      const alvo = destinos[0];
      opcoes.push({ id:'mover', titulo:`Mover para ${(DAY_FULLNAME[alvo]||alvo).split('-')[0].toLowerCase()}`, desc: chave ? 'Faz o treino importante com o corpo mais descansado.' : 'Passa a sessão para outro dia livre da semana.', recomendado: cansado && chave,
        aplicar: async ()=>{ await moverSessao(d, alvo, mod, motivoBase); return `Movido para ${DAY_FULLNAME[alvo]||alvo}.`; } });
    }
    // 6. descanso / mobilidade
    opcoes.push({ id:'descansar', titulo:'Descansar hoje', desc: chave ? 'O treino-chave é descartado nesta semana.' : 'Hoje fica só mobilidade leve.', recomendado: !!(ci && ci.dor===3),
      aplicar: ()=>{
        if(corridaPendente){ const antes = resumoCorrida(corridaPendente); marcarAjusteCorrida(corridaPendente, `descanso (${motivoBase})`); corridaPendente.descanso = true; saveTreinos();
          registrarNoDiario({ dia:d, original:antes, alteracao:'Descanso', motivo:motivoBase, novo:'descanso / mobilidade' }); }
        if(muscPendente){ guardarOriginalMusc(d); state.musculacao[d] = []; saveMusc(); saveMuscAjusteOrig();
          registrarNoDiario({ dia:d, original:resumoMusc(muscPendente), alteracao:'Descanso', motivo:motivoBase, novo:'descanso / mobilidade' }); }
        return 'Dia de descanso.';
      } });
    // Garante exatamente uma recomendada.
    if(!opcoes.some(o=>o.recomendado)) opcoes[0].recomendado = true;
    let achou = false; opcoes.forEach(o=>{ if(o.recomendado){ if(achou) o.recomendado = false; achou = true; } });
    return opcoes;
  });
}

/* ---------- treino perdido ---------- */
async function savePerdidosTratados(){ try{ await window.storage.set('perdidosTratados', JSON.stringify(state.perdidosTratados||{}), false); }catch(e){} }
function treinosPerdidos(){
  return naSemanaAtual(()=>{
    const out = [];
    const tratados = state.perdidosTratados || {};
    for(let i=0; i<hojeIdx(); i++){
      const d = DAY_ABBR[i];
      if(antesDoInicioDoPlano(d)) continue;
      const e = treinoEntryForDay(d);
      if(e && !isCorridaDone(d) && !tratados[e.day+'|corrida']) out.push({ dia:d, mod:'corrida', id:e.day+'|corrida', titulo: resumoCorrida(e), chave: corridaIntensa(e) || !!e.chave });
      const l = muscListForDay(d);
      const idM = isoDoDiaAtual(d)+'|musc';
      if(l.length && !l.some(x=>x.done) && !tratados[idM]) out.push({ dia:d, mod:'musc', id:idM, titulo:'Musculação', chave: ehSessaoChaveMusc(l) });
    }
    // Sessões-chave primeiro.
    return out.sort((a,b)=>(b.chave?1:0)-(a.chave?1:0));
  });
}
function propostaPerdido(p){
  const destinos = destinosParaMover(p.dia, p.mod, hojeIdx());
  return { alvo: p.chave && destinos.length ? destinos[0] : null };
}
async function resolverPerdido(p, acao){
  state.perdidosTratados = state.perdidosTratados || {};
  state.perdidosTratados[p.id] = acao;
  if(acao==='remarcar'){
    const { alvo } = propostaPerdido(p);
    if(alvo) await moverSessao(p.dia, alvo, p.mod, 'treino perdido remarcado');
  }else{
    registrarNoDiario({ dia:p.dia, original:p.titulo, alteracao:'Não reposto', motivo:'treino perdido', novo:'segue a semana sem repor' });
  }
  await savePerdidosTratados();
}

/* ---------- check-in semanal pelo motor V2 ---------- */
// Não reconstrói o plano com o motor antigo: guarda a resposta e transforma em ajuste da próxima
// semana (gerada pelo V2 quando ela começar). Semanas futuras já geradas voltam a "pendente".
function aplicarCheckinSemanalV2(hp, week, d, resposta){
  const severo = (d.fadiga && d.fadiga>=4) || !!d.dor;
  const ajustes = {};
  if(severo) ajustes.volumeFator = 0.8;
  if(d.dor) ajustes.aliviarInferior = true;
  if(d.fadiga && d.fadiga>=5) ajustes.semQualidade = true;
  if(resposta==='facil' && !severo) ajustes.volumeFator = 1.05;
  const plan = hp.plan.map(w=> (w.weekNumber>week && !w.pendente && w.motorV2) ? { ...w, corridaWeek:[], muscPlan:{}, pendente:true, alvo:(hp.trajetoria||[])[w.weekNumber-1]||null } : w);
  Object.keys(_previaSemanas).forEach(k=>delete _previaSemanas[k]);
  return { ...hp, plan, ajusteProximaSemana: Object.keys(ajustes).length ? { semana: week+1, ajustes } : null };
}
/* ===== fim PLANO VIVO + TREINADOR ===== */

// O app (script principal) e os testes usam estes nomes como globais.
Object.assign(globalThis, {
  hojeAbbr,
  hojeIdx,
  segundaAtual,
  dataDoDiaSemanaAtual,
  chaveDiaAtual,
  isoDoDiaAtual,
  naSemanaAtual,
  ehTipoCorridaChave,
  corridaIntensa,
  muscPernasPesado,
  muscTemPernas,
  focoDoPlanoMusc,
  ehSessaoChaveMusc,
  ehSessaoChaveDia,
  ehSessaoChaveDiaExibido,
  semanaDoPlanoPara,
  gerarSemanaV2,
  atualizarSemanaDoPlano,
  _previaSemanas,
  entradaPreviaDoPlano,
  pontosPernasCorrida,
  minutosDeTempo,
  COMO_FOI_FATOR,
  eventosDeCarga,
  diasEntre,
  cargaReal,
  saveCheckinDiario,
  checkinDiarioPendente,
  DOR_PARA_DOMS,
  registrarCheckinDiario,
  retratoDia,
  conflitosDoDia,
  saveDiarioTreinador,
  registrarNoDiario,
  resumoCorrida,
  resumoMusc,
  saveMuscAjusteOrig,
  guardarOriginalMusc,
  restaurarAjustesMuscAntigos,
  papelCorrida,
  papelMusc,
  porQueHoje,
  paceFacil,
  copiaCorrida,
  marcarAjusteCorrida,
  escalarPassos,
  destinosParaMover,
  moverSessao,
  opcoesAjuste,
  savePerdidosTratados,
  treinosPerdidos,
  propostaPerdido,
  resolverPerdido,
  aplicarCheckinSemanalV2,
});
