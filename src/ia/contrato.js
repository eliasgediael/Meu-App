// Contrato de dados entre o app e a IA (Gemini): contexto do motor, exercícios autorizados, limites e o pedido
// minimizado que sai do aparelho. Nada aqui muda o Motor V2: as funções só leem o que o motor já decide.
// Usa os globais do motor e do app (gerarPlanoSemanal, lerEstado, POOL, normalizeNoAccents...).
/* eslint-disable */
import { IA_CONFIG } from './config.js';
import { iaConsentimentoIncluiSaude } from './consentimento.js';

const IA_DIAS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const IA_PAPEIS = ['base','auxiliar','isolado'];
const IA_GRUPOS_PERNA_CHAVES = ['agachar','dobradica'];

const iaClone = (x)=>JSON.parse(JSON.stringify(x));

// Mesmo ajuste de séries da semana que gerarSemanaV2 aplica (plano-vivo.js).
function iaAplicarFatorSeries(muscPlan, fs){
  const out = iaClone(muscPlan || {});
  const f = fs && fs.fator, piso = fs ? fs.piso : 2;
  if(f && f!==1){
    Object.keys(out).forEach(d=>out[d].forEach(e=>{ const s = parseInt(e.series,10); if(s) e.series = String(Math.min(s, Math.max(piso, Math.round(s*f)))); }));
  }
  return out;
}
function iaSeriesComFator(s, fs){
  const f = fs && fs.fator, piso = fs ? fs.piso : 2;
  return (f && f!==1) ? Math.min(s, Math.max(piso, Math.round(s*f))) : s;
}
function iaAssinaturaMusc(muscPlan){
  const o = {};
  Object.keys(muscPlan || {}).sort().forEach(d=>{ o[d] = (muscPlan[d]||[]).map(e=>[e.nome, e.repdbId, String(e.series), String(e.reps), e.rpe, e.descanso, e.papel].join('|')); });
  return JSON.stringify(o);
}
function iaAssinaturaCorrida(corridaWeek){
  return JSON.stringify((corridaWeek || []).map(w=>[w.day, w.type, w.totalMin]));
}

// Reconstrói o contexto interno da semana (estado, prioridade, frequências, distribuição, sessões) refazendo a
// construção final do motor com os mesmos ajustes. Se a reconstrução não bater exatamente com o plano entregue,
// devolve ok:false e a IA não é usada.
function iaContextoDoMotor(perfil, opcoes, semanaServida){
  opcoes = opcoes || {};
  const r = gerarPlanoSemanal(perfil, opcoes);
  if(!r || r.bloqueado || !r.semana) return { ok:false, motivo:'motor_bloqueado' };
  const est = lerEstado(perfil, opcoes);
  if(est.cautela.bloqueado) return { ok:false, motivo:'motor_bloqueado' };
  // Mesmas preparações do início de gerarPlanoSemanal (motor-v2.js).
  if(opcoes.alvoSemana && opcoes.alvoSemana.corridaMinAlvo>0 && est.corrida && est.corrida.carga){
    est.corrida.carga = { ...est.corrida.carga, min: opcoes.alvoSemana.corridaMinAlvo };
  }
  if(est.corrida) est.corrida.volumeFatorPlanejado = (opcoes.ajustesIniciais && opcoes.ajustesIniciais.volumeFator) || 1;
  if(est.corrida && est.corrida.ctx) est.corrida.ctx.weekNumber = (opcoes.alvoSemana && opcoes.alvoSemana.semana) || 1;
  const prio = definirPrioridade(est);
  const ajustes = iaClone(r.ajustes);
  const cons = motorConstruir(est, prio, { ...ajustes });
  if(iaAssinaturaMusc(cons.semana.muscPlan)!==iaAssinaturaMusc(r.semana.muscPlan) || iaAssinaturaCorrida(cons.semana.corridaWeek)!==iaAssinaturaCorrida(r.semana.corridaWeek)){
    return { ok:false, motivo:'reconstrucao_divergente' };
  }
  const val = validarPlano(est, prio, cons.freq, cons.dist, cons.semana, ajustes);
  if(!val.ok) return { ok:false, motivo:'motor_reprovado' };
  const fs = fatorSeriesDaSemana(opcoes.alvoSemana || null);
  const muscServido = iaAplicarFatorSeries(cons.semana.muscPlan, fs);
  if(semanaServida && iaAssinaturaMusc(semanaServida.muscPlan)!==iaAssinaturaMusc(muscServido)) return { ok:false, motivo:'semana_servida_divergente' };
  const ctx = { ok:true, r, est, prio, freq:cons.freq, dist:cons.dist, semana:cons.semana, ajustes, fatorSemana:fs, muscServido, opcoes };
  ctx.autorizados = iaListaAutorizada(ctx);
  if(!ctx.autorizados.ok) return { ok:false, motivo:ctx.autorizados.motivo };
  ctx.dias = iaInfoDias(ctx);
  ctx.refFull = iaReferenciaFull(ctx);
  ctx.totalSeriesMotor = iaTotalSeries(muscServido);
  ctx.seriesPorGrupoMotor = iaSeriesPorGrupo(muscServido);
  return ctx;
}

