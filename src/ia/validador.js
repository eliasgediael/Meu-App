// Validação determinística da proposta da IA. A resposta só vale se passar em TUDO:
//   F0 estrutura (esquema, tamanho, campos desconhecidos)   F1 exercício só por id autorizado
//   D1 dias de musculação iguais aos do motor               F2 séries/reps/RPE/descanso na faixa do motor
//   F3 tipo da sessão recalculado pelo conteúdo             F4 duração recalculada dentro do tempo do dia
//   F5 tier, repetição, família e quantidade de exercícios  F6 total de séries da semana ≤ o do motor
//   F7 perna pesada x corrida e recuperação                 F8 sem carga (kg): progressão continua no forca.js
//   F9 sem texto livre (só códigos de motivo)               e depois validarPlano() do motor na semana inteira.
// Qualquer erro reprova a proposta inteira e o plano do motor fica como está.
/* eslint-disable */
import ESQUEMA from '../../functions/src/esquema-resposta.json';
import { IA_CONFIG } from './config.js';
import { iaClone, iaLimites, iaTipoPeloConteudo, iaTotalSeries, iaSeriesPorGrupo, iaMaxTier, iaSeriesPernaComposta } from './contrato.js';

const IA_ID_RE = /^[A-Za-z0-9_-]{1,12}$/;
const IA_ORIENTACAO_CARGA = 'Sem carga definida: escolha uma carga em que sobrem 2–3 repetições.';

// Conferência genérica do esquema (o mesmo arquivo enviado ao Gemini como responseSchema).
function iaConferirEsquema(v, s, caminho, E){
  if(s.enum && !s.enum.includes(v)){ E('F0', `${caminho}: valor fora da lista`); return; }
  if(s.type==='object'){
    if(!v || typeof v!=='object' || Array.isArray(v)){ E('F0', `${caminho}: esperado objeto`); return; }
    (s.required || []).forEach(k=>{ if(!Object.prototype.hasOwnProperty.call(v,k)) E('F0', `${caminho}.${k}: ausente`); });
    Object.keys(v).forEach(k=>{
      if(!s.properties || !Object.prototype.hasOwnProperty.call(s.properties, k)){ E('F0', `${caminho}.${k}: campo não previsto`); return; }
      iaConferirEsquema(v[k], s.properties[k], `${caminho}.${k}`, E);
    });
  }else if(s.type==='array'){
    if(!Array.isArray(v)){ E('F0', `${caminho}: esperado lista`); return; }
    if(s.minItems!==undefined && v.length<s.minItems) E('F0', `${caminho}: itens de menos`);
    if(s.maxItems!==undefined && v.length>s.maxItems){ E('F0', `${caminho}: itens demais`); return; }
    v.forEach((x,i)=>iaConferirEsquema(x, s.items, `${caminho}[${i}]`, E));
  }else if(s.type==='string'){
    if(typeof v!=='string'){ E('F0', `${caminho}: esperado texto`); return; }
    if(s.maxLength!==undefined && v.length>s.maxLength) E('F0', `${caminho}: texto longo demais`);
  }else if(s.type==='integer'){
    if(!Number.isInteger(v)){ E('F0', `${caminho}: esperado inteiro`); return; }
    if(s.minimum!==undefined && v<s.minimum) E('F0', `${caminho}: abaixo do mínimo`);
    if(s.maximum!==undefined && v>s.maximum) E('F0', `${caminho}: acima do máximo`);
  }
}
function iaLerResposta(bruto, E){
  let txt;
  if(typeof bruto==='string') txt = bruto;
  else { try{ txt = JSON.stringify(bruto); }catch(e){ E('F0', 'resposta não serializável'); return null; } }
  if(typeof txt!=='string' || !txt.length){ E('F0', 'resposta vazia'); return null; }
  if(txt.length>IA_CONFIG.maxBytesResposta){ E('F0', 'resposta grande demais'); return null; }
  if(typeof bruto!=='string') return bruto;
  try{ return JSON.parse(txt); }catch(e){ E('F0', 'resposta não é JSON'); return null; }
}

