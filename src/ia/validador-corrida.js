// Validação v2 (Etapa 4): resposta conjunta de corrida + musculação. Nada é aplicado sem passar em TUDO.
//   Musculação: F0–F9 do v1, exatamente como estão (iaValidarProposta).
//   Corrida:
//     R0 estrutura (esquema v2, campos, tipos, ids só do catálogo)
//     R1 dias: exatamente os dias de corrida do motor, sem repetir, sem faltar, sem criar
//     R2 opção dentro do MENU do dia (montado pelo motor) e progressão só se permitida
//     R3 escolhas de aquecimento/alongamento permitidas para a pessoa; sessão montada pelo motor; duração na faixa
//     R4 volume da semana: nunca acima do motor; sem cortes grandes; sem DUPLA redução quando o check-in já reduziu
//     R5 intensidade: carga (Z3×1, Z4×1,5, Z5×2) por sessão e na semana ≤ motor; 1 sessão de qualidade; repetições das tabelas
//     R6 coerência: total = soma dos blocos; km = soma das etapas; tempo das etapas do GPS ≈ km × pace; pace na zona do VDOT
//     R7 recuperação: acelerações nunca na véspera da qualidade nem depois de perna pesada; semana CONJUNTA no validarPlano (V1–V10)
//     R8 nível e restrições: nível/regime da opção, iniciante sem Z3+, dor em membro inferior sem impacto alto
//     R9 longão: só opções de longão no dia de longão, sem passar da duração e da carga do longão do motor
//   Semana conjunta: J1 sem dupla redução da musculação quando o check-in já reduziu.
// Qualquer erro reprova a resposta inteira e a semana do motor fica como está.
/* eslint-disable */
import ESQUEMA_V2 from '../../functions/src/esquema-resposta-v2.json';
import { iaConferirEsquema, iaValidarProposta, iaMontarSemanaFinal, IA_ESQUEMA_RESPOSTA } from './validador.js';
import { iaClone } from './contrato.js';
import { IA_V2_VERSAO } from './contrato-v2.js';

const IA_V2_MAX_BYTES = 30000;
const IA_V2_REG_INFERIOR = ['joelho', 'tornozelo', 'quadril', 'pe'];

function iaV2Faixa(id){ return id==='REGENERATIVO' ? [0.6, 0.8] : [0.8, 1]; }
function iaV2PaceNaZona(zona, segKm, P){
  if(/Z5/.test(zona)) return segKm <= P.T + 5;
  if(/Z4/.test(zona)) return segKm >= P.I - 8 && segKm <= P.M + 5;
  if(/Z3/.test(zona)) return Math.abs(segKm - P.M) <= 12;
  if(/Z1|Z2/.test(zona)) return segKm >= P.Ef - 5 && segKm <= P.Es + 35;
  return true;
}
const iaV2Vazias = (r)=>!r.mobilidade.length && !r.educativos.length && !r.alongamentos.length && !r.strides && !r.stridesFim;