/* ---------- exercícios autorizados (F1) ---------- */
function iaMaxTier(nivel){ return nivel==='avancado' ? 3 : 2; }
function iaEhPerna(grupo, nome){
  if(grupo==='Pernas') return true;
  return IA_GRUPOS_PERNA_CHAVES.includes(motorPadraoChave(normalizeNoAccents(nome)));
}
// Chave estável de cada exercício no contrato: o id do catálogo quando ele é único no POOL; senão (id ausente ou
// usado por mais de um nome) uma chave derivada do nome ('n' + hash). Sempre a mesma para o mesmo exercício.
function iaHashNome(nome){
  let h = 0x811c9dc5;
  const s = normalizeNoAccents(nome);
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'n' + h.toString(36);
}
function iaChavesDoPool(pool){
  const usos = new Map();
  Object.keys(pool).forEach(g=>pool[g].forEach(e=>{ if(e.id){ const k = String(e.id); usos.set(k, (usos.get(k)||new Set()).add(e.nome)); } }));
  const chave = new Map();
  Object.keys(pool).forEach(g=>pool[g].forEach(e=>{ if(!chave.has(e.nome)) chave.set(e.nome, (e.id && usos.get(String(e.id)).size===1) ? String(e.id) : iaHashNome(e.nome)); }));
  return chave;
}
// Só exercícios aprovados pelo filtro do motor (dor, equipamento, padrões dominados) e no tier do nível.
// Os exercícios do plano do motor entram sempre (já passaram pelas mesmas regras na montagem).
function iaListaAutorizada(ctx){
  const est = ctx.est, filtro = motorFiltroExercicio(est), maxTier = iaMaxTier(est.capacidade.musc);
  const pool = motorPoolMotor();
  const chaves = iaChavesDoPool(pool);
  const porId = new Map(), chavePorNome = new Map();
  const rotulo = new Map();
  Object.keys(ctx.semana.muscPlan).forEach(d=>ctx.semana.muscPlan[d].forEach(e=>rotulo.set(e.nome, e.grupo)));
  Object.keys(pool).forEach(g=>pool[g].forEach(e=>{
    const id = chaves.get(e.nome);
    if(!id || porId.has(id)) return;
    const doMotor = rotulo.has(e.nome);
    if(!doMotor && (!filtro(e.nome) || exercicioTier(e)>maxTier)) return;
    const n = normalizeNoAccents(e.nome);
    porId.set(id, { id, nome:e.nome, grupo: rotulo.get(e.nome) || g, padrao: motorPadraoChave(n) || null, familia: motorFamilia(n), tier: exercicioTier(e), composto: isExercicioComposto(e.nome)!==false, chaveHistorico: e.id || e.nome, e });
    chavePorNome.set(e.nome, id);
  }));
  for(const d of Object.keys(ctx.semana.muscPlan)) for(const e of ctx.semana.muscPlan[d]){
    if(!chavePorNome.has(e.nome)) return { ok:false, motivo:'exercicio_do_motor_fora_do_pool' };
  }
  return { ok:true, porId, chavePorNome };
}