function iaValidarProposta(ctx, bruto){
  const erros = [], avisos = [];
  const E = (cod, detalhe)=>erros.push({ cod, detalhe });
  const A = (cod, detalhe)=>avisos.push({ cod, detalhe });
  const falhou = ()=>({ ok:false, erros, avisos });
  const resp = iaLerResposta(bruto, E);
  if(erros.length) return falhou();
  iaConferirEsquema(resp, ESQUEMA, '$', E);
  if(erros.length) return falhou();

  // D1: os dias e minutos de musculação são os do motor.
  const diasMotor = Object.keys(ctx.muscServido);
  const diasResp = resp.dias.map(x=>x.dia);
  if(new Set(diasResp).size!==diasResp.length) E('D1', 'dia repetido');
  diasMotor.forEach(d=>{ if(!diasResp.includes(d)) E('D1', `${d}: dia de musculação do motor ausente`); });
  diasResp.forEach(d=>{ if(!diasMotor.includes(d)) E('D1', `${d}: dia de musculação novo não permitido`); });
  if(erros.length) return falhou();

  const est = ctx.est, porId = ctx.autorizados.porId, maxTier = iaMaxTier(est.capacidade.musc);
  const novo = {};
  resp.dias.forEach(({ dia, exercicios })=>{
    const info = ctx.dias[dia];
    const doDiaMotor = ctx.muscServido[dia] || [];
    // Exceções que só valem para o que o próprio motor já faz no mesmo dia (sem ampliar nada):
    // famílias repetidas (ex.: duas panturrilhas no dia de perna) e exercício base não composto.
    const famMotor = {};
    doDiaMotor.forEach(e=>{ const f = motorFamilia(normalizeNoAccents(e.nome)); famMotor[f] = (famMotor[f]||0) + 1; });
    const vistos = new Set(), familias = {};
    let bases = 0;
    const lista = [];
    exercicios.forEach(x=>{
      if(!IA_ID_RE.test(x.id)){ E('F9', `${dia}: id em formato inválido`); return; }
      const it = porId.get(x.id);
      if(!it){ E('F1', `${dia}: id não autorizado (${x.id})`); return; }
      if(vistos.has(x.id)) E('F5', `${dia}: exercício repetido (${it.nome})`);
      vistos.add(x.id);
      const doMotor = doDiaMotor.find(e=>e.nome===it.nome);
      if(it.tier>maxTier && !doMotor) E('F5', `${dia}: ${it.nome} acima do nível`);
      familias[it.familia] = (familias[it.familia]||0) + 1;
      if(familias[it.familia]>Math.max(1, famMotor[it.familia]||0)) E('F5', `${dia}: dois exercícios do mesmo movimento (${it.familia})`);
      if(x.papel==='base'){ bases++; if(!it.composto && !(doMotor && doMotor.papel==='base')) E('F2', `${dia}: ${it.nome} não pode ser exercício base`); }
      const L = iaLimites(ctx, x.papel, info.foco);
      if(x.series<L.seriesMin || x.series>L.seriesMax) E('F2', `${dia}: ${it.nome} com ${x.series} séries (faixa ${L.seriesMin}–${L.seriesMax})`);
      if(x.reps<L.repsMin || x.reps>L.repsMax) E('F2', `${dia}: ${it.nome} com ${x.reps} reps (faixa ${L.repsMin}–${L.repsMax})`);
      if(x.rpe<L.rpeMin || x.rpe>L.rpeMax) E('F2', `${dia}: ${it.nome} com RPE ${x.rpe} (faixa ${L.rpeMin}–${L.rpeMax})`);
      if(x.descansoSeg<L.descansoMin || x.descansoSeg>L.descansoMax) E('F2', `${dia}: ${it.nome} com descanso ${x.descansoSeg}s (faixa ${L.descansoMin}–${L.descansoMax}s)`);
      lista.push({
        id: doMotor ? doMotor.id : 'ia' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), done:false,
        nome: it.nome, series:String(x.series), reps:String(x.reps), carga:'', grupo:it.grupo, repdbId: it.e.id || null, descanso:x.descansoSeg+'s',
        modo:'hibrido', papel:x.papel, tier:it.tier, rpe:x.rpe, orientacaoCarga:IA_ORIENTACAO_CARGA, combinada: info.combinada ? iaClone(info.combinada) : null,
      });
    });
    if(bases>1) E('F2', `${dia}: mais de um exercício base`);
    if(lista.length>info.qtdMax) E('F5', `${dia}: ${lista.length} exercícios (máximo ${info.qtdMax})`);
    novo[dia] = lista;
  });
  if(erros.length) return falhou();

  // F3/F4/F7 por dia.
  const tipos = {}, duracao = {};
  const nivel = est.capacidade.musc;
  diasMotor.forEach(d=>{
    const info = ctx.dias[d], lista = novo[d];
    const tipo = iaTipoPeloConteudo(lista, info.tipoMotor, ctx.refFull);
    tipos[d] = tipo;
    if(tipo==='lower' && info.tipoMotor!=='lower'){
      if(nivel==='iniciante') E('F7', `${d}: iniciante não tem dia de perna pesado`);
      if(ctx.ajustes.aliviarInferior || est.recuperacao.prontidao==='reduzida') E('F7', `${d}: perna pesada com recuperação/alívio de inferiores ativo`);
      if(info.perto) E('F7', `${d}: perna pesada perto de corrida dura`);
    }
    if(tipo==='lower' && info.perto && lista.length>info.qtdMotor) E('F7', `${d}: dia de perna perto de corrida dura com mais exercícios que o motor`);
    // Dia com corrida, ou perto de corrida dura: a carga de perna (séries de compostos de perna) não sobe acima da do motor.
    if((info.corrida || info.perto) && iaSeriesPernaComposta(lista) > iaSeriesPernaComposta(ctx.muscServido[d] || [])){
      E('F7', `${d}: mais carga de perna que o motor num dia com corrida ou perto de corrida dura`);
    }
    duracao[d] = estimateWorkoutMinutes(lista) + MOTOR_PARAMS.aquecimentoMusc;
    if(duracao[d] > info.limiteMin + 0.5) E('F4', `${d}: ${duracao[d]} min > ${info.limiteMin} min disponíveis`);
    const forma = tipo, foco = info.foco;
    lista.forEach(e=>{ e.sessao = tipo==='lower' ? 'LEG_DAY_HEAVY' : tipo==='full' ? 'FULL_BODY_LIGHT' : 'UPPER_BODY'; e.estimulo = { forma, foco }; });
  });

  // F6: volume.
  const total = iaTotalSeries(novo);
  if(IA_CONFIG.totalSeriesNaoPassaDoMotor && total>ctx.totalSeriesMotor) E('F6', `total de ${total} séries > ${ctx.totalSeriesMotor} do plano do motor`);
  const porGrupo = iaSeriesPorGrupo(novo);
  const VF = IA_CONFIG.volumeFaixas;
  if(VF.ativa){
    const focoGeral = Object.values(ctx.dias).every(i=>i.foco==='manutencao') ? 'manutencao' : null;
    const faixa = focoGeral ? VF.manutencao : VF.porNivel[nivel];
    VF.grupos.forEach(g=>{ const v = porGrupo[g] || 0; if(faixa && (v<faixa[0] || v>faixa[1])) A('F6b', `${g}: ${v} séries/semana fora de ${faixa[0]}–${faixa[1]}`); });
  }
  if(erros.length) return falhou();

  // Revalidação completa da semana com as regras do motor (V1–V10), com tipo e duração recalculados.
  const sessoes = ctx.semana.sessoes.map(s=>s.modalidade!=='musculacao' ? s : { ...s, tipo:tipos[s.dia], dura:tipos[s.dia]==='lower', duracaoMin:duracao[s.dia], exercicios:novo[s.dia].length });
  const semanaNova = { ...ctx.semana, muscPlan:novo, sessoes };
  const v = validarPlano(est, ctx.prio, ctx.freq, ctx.dist, semanaNova, ctx.ajustes);
  v.erros.forEach(e=>E(e.cod, e.detalhe));
  if(erros.length) return falhou();
  return { ok:true, erros, avisos, muscPlan:novo, tipos, duracao, motivos:resp.motivos.slice(), volume:{ total, porGrupo, motor:ctx.seriesPorGrupoMotor } };
}