// R1–R9 sobre a lista "corrida" da resposta (já conferida pelo esquema). semanaMusc = musculação final (para R7 conjunta).
function iaValidarCorridaV2(ctx, ctxC, corrida, E){
  const est = ctx.est, P = Object.fromEntries(Object.entries(est.corrida.paces).map(([k, v])=>[k, v*86400]));
  const diasMotor = Object.keys(ctxC.dias);
  const vistos = new Set(), sessoes = {}, progressao = [], escolhidas = {};
  // R1
  corrida.forEach(it=>{ if(vistos.has(it.dia)) E('R1', `${it.dia}: dia repetido`); vistos.add(it.dia); if(!ctxC.dias[it.dia]) E('R1', `${it.dia}: dia sem corrida no motor`); });
  diasMotor.forEach(d=>{ if(!vistos.has(d)) E('R1', `${d}: dia de corrida do motor ausente`); });
  let somaMin = 0, somaMotor = 0, cargaSemana = 0, cargaMotor = 0;
  corrida.forEach(it=>{
    const x = ctxC.dias[it.dia];
    if(!x) return;
    const cd = x.cdia, op = CORRIDA_OPCOES[it.opcao];
    somaMotor += cd.ref.totalMin; cargaMotor += cd.ref.carga;
    // R2
    if(!x.menu.includes(it.opcao)){ E('R2', `${it.dia}: opção ${it.opcao} fora do menu do dia`); return; }
    if(it.progressao==='pedir_progressao'){ if(!ctxC.progressaoPermitida) E('R2', `${it.dia}: progressão pedida quando o motor não permite`); else progressao.push(it.dia); }
    const escolhas = { mobilidade:it.mobilidade, educativos:it.educativos, alongamentos:it.alongamentos, strides:it.strides, stridesFim:it.stridesFim };
    // R8 antes de montar (defesa em profundidade: o menu já filtra)
    const nivel = est.capacidade.corrida;
    if(['iniciante', 'intermediario', 'avancado'].indexOf(nivel) < ['iniciante', 'intermediario', 'avancado'].indexOf(op.nivelMin) || !op.regimes.includes(est.corrida.regime)) E('R8', `${it.dia}: ${it.opcao} não é para o nível/regime`);
    const dorInf = (est.restricoes.regioes || []).some(r=>IA_V2_REG_INFERIOR.includes(r)) || est.restricoes.semImpacto;
    if(dorInf && (it.strides || it.stridesFim || /SUBIDAS|STRIDES/.test(it.opcao) || it.educativos.some(e=>(CORRIDA_EDUCATIVOS[e] || {}).impacto==='alto'))) E('R8', `${it.dia}: impacto alto com dor em membro inferior`);
    // R7 (acelerações e recuperação entre sessões)
    if((it.strides || it.stridesFim || it.opcao==='LEVE_STRIDES') && cd.tipoDia!=='qualidade' && (cd.vesperaDeQualidade || cd.aposPernaPesada || cd.pernaPesadaNoDia)) E('R7', `${it.dia}: acelerações na véspera da qualidade ou junto de perna pesada`);
    // R9
    if(cd.tipoDia==='longa' && op.dia!=='longa') E('R9', `${it.dia}: dia de longão com opção que não é de longão`);
    // R3: escolhas e montagem pelo motor
    const conf = ccConferirEscolhas(est, escolhas);
    if(!conf){ E('R3', `${it.dia}: itens de aquecimento/alongamento inválidos para a pessoa`); return; }
    if(it.opcao===x.motorId && iaV2Vazias(conf)){ sessoes[it.dia] = null; escolhidas[it.dia] = it.opcao; somaMin += cd.ref.totalMin; cargaSemana += cd.ref.carga; return; }   // a sessão do motor, intacta
    const s = it.opcao==='QUALIDADE_MOTOR' ? null : corridaMontarOpcao(est, it.opcao, cd, conf);
    if(it.opcao==='QUALIDADE_MOTOR'){ E('R3', `${it.dia}: a sessão de qualidade do motor não aceita itens extras`); return; }
    if(!s){ E('R3', `${it.dia}: ${it.opcao} não cabe com essas escolhas`); return; }
    const fx = iaV2Faixa(it.opcao);
    if(s.totalMin > Math.floor(cd.limiteMin*fx[1]) || s.totalMin < Math.floor(cd.limiteMin*fx[0])) E('R3', `${it.dia}: ${s.totalMin} min fora da faixa (${cd.limiteMin} min do motor)`);
    // R5 por sessão
    if(s.cargaIntensa > cd.ref.carga + 0.05) E('R5', `${it.dia}: carga ${s.cargaIntensa} acima da do motor (${cd.ref.carga})`);
    if(op.reps){
      const reps = s.gpsSteps.filter(g=>/^(Tiro|Limiar|Subida|Ritmo de prova) \d+\//.test(g.name)).length;
      const max = op.reps[1] + (est.capacidade.corrida==='avancado' && op.familia!=='subidas' ? 1 : 0);
      if(reps<op.reps[0] || reps>max) E('R5', `${it.dia}: ${reps} repetições fora da tabela`);
    }
    // R6 coerência
    const somaBlocos = s.blocos.reduce((t, b)=>t + b.min, 0);
    if(Math.round(somaBlocos)!==s.totalMin) E('R6', `${it.dia}: duração ≠ soma dos blocos`);
    if(Math.abs(s.steps.reduce((t, x)=>t + (x.km || 0), 0) - s.totalKm) > 0.001) E('R6', `${it.dia}: km ≠ soma das etapas`);
    const gpsMin = s.gpsSteps.reduce((t, g)=>{ if(g.tipo==='tempo') return t + g.metaSeg/60; const r = parsePaceRangeToSec(g.pace); return t + (r ? g.km*(r.lo + r.hi)/2/60 : 0); }, 0);
    if(Math.abs(gpsMin - somaBlocos) > Math.max(1.5, somaBlocos*0.07)) E('R6', `${it.dia}: etapas do GPS não cobrem a sessão`);
    s.gpsSteps.forEach(g=>{
      const r = parsePaceRangeToSec(g.pace);
      if(!r){ if(g.tipo!=='tempo') E('R6', `${it.dia}: etapa sem pace e por distância`); return; }
      if(/^Caminhada/.test(g.name) && g.zona==='Z1') return;
      if(!iaV2PaceNaZona(g.zona, (r.lo + r.hi)/2, P)) E('R6', `${it.dia}: pace ${g.pace} fora de ${g.zona}`);
    });
    if(est.capacidade.corrida==='iniciante' && s.gpsSteps.some(g=>/Z3|Z4|Z5/.test(g.zona || ''))) E('R8', `${it.dia}: iniciante com etapa em Z3+`);
    if(cd.tipoDia==='longa' && (s.totalMin > cd.ref.totalMin || s.cargaIntensa > cd.ref.carga + 0.05)) E('R9', `${it.dia}: longão acima do longão do motor`);
    sessoes[it.dia] = s; escolhidas[it.dia] = it.opcao;
    somaMin += s.totalMin; cargaSemana += s.cargaIntensa;
  });
  // R4 volume e dupla redução
  if(diasMotor.length){
    if(somaMin > somaMotor) E('R4', `volume ${somaMin} min acima do motor (${somaMotor} min)`);
    const piso = ctxC.reduzidoPorCheckin ? 0.95 : 0.8;
    if(somaMin < Math.floor(somaMotor*piso)) E('R4', ctxC.reduzidoPorCheckin ? `dupla redução: a semana já foi reduzida pelo check-in (${somaMin} de ${somaMotor} min)` : `corte grande demais (${somaMin} de ${somaMotor} min)`);
    if(ctxC.reduzidoPorCheckin && Object.values(escolhidas).includes('REGENERATIVO')) E('R4', 'dupla redução: regenerativo numa semana já reduzida pelo check-in');
    // R5 semana
    if(cargaSemana > cargaMotor + 0.1) E('R5', `carga da semana ${Math.round(cargaSemana*10)/10} acima da do motor (${Math.round(cargaMotor*10)/10})`);
    const qual = Object.entries(escolhidas).filter(([d, id])=>CORRIDA_OPCOES[id] && CORRIDA_OPCOES[id].dia==='qualidade').length;
    const qualMotor = diasMotor.filter(d=>ctxC.dias[d].cdia.tipoDia==='qualidade').length;
    if(qual > qualMotor) E('R5', 'mais sessões de qualidade que o motor');
  }
  return { sessoes, escolhidas, progressao, somaMin, somaMotor, cargaSemana:Math.round(cargaSemana*10)/10, cargaMotor:Math.round(cargaMotor*10)/10 };
}

// Validação completa v2. bruto: objeto ou texto JSON.
function iaValidarPropostaV2(ctx, ctxC, bruto){
  const erros = [], avisos = [];
  const E = (cod, detalhe)=>erros.push({ cod, detalhe });
  const falhou = ()=>({ ok:false, erros, avisos });
  let resp = bruto;
  if(typeof bruto==='string'){
    if(new TextEncoder().encode(bruto).length > IA_V2_MAX_BYTES){ E('R0', 'resposta grande demais'); return falhou(); }
    try{ resp = JSON.parse(bruto); }catch(e){ E('R0', 'resposta não é JSON'); return falhou(); }
  }
  if(!resp || typeof resp!=='object' || Array.isArray(resp)){ E('R0', 'resposta não é objeto'); return falhou(); }
  if(new TextEncoder().encode(JSON.stringify(resp)).length > IA_V2_MAX_BYTES){ E('R0', 'resposta grande demais'); return falhou(); }
  // R0/F0: esquema v2 completo (com os limites que o Gemini não aceita no pedido)
  iaConferirEsquema(resp, ESQUEMA_V2, '$', (cod, det)=>E(/^\$\.corrida/.test(det) ? 'R0' : 'F0', det));
  if(erros.length) return falhou();
  // Musculação: F0–F9 do v1, sem mudança
  const diasMusc = Object.keys(ctx.muscServido || {});
  let musc = null;
  if(diasMusc.length){
    const motivosV1 = IA_ESQUEMA_RESPOSTA.properties.motivos.items.enum;
    const v1 = { versao:'1', dias:resp.dias, motivos:resp.motivos.filter(m=>motivosV1.includes(m)) };
    if(!v1.motivos.length) v1.motivos = ['manter_plano'];
    musc = iaValidarProposta(ctx, v1);
    if(!musc.ok){ musc.erros.forEach(e=>erros.push(e)); return falhou(); }
    // J1: sem dupla redução da musculação numa semana já reduzida pelo check-in
    if(ctxC.reduzidoPorCheckin && musc.volume.total < Math.floor(ctx.totalSeriesMotor*0.9)) E('J1', `dupla redução da musculação (${musc.volume.total} de ${ctx.totalSeriesMotor} séries)`);
  }else if(resp.dias.length){ E('D1', 'musculação em semana sem musculação no motor'); }
  if(erros.length) return falhou();
  // Corrida: R1–R9
  const corr = iaValidarCorridaV2(ctx, ctxC, resp.corrida, E);
  if(erros.length) return falhou();
  // Semana CONJUNTA (corrida + musculação finais) no validarPlano do motor (V1–V10)
  const semana = iaClone(ctx.semana);
  if(musc){
    semana.muscPlan = musc.muscPlan;
    semana.sessoes = semana.sessoes.map(s=>s.modalidade!=='musculacao' ? s : { ...s, tipo:musc.tipos[s.dia], dura:musc.tipos[s.dia]==='lower', duracaoMin:musc.duracao[s.dia], exercicios:musc.muscPlan[s.dia].length });
  }
  semana.corridaWeek = semana.corridaWeek.map(w=>{ const s = corr.sessoes[w.day]; return s ? { ...w, ...iaClone(s), day:w.day, duracaoMin:s.totalMin } : w; });
  semana.sessoes = semana.sessoes.map(x=>{ const s = x.modalidade==='corrida' ? corr.sessoes[x.dia] : null; return s ? { ...x, duracaoMin:s.totalMin, km:s.totalKm } : x; });
  const v = validarPlano(ctx.est, ctx.prio, ctx.freq, ctx.dist, semana, ctx.ajustes);
  v.erros.forEach(e=>E('R7', `${e.cod}: ${e.detalhe}`));
  if(erros.length) return falhou();
  return { ok:true, erros, avisos:(musc ? musc.avisos : []), musc, corrida:corr, motivos:resp.motivos.slice(), semanaConjunta:semana };
}

// Semana final (tudo ou nada): musculação pela montagem do v1 e corrida trocada só nos dias com opção nova.
function iaMontarSemanaFinalV2(ctx, ctxC, semanaServida, val){
  const w = val.musc ? iaMontarSemanaFinal(ctx, semanaServida, val.musc) : iaClone(semanaServida);
  w.sessoes = iaClone(val.semanaConjunta.sessoes);
  w.corridaWeek = (w.corridaWeek || []).map(e=>{
    const s = val.corrida.sessoes[e.day];
    if(!s) return e;
    const n = { ...iaClone(s), day:e.day, estimulo:e.estimulo, combinada:e.combinada, duracaoMin:s.totalMin, justificativa:e.justificativa, periodos:e.periodos };
    n.chave = !!(e.chave || ehTipoCorridaChave(n.type));
    Object.keys(n).forEach(k=>{ if(n[k]===undefined) delete n[k]; });
    return n;
  });
  w.iaRefino = { versaoContrato:IA_V2_VERSAO, motivos:val.motivos, opcoes:val.corrida.escolhidas, pedidoProgressao:val.corrida.progressao,
    engineVersion:(typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null), catalogoVersao:CORRIDA_CATALOGO_VERSAO, aplicadoEm:new Date().toISOString() };
  return w;
}

export { iaValidarCorridaV2, iaValidarPropostaV2, iaMontarSemanaFinalV2, ESQUEMA_V2 as IA_ESQUEMA_RESPOSTA_V2 };