/* ---------- dias, limites e referências ---------- */
function iaInfoDias(ctx){
  const { est, dist, semana } = ctx;
  const melhor = dist.melhor || { runAt:{}, muscAt:{} };
  const idx = d=>IA_DIAS.indexOf(d);
  const dist2 = (a,b)=>{ const x = Math.abs(idx(a)-idx(b)); return Math.min(x, 7-x); };
  const durosCorrida = IA_DIAS.filter(d=>melhor.runAt[d] && melhor.runAt[d].dura);
  const out = {};
  Object.keys(semana.muscPlan).forEach(d=>{
    const sess = semana.sessoes.find(s=>s.dia===d && s.modalidade==='musculacao');
    const run = semana.corridaWeek.find(w=>w.day===d);
    const runSess = semana.sessoes.find(s=>s.dia===d && s.modalidade==='corrida');
    const dia = dist.dias.find(x=>x.dia===d);
    const minutos = dia ? dia.minutos : MOTOR_PARAMS.diaSemInfo;
    const foco = sess ? sess.foco : 'hipertrofia';
    out[d] = {
      tipoMotor: sess ? sess.tipo : 'full', foco,
      limiteMin: minutos - (run ? run.totalMin : 0),
      perto: durosCorrida.some(x=>dist2(x,d)<=2),
      corrida: runSess ? { tipo: runSess.tipo==='longa' ? 'longa' : runSess.tipo==='qualidade' ? 'qualidade' : 'leve', dura: !!runSess.dura } : null,
      qtdMax: motorQtdExercicios(est, foco),
      qtdMotor: semana.muscPlan[d].length,
      combinada: semana.muscPlan[d][0] ? (semana.muscPlan[d][0].combinada || null) : null,
    };
  });
  return out;
}
function iaRetomada(est){ return est.musc.situacao==='parado' && (est.musc.paradoIdx===null || est.musc.paradoIdx>=1); }
// F2: faixas por exercício. Séries e RPE nunca acima do que o motor daria para o mesmo papel/nível/foco
// (inclui retomada, calibração e o fator de séries da semana); repetições e descanso em faixa provisória.
function iaLimites(ctx, papel, foco){
  const est = ctx.est, nivel = est.capacidade.musc;
  const esq = motorEsquema(nivel, papel, foco, iaRetomada(est), est.calibracao.ativa);
  const C = IA_CONFIG;
  let repsMin = Math.max(C.repsMin, esq.reps - C.repsAbaixo), repsMax = Math.min(C.repsMax, esq.reps + C.repsAcima);
  if(nivel==='iniciante' || iaRetomada(est)) repsMin = Math.max(repsMin, Math.min(C.repsMinIniciante, esq.reps));
  return {
    seriesMin: C.seriesMin, seriesMax: Math.max(C.seriesMin, iaSeriesComFator(esq.series, ctx.fatorSemana)),
    repsMin, repsMax,
    rpeMin: C.rpeMin, rpeMax: esq.rpe,
    descansoMin: (foco==='forca' && papel==='base') ? C.descansoMinForcaBaseSeg : C.descansoMinSeg, descansoMax: C.descansoMaxSeg,
  };
}
// Séries de exercícios compostos de perna numa sessão (o que pesa para a corrida).
function iaSeriesPernaComposta(lista){
  return lista.reduce((t,e)=>t + (iaEhPerna(e.grupo, e.nome) && isExercicioComposto(e.nome)!==false ? (parseInt(e.series,10)||0) : 0), 0);
}
// Maior carga de perna que o motor aceita num dia de corpo inteiro (para classificar a sessão pelo conteúdo).
function iaReferenciaFull(ctx){
  const est = ctx.est, nivel = est.capacidade.musc;
  const sch = (p)=>HYBRID_PAPEL_SCHEME[p][nivel] || HYBRID_PAPEL_SCHEME[p].intermediario;
  let ref = sch('base').series + sch('auxiliar').series;
  Object.keys(ctx.muscServido).forEach(d=>{ if(ctx.dias[d].tipoMotor==='full') ref = Math.max(ref, iaSeriesPernaComposta(ctx.muscServido[d])); });
  return ref;
}
// F3: tipo da sessão pelo conteúdo (não pelo rótulo). Dia de perna do motor que continua com perna composta segue 'lower'.
function iaTipoPeloConteudo(lista, tipoMotor, refFull){
  const sp = iaSeriesPernaComposta(lista);
  let tipo = sp===0 ? 'upper' : sp<=refFull ? 'full' : 'lower';
  if(tipoMotor==='lower' && sp>0) tipo = 'lower';
  return tipo;
}
function iaTotalSeries(muscPlan){
  return Object.keys(muscPlan).reduce((t,d)=>t + muscPlan[d].reduce((s,e)=>s + (parseInt(e.series,10)||0), 0), 0);
}
function iaSeriesPorGrupo(muscPlan){
  const o = {};
  Object.keys(muscPlan).forEach(d=>muscPlan[d].forEach(e=>{ o[e.grupo] = (o[e.grupo]||0) + (parseInt(e.series,10)||0); }));
  return o;
}

