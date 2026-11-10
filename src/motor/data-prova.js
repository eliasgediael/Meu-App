// Data da prova (Etapa 2): alinha o plano à data da prova.
// - número de semanas do plano = semanas reais até a prova (mínimo 4, máximo 24);
// - a prova cai no dia certo da última semana e o resto da semana é descanso;
// - polimento por distância (5K/10K 1 semana, meia 2, maratona 3) com volume caindo até a semana da prova;
// - sessão "Prova" no dia, com a distância da prova e o ritmo previsto pelo VDOT para ESSA distância.
// Sem data de prova, com data inválida ou no passado, nada aqui entra em ação (provaAlinhar devolve null)
// e o motor se comporta exatamente como antes.
const PROVA_SEMANAS = { min:4, max:24 };
const PROVA_POLIMENTO_SEMANAS = { 5:1, 10:1, '21.0975':2, '42.195':3 };
// Variação do volume (%) em cada semana de polimento; a última é a semana da prova (carga bem baixa antes do dia).
const PROVA_POLIMENTO_PCT = { 1:[-45], 2:[-20, -50], 3:[-20, -40, -60] };

function provaDiaLocal(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if(!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return (d.getFullYear()===+m[1] && d.getMonth()===+m[2]-1 && d.getDate()===+m[3]) ? d : null;
}
function provaSegunda(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay()+6)%7));
  return x;
}
// Alinhamento da data da prova com a semana de hoje. null = sem data válida no futuro (comportamento de sempre).
function provaAlinhar(dataISO, hoje, distanciaKm){
  const d = provaDiaLocal(dataISO);
  if(!d || !hoje) return null;
  const h0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if(!(d > h0)) return null;
  const semanasReais = Math.round((provaSegunda(d) - provaSegunda(h0))/(7*86400000)) + 1;
  const curto = semanasReais < PROVA_SEMANAS.min;           // prazo curto: plano de manutenção + polimento
  const alemDoPlano = semanasReais > PROVA_SEMANAS.max;     // a prova está depois do horizonte máximo do plano
  const semanasPlano = curto ? semanasReais : Math.min(semanasReais, PROVA_SEMANAS.max);
  const diaIdx = (d.getDay()+6)%7;
  const polimento = alemDoPlano ? 0 : Math.min(PROVA_POLIMENTO_SEMANAS[distanciaKm] || 1, semanasPlano);
  return { iso:dataISO, diaIdx, dia:DAY_ABBR[diaIdx], distanciaKm, semanasReais, semanasPlano, curto, alemDoPlano, polimento };
}
function provaAvisoPrazo(pv){
  if(!pv || !pv.curto) return null;
  return { semanasReais:pv.semanasReais, minimo:PROVA_SEMANAS.min, texto:'A prova está a menos de '+PROVA_SEMANAS.min+' semanas: plano curto de manutenção com polimento.' };
}
// Sessão "Prova": distância da prova e ritmo previsto pelo VDOT para essa distância (não o ritmo de maratona).
function provaSessaoCorrida(est, pv){
  const goal = pv.distanciaKm;
  const vdot = est.corrida && est.corrida.vdot;
  const segKm = vdot > 0 ? predictRaceTimeSec(vdot, goal)/goal : null;
  const km = Math.round(goal*10)/10;
  const pace = segKm ? formatPace(segKm)+'/km' : null;
  const min = segKm ? Math.round(segKm*goal/60) : 0;
  const warmKm = goal <= 21.1 ? 1 : 0;
  const passos = [];
  if(warmKm) passos.push({ name:'Aquecimento', km:warmKm, pace:'trote leve', zona:'Z1', desc:'trote leve e mobilidade antes da largada' });
  passos.push({ name:'Prova', km, pace:pace || 'ritmo de prova', zona:'Z4', desc:(pace ? km+' km no ritmo previsto ('+pace+')' : km+' km de prova') });
  const principal = passos[passos.length-1];
  return {
    day:pv.dia, type:'Prova', cor:'var(--red)',
    objetivo:'Dia da prova: execute o plano de ritmo, sem queimar a largada.',
    sessao:'RUN_LONG_RUN', modo:'hibrido',
    warmupDesc: warmKm ? passos[0].desc : '', warmupPace: warmKm ? passos[0].pace : '',
    mainDesc: principal.desc, mainPace: principal.pace, cooldownDesc:'', cooldownPace:'',
    zonaFC:'Z4/Z5', totalKm: Math.round((km+warmKm)*10)/10, totalMin:min + (warmKm ? 8 : 0),
    steps:passos.map(s=>({ ...s })), gpsSteps:passos.map(s=>({ ...s, tipo:'distancia' })),
    duracaoMin:min + (warmKm ? 8 : 0), combinada:null, estimulo:{ tipo:'prova', dura:true },
    chave:true, provaData:pv.iso, distanciaProvaKm:goal, paceProvaSegKm: segKm ? Math.round(segKm) : null,
    justificativa:'Prova de '+km+' km na data marcada; o ritmo previsto vem do seu VDOT para essa distância.'
  };
}
// Semana da prova: sessão Prova no dia, véspera sem corrida, musculação fora dos 2 dias antes e depois da prova, descanso depois.
// As corridas que sobram antes da prova são só rodagens leves e curtas (regras em PROVA_SEMANA):
// nenhuma sessão de qualidade nem longão; no máximo 3 rodagens de até 25 min; soma de até 25% do pico semanal de volume;
// o volume total da semana (com a Prova) não passa do da semana anterior; quando a Prova sozinha já passa disso
// (meia e maratona), a soma sem a Prova fica abaixo da semana anterior. A véspera e o dia da prova ficam sem outra corrida.
const PROVA_SEMANA = { maxRodagens:3, maxMinRodagem:25, fracaoPico:0.25 };
function provaAplicarNaSemana(semana, est, pv, ctx){
  ctx = ctx || {};
  const idx = pv.diaIdx;
  const ordem = d=>DAY_ABBR.indexOf(d);
  const antes = (semana.corridaWeek || []).filter(w=>ordem(w.day) < idx-1).sort((a, b)=>ordem(a.day) - ordem(b.day));
  const prova = provaSessaoCorrida(est, pv);
  const tetos = [];
  if(ctx.picoMin>0) tetos.push(PROVA_SEMANA.fracaoPico * ctx.picoMin);
  if(ctx.anteriorMin>0) tetos.push(prova.totalMin <= ctx.anteriorMin ? ctx.anteriorMin - prova.totalMin : ctx.anteriorMin - 1);
  const permitido = tetos.length ? Math.max(0, Math.min(...tetos)) : PROVA_SEMANA.maxRodagens * PROVA_SEMANA.maxMinRodagem;
  const piso = MOTOR_PARAMS.minSessaoCorrida;
  let n = Math.min(PROVA_SEMANA.maxRodagens, antes.length), dur = 0;
  for(; n>0; n--){ dur = Math.min(PROVA_SEMANA.maxMinRodagem - 2, Math.floor(permitido/n) - 2); if(dur>=piso) break; }
  const dias = [];
  for(let k=0; k<n; k++) dias.push(antes[n===1 ? Math.floor((antes.length-1)/2) : Math.round(k*(antes.length-1)/(n-1))].day);
  const leves = [];
  dias.forEach(d=>{
    const r = motorMontarCorrida(est, { tipo:'rodagem', dura:false, durMin:dur }, PROVA_SEMANA.maxMinRodagem);
    const s = r.sessao;
    s.duracaoMin = s.totalMin; s.combinada = null; s.estimulo = { tipo:'leve', dura:false };
    leves.push({ day:d, ...s });
  });
  // a soma pode passar um pouco do teto por arredondamento do construtor: tira rodagens até caber
  while(leves.length && leves.reduce((t, x)=>t + x.totalMin, 0) > permitido) leves.pop();
  semana.corridaWeek = [...leves, prova].sort((a, b)=>ordem(a.day) - ordem(b.day));
  const musc = {};
  Object.keys(semana.muscPlan || {}).forEach(d=>{ if(ordem(d) < idx-2) musc[d] = semana.muscPlan[d]; });
  semana.muscPlan = musc;
  semana.sessoes = (semana.sessoes || []).filter(s=>s.modalidade!=='corrida' && ordem(s.dia) < idx-2);
  leves.forEach(x=>semana.sessoes.push({ dia:x.day, modalidade:'corrida', tipo:'leve', duracaoMin:x.totalMin, combinada:false, dura:false, km:x.totalKm }));
  semana.sessoes.push({ dia:pv.dia, modalidade:'corrida', tipo:'prova', duracaoMin:prova.duracaoMin, combinada:false, dura:true, km:prova.totalKm });
  return semana;
}
Object.assign(globalThis, { PROVA_SEMANA, PROVA_SEMANAS, PROVA_POLIMENTO_SEMANAS, PROVA_POLIMENTO_PCT, provaAlinhar, provaAvisoPrazo, provaSessaoCorrida, provaAplicarNaSemana });