// Semana final: cópia da semana do motor com a musculação trocada. Corrida não muda.
function iaMontarSemanaFinal(ctx, semanaServida, val){
  const w = iaClone(semanaServida);
  const est = ctx.est;
  const muscCode = {}, muscTipos = {};
  Object.keys(val.muscPlan).forEach(d=>{
    muscCode[d] = motorCodigoMusc({ tipo:val.tipos[d] }, ctx.ajustes.aliviarInferior);
    muscTipos[d] = val.tipos[d]==='lower' ? 'leg' : val.tipos[d];
  });
  const plano = iaClone(val.muscPlan);
  // Justificativas por dia: a do motor quando o tipo do dia não mudou; senão recalculadas numa cópia (a corrida da semana não é tocada).
  let recalc = null;
  const mudou = Object.keys(plano).some(d=>val.tipos[d]!==ctx.dias[d].tipoMotor);
  if(mudou){
    try{
      const foco = focoFromObjetivo(est.objetivo.tipo==='forca' ? 'massa' : (est.objetivo.tipo==='desempenho_corrida' ? 'performance' : est.objetivo.tipo));
      recalc = iaClone(plano);
      annotateHybridJustifications(iaClone(w.corridaWeek || []), recalc, foco, { ...(ctx.r.tipos || {}), muscTipos });
    }catch(e){ recalc = null; }
  }
  Object.keys(plano).forEach(d=>{
    const ref = (val.tipos[d]===ctx.dias[d].tipoMotor || !recalc) ? (semanaServida.muscPlan[d] || [])[0] : recalc[d][0];
    plano[d].forEach(e=>{ if(ref && ref.justificativa) e.justificativa = ref.justificativa; if(ref && ref.periodos) e.periodos = iaClone(ref.periodos); });
  });
  w.muscPlan = plano;
  if(mudou){ try{ w.fadiga = hybridFadigaSemana((ctx.r.tipos && ctx.r.tipos.runCode) || {}, muscCode); }catch(e){} }
  w.iaRefino = { versaoContrato:IA_CONFIG.versaoContrato, motivos:val.motivos, engineVersion:(typeof MOTOR_ENGINE_VERSION!=='undefined' ? MOTOR_ENGINE_VERSION : null), aplicadoEm:new Date().toISOString() };
  return w;
}

export { iaConferirEsquema, iaValidarProposta, iaMontarSemanaFinal, ESQUEMA as IA_ESQUEMA_RESPOSTA };
