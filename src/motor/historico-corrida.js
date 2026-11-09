// Histórico real de corrida para o Motor V2 (Etapa 1): minutos por semana (últimas 4 semanas) e maior corrida dos
// últimos 30 dias, a partir do que foi FEITO com registro (state.corridaProgress) e das atividades livres de corrida.
// Função pura: sem histórico suficiente devolve null e o motor se comporta exatamente como antes.
const HIST_CORRIDA = { diasVolume:28, diasLongo:30, minRegistros:3, minSemanas:2, minPorKmSemTempo:6.5 };

function histTempoMin(txt){
  const p = String(txt || '').split(':').map(x=>parseInt(x,10));
  if(!p.length || p.some(isNaN)) return 0;
  return p.length===3 ? p[0]*60 + p[1] + p[2]/60 : p[0] + (p[1]||0)/60;
}
function historicoCorridaReal(progresso, atividades, hoje){
  const ref = hoje ? new Date(hoje) : new Date();
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const itens = [];
  Object.values(progresso || {}).forEach(v=>{
    if(!v || typeof v!=='object' || !v.done || !v.data) return;
    const km = parseFloat(v.km) || 0, tempo = histTempoMin(v.tempo);
    if(!(v.gpsRunId || km>0 || tempo>0)) return;            // concluído sem registro não conta
    itens.push({ data:v.data, min: tempo || km*HIST_CORRIDA.minPorKmSemTempo });
  });
  (atividades || []).forEach(a=>{
    if(!a || !a.data || a.tipo==='caminhada') return;
    const min = (a.tempoSeg||0)/60 || (a.distKm||0)*HIST_CORRIDA.minPorKmSemTempo;
    itens.push({ data:a.data, min });
  });
  let total = 0, maior = 0, registros = 0; const semanas = new Set();
  itens.forEach(it=>{
    const d = new Date(String(it.data).slice(0,10) + 'T00:00:00');
    if(isNaN(d) || !(it.min>0)) return;
    const dias = Math.round((base - d)/86400000);
    if(dias<0) return;
    if(dias < HIST_CORRIDA.diasLongo) maior = Math.max(maior, it.min);
    if(dias < HIST_CORRIDA.diasVolume){
      total += it.min; registros++;
      const seg = new Date(d); seg.setDate(seg.getDate() - ((seg.getDay()+6)%7));
      semanas.add(seg.getFullYear()+'-'+seg.getMonth()+'-'+seg.getDate());
    }
  });
  if(registros < HIST_CORRIDA.minRegistros || semanas.size < HIST_CORRIDA.minSemanas || !(maior>0)) return null;
  return { minutosSemana: Math.round(total/(HIST_CORRIDA.diasVolume/7)), maiorMin30d: Math.round(maior), registros, semanas: semanas.size };
}

// Maior longão (min) da semana planejada.
function histLongoDaSemana(w){
  const l = ((w && w.corridaWeek) || []).filter(x=>x.type==='Longão');
  return l.length ? Math.max(...l.map(x=>x.totalMin || 0)) : 0;
}
// Longão de referência da semana n: o da semana anterior do plano que não seja de alívio (Descarga), para o ciclo 3:1
// não encolher a subida seguinte. Semanas ainda não geradas são geradas na hora (só acontece com histórico).
function histLongoRefPlano(hp, n){
  for(let k=n-1; k>=1; k--){
    const alvo = ((hp && hp.trajetoria) || [])[k-1];
    if(alvo && alvo.fase==='Descarga') continue;
    let w = hp && hp.plan && hp.plan[k-1];
    if(!w || w.pendente) w = typeof gerarSemanaV2==='function' ? gerarSemanaV2(k) : null;
    const m = histLongoDaSemana(w);
    if(m>0) return m;
  }
  return 0;
}
// Opções extras para gerarPlanoSemanal: {} sem histórico (nada muda).
function motorOpcoesHistorico(hp, n){
  const h = historicoCorridaReal(state.corridaProgress, state.atividadesLivres, new Date());
  if(!h) return {};
  const o = { historicoCorrida:h };
  if(hp && n>1){ const ref = histLongoRefPlano(hp, n); if(ref>0) o.longoRefPlano = ref; }
  return o;
}
Object.assign(globalThis, { historicoCorridaReal, motorOpcoesHistorico });