/* ---------- pedido minimizado ---------- */
function iaFaixaEtaria(perfil){
  let i = null;
  try{ i = athleteIdade(perfil); }catch(e){}
  if(i===null || i===undefined) return null;
  return i<18 ? 'menos18' : i<30 ? '18-29' : i<40 ? '30-39' : i<50 ? '40-49' : i<60 ? '50-59' : '60mais';
}
// Resumo do histórico de musculação: sem datas, sem cargas em kg. Só tendência, repetições médias e PSE médio.
// itens: [{ id (chave do contrato), chaveHistorico (repdbId ou nome, como o historicoCarga do app guarda) }]
function iaResumoHistorico(historico, itens){
  if(!historico) return null;
  const hc = historico.historicoCarga || {};
  const porExercicio = [];
  (itens || []).forEach(({ id, chaveHistorico })=>{
    const h = Array.isArray(hc[chaveHistorico]) ? hc[chaveHistorico].slice(-6) : null;
    if(!h || !h.length) return;
    const top = h.map(x=>Math.max(0, ...((x.sets||[]).map(s=>parseFloat(s.peso)||0)), parseFloat(x.carga)||0));
    const sets = h.flatMap(x=>x.sets||[]);
    const reps = sets.map(s=>parseFloat(s.reps)).filter(v=>!isNaN(v));
    const pse = sets.map(s=>parseFloat(s.pse)).filter(v=>!isNaN(v));
    const a = top[0], b = top[top.length-1];
    porExercicio.push({
      id, sessoes: h.length,
      tendencia: !a || h.length<2 ? 'sem_dados' : b>a*1.02 ? 'subindo' : b<a*0.98 ? 'caindo' : 'estavel',
      repsMedia: reps.length ? Math.round(reps.reduce((x,y)=>x+y,0)/reps.length*10)/10 : null,
      pseMedio: pse.length ? Math.round(pse.reduce((x,y)=>x+y,0)/pse.length*10)/10 : null,
    });
  });
  const ck = historico.checkins || {};
  const checkins = Object.keys(ck).map(Number).filter(n=>!isNaN(n)).sort((x,y)=>x-y).slice(-4).map(n=>ck[n]).filter(v=>['facil','bom','dificil'].includes(v));
  const ad = typeof historico.aderencia==='number' && isFinite(historico.aderencia) ? Math.round(Math.max(0, Math.min(1, historico.aderencia))*100)/100 : null;
  return { porExercicio, checkins, aderencia: ad };
}
function iaItemPedido(ctx, e){
  return { id:ctx.autorizados.chavePorNome.get(e.nome), papel:e.papel, series:parseInt(e.series,10), reps:parseInt(e.reps,10), rpe:e.rpe, descansoSeg:parseDescansoSec(e.descanso) };
}
function iaMontarPedido(ctx, opcoes){
  opcoes = opcoes || {};
  const { est } = ctx;
  const perfil = opcoes.perfil;
  const diasMusc = Object.keys(ctx.muscServido);
  const comSaude = iaConsentimentoIncluiSaude(perfil);
  const autorizados = [...ctx.autorizados.porId.values()].map(it=>({ id:it.id, nome:it.nome, grupo:it.grupo, padrao:it.padrao, tier:it.tier, composto:it.composto }));
  const alvo = ctx.opcoes.alvoSemana || null;
  return {
    versaoContrato: IA_CONFIG.versaoContrato,
    tipo: opcoes.tipo==='semanal' ? 'semanal' : 'inicial',
    semana: { numero: (alvo && alvo.semana) || 1, fase: (alvo && alvo.fase) || (est.calibracao.ativa ? 'Retomada / calibração' : 'Base') },
    perfil: {
      faixaEtaria: iaFaixaEtaria(perfil),
      nivel: est.capacidade.musc,
      objetivo: est.objetivo.tipo || null,
      modalidadePrincipal: ctx.prio.principal || null,
      situacao: est.musc.situacao || null,
      retomada: iaRetomada(est),
      calibracao: !!est.calibracao.ativa,
      prontidao: est.recuperacao.prontidao,
      padroesDominados: [...est.musc.padroes],
      ...(comSaude ? { regioesDeDor: est.restricoes.regioes.slice() } : {}),
    },
    dias: diasMusc.map(d=>{
      const i = ctx.dias[d];
      return { dia:d, tipoMotor:i.tipoMotor, foco:i.foco, minutosDisponiveis:i.limiteMin, maxExercicios:i.qtdMax, corridaNoDia:i.corrida, corridaDuraPerto:i.perto,
        limites: Object.fromEntries(IA_PAPEIS.map(p=>[p, iaLimites(ctx, p, i.foco)])) };
    }),
    regras: {
      totalSeriesSemanaMax: ctx.totalSeriesMotor,
      maxBasePorDia: 1,
      podeCriarDiaDePerna: est.capacidade.musc!=='iniciante' && !ctx.ajustes.aliviarInferior && est.recuperacao.prontidao!=='reduzida',
      diasFixos: diasMusc,
    },
    planoMotor: diasMusc.map(d=>({ dia:d, exercicios: ctx.muscServido[d].map(e=>iaItemPedido(ctx, e)) })),
    exerciciosAutorizados: autorizados,
    historico: iaResumoHistorico(opcoes.historico, [...ctx.autorizados.porId.values()]),
  };
}

export {
  IA_DIAS, IA_PAPEIS, iaClone, iaHashNome, iaChavesDoPool, iaAplicarFatorSeries, iaAssinaturaMusc, iaAssinaturaCorrida, iaContextoDoMotor, iaListaAutorizada, iaInfoDias, iaLimites, iaRetomada,
  iaEhPerna, iaSeriesPernaComposta, iaReferenciaFull, iaTipoPeloConteudo, iaTotalSeries, iaSeriesPorGrupo, iaMaxTier,
  iaFaixaEtaria, iaResumoHistorico, iaMontarPedido,
};
