// Catálogo técnico de corrida e opções de sessão (Etapa 1 do plano de personalização com IA, aprovada em 14/10/2026).
//
// O que este arquivo é:
//   - um catálogo FIXO de mobilidade, educativos, acelerações (strides) e alongamentos, com dose, duração, impacto,
//     nível mínimo e regiões de dor que impedem cada item;
//   - opções de sessão por tipo de dia que o Motor V2 já decidiu (leve, longão, qualidade), montadas com os mesmos
//     paces do VDOT (computeVdotPaces) e as mesmas funções de apoio do motor;
//   - o menu de opções de um dia (o que é tecnicamente válido para aquela pessoa naquele dia).
//
// O que este arquivo NÃO faz:
//   - não muda a geração normal do plano: nenhuma função daqui é chamada pelo Motor V2 (teste motor-intacto);
//   - não muda limites: toda opção cabe na duração da sessão que o motor já decidiu para o dia e nunca passa da carga
//     de intensidade dessa sessão (minutos em Z3/Z4/Z5 ponderados); qualidade continua 1 por semana, só no dia que o
//     motor escolheu e só se motorQualidadePermitida deixar;
//   - não cria pace: todo ritmo sai do VDOT; subidas e acelerações usam esforço (sem pace-alvo, sem alerta de ritmo).
//
// Quem usa (etapas futuras, com aprovação): a personalização por IA escolhe uma opção do menu e os itens do catálogo;
// esta montagem gera os números.
/* eslint-disable */

const CORRIDA_CATALOGO_VERSAO = 1;
const CC_NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const CC_REGIOES_INFERIOR = ['joelho', 'tornozelo', 'quadril', 'pe'];

/* ---------- catálogo: itens fora da corrida em si ---------- */
// seg = tempo estimado do item (inclui voltar caminhando nos educativos). contra = regiões de dor que impedem.
// impacto: 'alto' sai com qualquer dor em membro inferior ou orientação de limitar impacto; 'medio' sai com
// orientação de limitar impacto.
const CORRIDA_MOBILIDADE = {
  tornozelo:       { nome:'Mobilidade de tornozelo', dose:'10 avanços do joelho sobre o pé, cada lado', seg:60, impacto:'baixo', contra:[] },
  balanco_frontal: { nome:'Balanço de perna para frente e para trás', dose:'10 de cada lado', seg:45, impacto:'baixo', contra:['quadril'] },
  balanco_lateral: { nome:'Balanço de perna para os lados', dose:'10 de cada lado', seg:45, impacto:'baixo', contra:['quadril'] },
  rotacao_quadril: { nome:'Rotação de quadril (abrir e fechar o portão)', dose:'8 de cada lado', seg:45, impacto:'baixo', contra:[] },
  afundo_rotacao:  { nome:'Afundo com rotação de tronco', dose:'5 de cada lado, devagar', seg:60, impacto:'baixo', contra:['joelho'] },
  ponte_gluteo:    { nome:'Ponte de glúteo (ativação)', dose:'12 repetições', seg:45, impacto:'baixo', contra:['lombar'] },
};
const CORRIDA_EDUCATIVOS = {
  marcha_joelho:     { nome:'Marcha com elevação de joelho', dose:'2 × 20 m', seg:60, impacto:'baixo', contra:[], nivelMin:'iniciante' },
  skip_baixo:        { nome:'Skipping baixo', dose:'2 × 20 m', seg:60, impacto:'medio', contra:['tornozelo', 'pe'], nivelMin:'intermediario' },
  anfersen:          { nome:'Calcanhar no glúteo', dose:'2 × 20 m', seg:60, impacto:'medio', contra:['joelho'], nivelMin:'intermediario' },
  dribbling:         { nome:'Dribbling (passadas curtas e rápidas)', dose:'2 × 20 m', seg:60, impacto:'medio', contra:['tornozelo', 'pe'], nivelMin:'intermediario' },
  passada_lateral:   { nome:'Deslocamento lateral', dose:'2 × 20 m, cada lado', seg:75, impacto:'baixo', contra:['tornozelo'], nivelMin:'intermediario' },
  skip_alto:         { nome:'Skipping alto', dose:'2 × 20 m', seg:60, impacto:'alto', contra:['joelho', 'tornozelo', 'pe', 'quadril'], nivelMin:'intermediario' },
  saltito_tornozelo: { nome:'Saltitos de tornozelo', dose:'2 × 15 m', seg:50, impacto:'alto', contra:['joelho', 'tornozelo', 'pe'], nivelMin:'avancado' },
};
const CORRIDA_ALONGAMENTOS = {
  panturrilha:    { nome:'Panturrilha na parede', dose:'30 s cada lado', seg:60, contra:[] },
  soleo:          { nome:'Sóleo (joelho dobrado, na parede)', dose:'30 s cada lado', seg:60, contra:[] },
  posterior:      { nome:'Posterior de coxa em pé', dose:'30 s cada lado', seg:60, contra:['lombar'] },
  quadriceps:     { nome:'Quadríceps em pé', dose:'30 s cada lado', seg:60, contra:['joelho'] },
  flexor_quadril: { nome:'Flexor do quadril (afundo parado)', dose:'30 s cada lado', seg:60, contra:['joelho'] },
  gluteo:         { nome:'Glúteo e piriforme (figura 4)', dose:'30 s cada lado', seg:60, contra:['quadril'] },
  adutores:       { nome:'Adutores (afastamento lateral)', dose:'30 s cada lado', seg:60, contra:['quadril'] },
};
// Acelerações: curtas, soltas, sem sprint; estímulo de mecânica (não conta como sessão de qualidade).
const CORRIDA_STRIDES = { seg:20, recSeg:60, min:4, max:6, impacto:'alto', contra:CC_REGIOES_INFERIOR.slice(), nivelMin:'intermediario' };

/* ---------- textos de objetivo (catálogo; os já existentes vêm de VDOT_OBJETIVO) ---------- */
const CORRIDA_OBJETIVOS = {
  regenerativo: 'Ajuda a recuperar do treino anterior com o mínimo de estresse.',
  strides: 'Rodagem fácil com acelerações curtas: melhora a mecânica e a economia sem cansar.',
  progressivo: 'Longão que termina mais rápido: ensina a manter o ritmo com as pernas cansadas.',
  ritmo_prova: 'Blocos no ritmo-alvo da prova, para o corpo aprender a sustentar esse ritmo.',
  subidas: 'Força específica de corrida, com menos impacto que tiros no plano.',
  fartlek: 'Alterna ritmos fortes e trote por tempo, com estrutura definida.',
};

/* ---------- utilitários ---------- */
const ccNivelIdx = (n) => CC_NIVEIS.indexOf(n);
const ccRegioes = (est) => (est && est.restricoes && est.restricoes.regioes) || [];
function ccDorInferior(est){ return ccRegioes(est).some(r=>CC_REGIOES_INFERIOR.includes(r)) || !!(est.restricoes && est.restricoes.semImpacto); }
function ccItemPermitido(est, item){
  if(!item) return false;
  if((item.contra || []).some(r=>ccRegioes(est).includes(r))) return false;
  if(item.impacto==='alto' && ccDorInferior(est)) return false;
  if(item.impacto==='medio' && est.restricoes && est.restricoes.semImpacto) return false;
  if(item.nivelMin && ccNivelIdx(est.capacidade.corrida) < ccNivelIdx(item.nivelMin)) return false;
  return true;
}
const ccSegPorKm = (dias) => dias*86400;
const ccFaixa = (segKm, margem) => `${formatPace(segKm)} ~ ${formatPace(segKm + margem)}/km`;
// Minutos de uma etapa do GPS: por tempo (metaSeg) ou distância × pace médio da faixa.
function ccMinDaEtapa(s){
  if(s.tipo==='tempo') return (s.metaSeg || 0)/60;
  const r = parsePaceRangeToSec(s.pace);
  return r ? (s.km || 0)*((r.lo + r.hi)/2)/60 : 0;
}
// Carga de intensidade de uma sessão: minutos em Z3 × 1 + Z4 × 1,5 + Z5 × 2 (pela etapa do GPS). Aquecimento,
// trote, caminhada, acelerações e mobilidade não contam. Usada para nenhuma opção passar da sessão do motor.
function corridaCargaIntensa(sessao){
  const peso = (z)=>{ z = String(z || ''); return /Z5/.test(z) ? 2 : /Z4/.test(z) ? 1.5 : /Z3/.test(z) ? 1 : 0; };
  return Math.round((sessao && sessao.gpsSteps || []).reduce((t, s)=>t + peso(s.zona)*ccMinDaEtapa(s), 0)*10)/10;
}
function ccPaceMeio(faixa){ const r = parsePaceRangeToSec(faixa); return r ? (r.lo + r.hi)/2 : null; }

/* ---------- opções de sessão ---------- */
// dia: em que tipo de dia do motor a opção pode entrar. familia agrupa para variedade. regimes: 'continuo' e/ou 'run_walk'.
// provas: goalKeys em que a opção faz sentido (null = todas). nivelMin. semDorInferior: sai com dor em membro inferior.
const CORRIDA_OPCOES = {
  LEVE:              { dia:'leve',  familia:'leve', tipo:'Rodagem Leve', nome:'Rodagem leve', sessao:'RUN_EASY_Z2', regimes:['continuo', 'run_walk'], nivelMin:'iniciante' },
  REGENERATIVO:      { dia:'leve',  familia:'leve', tipo:'Rodagem Leve', nome:'Regenerativo', sessao:'RUN_EASY_Z2', regimes:['continuo'], nivelMin:'iniciante' },
  LEVE_STRIDES:      { dia:'leve',  familia:'leve', tipo:'Rodagem Leve', nome:'Rodagem leve com acelerações', sessao:'RUN_EASY_Z2', regimes:['continuo'], nivelMin:'intermediario', semDorInferior:true, prontidaoNormal:true },
  LONGO:             { dia:'longa', familia:'longo', tipo:'Longão', nome:'Longão', sessao:'RUN_LONG_RUN', regimes:['continuo', 'run_walk'], nivelMin:'iniciante' },
  LONGO_PROGRESSIVO: { dia:'longa', familia:'longo', tipo:'Longão', nome:'Longão progressivo', sessao:'RUN_LONG_RUN', regimes:['continuo'], nivelMin:'intermediario', prontidaoNormal:true, qualidade:true },
  LONGO_FINAL_M:     { dia:'longa', familia:'longo', tipo:'Longão', nome:'Longão com final em ritmo de prova', sessao:'RUN_LONG_RUN', regimes:['continuo'], nivelMin:'intermediario', provas:['21.0975', '42.195'], prontidaoNormal:true, qualidade:true },
  QUALIDADE_MOTOR:   { dia:'qualidade', familia:'motor', nome:'Sessão de qualidade do plano', regimes:['continuo'], nivelMin:'intermediario', qualidade:true },
  // intervalados (distância; ≤ 300 m usam o ritmo R, como no motor)
  I_200:  { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 200 m', sessao:'RUN_INTERVALS_VO2MAX', m:200, reps:[6, 14], rest:60, provas:['5', '10'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_300:  { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 300 m', sessao:'RUN_INTERVALS_VO2MAX', m:300, reps:[6, 12], rest:75, provas:['5', '10'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_400:  { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 400 m', sessao:'RUN_INTERVALS_VO2MAX', m:400, reps:[5, 10], rest:90, provas:['5', '10'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_600:  { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 600 m', sessao:'RUN_INTERVALS_VO2MAX', m:600, reps:[4, 8], rest:105, provas:['5', '10'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_800:  { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 800 m', sessao:'RUN_INTERVALS_VO2MAX', m:800, reps:[4, 7], rest:120, provas:['5', '10', '21.0975'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_1000: { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 1000 m', sessao:'RUN_INTERVALS_VO2MAX', m:1000, reps:[4, 6], rest:150, provas:['10', '21.0975', '42.195'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  I_1200: { dia:'qualidade', familia:'intervalo', tipo:'Intervalado', nome:'Tiros de 1200 m', sessao:'RUN_INTERVALS_VO2MAX', m:1200, reps:[3, 5], rest:180, provas:['10', '21.0975', '42.195'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  // limiar (contínuo ou em blocos com pausa curta: "cruzeiro")
  T_CONTINUO:   { dia:'qualidade', familia:'limiar', tipo:'Limiar', nome:'Limiar contínuo', sessao:'RUN_TEMPO_THRESHOLD', cont:[12, 30], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  T_CRUZEIRO_1000: { dia:'qualidade', familia:'limiar', tipo:'Limiar', nome:'Limiar em blocos de 1 km', sessao:'RUN_TEMPO_THRESHOLD', m:1000, reps:[3, 6], rest:60, qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  T_CRUZEIRO_1600: { dia:'qualidade', familia:'limiar', tipo:'Limiar', nome:'Limiar em blocos de 1,6 km', sessao:'RUN_TEMPO_THRESHOLD', m:1600, reps:[2, 5], rest:90, qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  T_CRUZEIRO_2000: { dia:'qualidade', familia:'limiar', tipo:'Limiar', nome:'Limiar em blocos de 2 km', sessao:'RUN_TEMPO_THRESHOLD', m:2000, reps:[2, 4], rest:120, provas:['10', '21.0975', '42.195'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  // ritmo de prova (pace = tempo previsto pelo VDOT ÷ distância da prova)
  RITMO_PROVA: { dia:'qualidade', familia:'ritmo_prova', tipo:'Intervalado', nome:'Ritmo de prova', sessao:'RUN_INTERVALS_VO2MAX', provas:['5', '10', '21.0975'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario', soComProva:true },
  // blocos em ritmo de maratona (as variantes do motor, escolhíveis)
  M_BLOCOS: { dia:'qualidade', familia:'maratona', tipo:'Limiar', nome:'Blocos em ritmo de maratona', sessao:'RUN_TEMPO_THRESHOLD', provas:['42.195'], qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  // fartlek estruturado (por tempo)
  FARTLEK_1X1:      { dia:'qualidade', familia:'fartlek', tipo:'Intervalado', nome:'Fartlek 1 min forte / 1 min trote', sessao:'RUN_INTERVALS_VO2MAX', blocos:'1x1', qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  FARTLEK_2X1:      { dia:'qualidade', familia:'fartlek', tipo:'Limiar', nome:'Fartlek 2 min forte / 1 min trote', sessao:'RUN_TEMPO_THRESHOLD', blocos:'2x1', qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  FARTLEK_PIRAMIDE: { dia:'qualidade', familia:'fartlek', tipo:'Limiar', nome:'Fartlek em pirâmide', sessao:'RUN_TEMPO_THRESHOLD', blocos:'piramide', qualidade:true, regimes:['continuo'], nivelMin:'intermediario' },
  // subidas (por esforço; precisa de ladeira de 4–8% ou esteira inclinada)
  SUBIDAS_CURTAS: { dia:'qualidade', familia:'subidas', tipo:'Intervalado', nome:'Subidas curtas', sessao:'RUN_INTERVALS_VO2MAX', seg:45, reps:[6, 10], rest:90, qualidade:true, regimes:['continuo'], nivelMin:'intermediario', semDorInferior:true },
  SUBIDAS_LONGAS: { dia:'qualidade', familia:'subidas', tipo:'Intervalado', nome:'Subidas longas', sessao:'RUN_INTERVALS_VO2MAX', seg:75, reps:[4, 8], rest:120, qualidade:true, regimes:['continuo'], nivelMin:'avancado', semDorInferior:true },
};
const CC_COR = { 'Rodagem Leve':'var(--blue)', 'Longão':'var(--green)', 'Intervalado':'var(--danger)', 'Limiar':'var(--amber)' };

/* ---------- contexto de um dia (a partir da semana que o MOTOR gerou) ---------- */
// semana: saída de gerarPlanoSemanal().semana. Devolve o que o menu precisa saber sobre o dia.
function corridaContextoDoDia(est, semana, dia, ajustes){
  const entry = (semana.corridaWeek || []).find(w=>w.day===dia);
  if(!entry) return null;
  const idx = DAY_ABBR.indexOf(dia), ant = DAY_ABBR[(idx + 6)%7], prox = DAY_ABBR[(idx + 1)%7];
  const sess = semana.sessoes || [];
  const tipoE = entry.estimulo && entry.estimulo.tipo;
  const tipoDia = tipoE==='qualidade' ? 'qualidade' : (tipoE==='longa' ? 'longa' : 'leve');   // 'rodagem' (1 corrida na semana) conta como leve
  const corridaEm = (d)=>(semana.corridaWeek || []).find(w=>w.day===d);
  const pernaPesada = (d)=>sess.some(s=>s.dia===d && s.modalidade==='musculacao' && s.tipo==='lower');
  return {
    dia, tipoDia, fase: semana.phaseLabel || null,
    ref:{ totalMin:entry.totalMin, totalKm:entry.totalKm, carga:corridaCargaIntensa(entry), type:entry.type },
    limiteMin: entry.totalMin,                         // nunca passa da duração que o motor deu ao dia
    vesperaDeQualidade: !!(corridaEm(prox) && corridaEm(prox).estimulo && corridaEm(prox).estimulo.tipo==='qualidade'),
    aposPernaPesada: pernaPesada(ant), pernaPesadaNoDia: pernaPesada(dia),
    ajustes: ajustes || {},
    sessaoMotor: entry,
  };
}

/* ---------- elegibilidade ---------- */
function corridaOpcaoElegivel(est, id, cdia){
  const op = CORRIDA_OPCOES[id];
  if(!op || !cdia) return { ok:false, motivo:'opcao_desconhecida' };
  const c = est.corrida, nivel = est.capacidade.corrida;
  if(op.dia!==cdia.tipoDia) return { ok:false, motivo:'tipo_de_dia' };
  if(!op.regimes.includes(c.regime)) return { ok:false, motivo:'regime' };
  if(ccNivelIdx(nivel) < ccNivelIdx(op.nivelMin)) return { ok:false, motivo:'nivel' };
  if(op.provas && !op.provas.includes(c.goalKey)) return { ok:false, motivo:'prova' };
  if(op.soComProva && est.objetivo.tipo!=='prova') return { ok:false, motivo:'sem_prova' };
  if(op.qualidade && !motorQualidadePermitida(est, cdia.ajustes)) return { ok:false, motivo:'qualidade_nao_permitida' };
  if(op.prontidaoNormal && est.recuperacao.prontidao!=='normal') return { ok:false, motivo:'recuperacao' };
  if(op.semDorInferior && ccDorInferior(est)) return { ok:false, motivo:'dor_membro_inferior' };
  if(id==='LEVE_STRIDES' && (cdia.vesperaDeQualidade || cdia.aposPernaPesada || cdia.pernaPesadaNoDia)) return { ok:false, motivo:'recuperacao_entre_sessoes' };
  if(id==='RITMO_PROVA' && /Retomada|calibra/i.test(cdia.fase || '')) return { ok:false, motivo:'fase' };
  return { ok:true };
}

/* ---------- escolhas padrão de mobilidade, educativos, acelerações e alongamento ---------- */
// Nem toda sessão precisa de tudo: leve e regenerativo vão sem preparação; qualidade leva mobilidade, educativos e,
// acelerações ficam como escolha; longão leva mobilidade curta; alongamento só depois de qualidade e longão.
function corridaAquecimentoPadrao(est, id){
  const op = CORRIDA_OPCOES[id] || {};
  const nivel = est.capacidade.corrida, ini = est.corrida.regime==='run_walk';
  let mob = [], edu = [], strides = 0, stridesFim = 0, along = [];
  if(ini){ mob = ['tornozelo', 'rotacao_quadril']; edu = ['marcha_joelho']; along = ['panturrilha', 'quadriceps']; }
  else if(op.dia==='qualidade'){
    // Acelerações não entram no padrão: na duração que o motor dá à qualidade elas tirariam tempo da parte principal.
    mob = ['tornozelo', 'balanco_frontal'];
    edu = nivel==='avancado' ? ['skip_baixo', 'anfersen', 'skip_alto'] : ['skip_baixo', 'anfersen'];
    along = ['panturrilha', 'flexor_quadril', 'posterior'];
  }else if(op.dia==='longa'){ mob = ['tornozelo', 'rotacao_quadril']; along = ['panturrilha', 'posterior', 'gluteo']; }
  else if(id==='LEVE_STRIDES'){ stridesFim = 4; }
  const ok = (cat)=>(x)=>ccItemPermitido(est, cat[x]);
  return {
    mobilidade: mob.filter(ok(CORRIDA_MOBILIDADE)), educativos: edu.filter(ok(CORRIDA_EDUCATIVOS)),
    strides: ccItemPermitido(est, CORRIDA_STRIDES) ? strides : 0, stridesFim: ccItemPermitido(est, CORRIDA_STRIDES) ? stridesFim : 0,
    alongamentos: along.filter(ok(CORRIDA_ALONGAMENTOS)),
  };
}
// Confere escolhas vindas de fora (IA): ids existentes, permitidos para a pessoa e quantidades nos limites.
function ccConferirEscolhas(est, e){
  const lista = (v)=>Array.isArray(v) ? v : [];
  const r = { mobilidade:lista(e.mobilidade), educativos:lista(e.educativos), alongamentos:lista(e.alongamentos), strides:e.strides|0, stridesFim:e.stridesFim|0 };
  const valido = r.mobilidade.every(x=>ccItemPermitido(est, CORRIDA_MOBILIDADE[x])) && r.educativos.every(x=>ccItemPermitido(est, CORRIDA_EDUCATIVOS[x]))
    && r.alongamentos.every(x=>ccItemPermitido(est, CORRIDA_ALONGAMENTOS[x]))
    && new Set(r.mobilidade).size===r.mobilidade.length && new Set(r.educativos).size===r.educativos.length && new Set(r.alongamentos).size===r.alongamentos.length
    && r.mobilidade.length<=4 && r.educativos.length<=4 && r.alongamentos.length<=5;
  const st = (n)=>n===0 || (n>=CORRIDA_STRIDES.min && n<=CORRIDA_STRIDES.max && ccItemPermitido(est, CORRIDA_STRIDES));
  return (valido && st(r.strides) && st(r.stridesFim) && !(r.strides && r.stridesFim)) ? r : null;
}

/* ---------- montagem ---------- */
// partes: { aquecMin, escolhas, principal:{ desc, pace, zona, km, min, gps[], display[] }, desaqMin }
function ccMontar(est, id, cdia, partes){
  const op = CORRIDA_OPCOES[id], ctx = est.corrida.ctx, P = ctx.paces;
  const E = partes.escolhas;
  const blocos = [], steps = [], gps = [];
  let min = 0, km = 0;
  const add = (b)=>{ blocos.push(b); min += b.min; km += b.km; };
  // 1) aquecimento em Z1
  if(partes.aquecMin>0){
    const k = kmFromMinAtPace(partes.aquecMin, P.Es);
    const txt = est.corrida.regime==='run_walk' ? 'caminhada rápida e trote muito leve' : 'trote leve';
    add({ fase:'aquecimento', titulo:'Aquecimento', min:partes.aquecMin, km:k, pace:ctx.easyPace, zona:'Z1', desc:`${partes.aquecMin} min de ${txt} em Z1` });
    const s = { name:'Aquecimento', km:hbKmDeMin(ctx, partes.aquecMin), pace:ctx.easyPace, zona:'Z1', desc:`${partes.aquecMin} min em Z1` };
    steps.push(s); gps.push({ ...s, km:k, tipo:'tempo', metaSeg:partes.aquecMin*60 });   // por tempo: a meta é o tempo, não o km arredondado
  }
  // 2) mobilidade e educativos (tempo, sem pace)
  const itensPrep = [...E.mobilidade.map(x=>({ id:x, ...CORRIDA_MOBILIDADE[x], grupo:'mobilidade' })), ...E.educativos.map(x=>({ id:x, ...CORRIDA_EDUCATIVOS[x], grupo:'educativos' }))];
  if(itensPrep.length){
    const seg = itensPrep.reduce((t, x)=>t + x.seg, 0);
    const titulo = E.mobilidade.length && E.educativos.length ? 'Mobilidade e educativos' : E.mobilidade.length ? 'Mobilidade' : 'Educativos';
    const desc = itensPrep.map(x=>`${x.nome} (${x.dose})`).join(' · ');
    add({ fase:'preparacao', titulo, min:seg/60, km:0, itens:itensPrep.map(x=>({ id:x.id, grupo:x.grupo, nome:x.nome, dose:x.dose })), desc });
    const s = { name:titulo, km:0, pace:'', zona:'', desc, tipo:'tempo', metaSeg:seg };
    steps.push(s); gps.push(s);
  }
  const blocoStrides = (n, onde)=>{
    const seg = n*(CORRIDA_STRIDES.seg + CORRIDA_STRIDES.recSeg);
    const k = n*(kmFromMinAtPace(CORRIDA_STRIDES.seg/60, P.I) + (CORRIDA_STRIDES.recSeg/60)*HB_WALK_KM_MIN);
    const desc = `${n} × ${CORRIDA_STRIDES.seg} s acelerando de forma solta (sem sprint), ${CORRIDA_STRIDES.recSeg} s caminhando entre`;
    add({ fase:'strides', titulo:'Acelerações', min:seg/60, km:k, zona:'esforço', desc, onde });
    steps.push({ name:'Acelerações', km:roundToHalf(k), pace:'', zona:'', desc, tipo:'tempo', metaSeg:seg });
    for(let i=1;i<=n;i++){
      gps.push({ name:`Aceleração ${i}/${n}`, km:kmFromMinAtPace(CORRIDA_STRIDES.seg/60, P.I), pace:'', zona:'', desc:'Acelere de forma solta, sem sprint', tipo:'tempo', metaSeg:CORRIDA_STRIDES.seg });
      gps.push({ name:`Caminhada ${i}/${n}`, km:(CORRIDA_STRIDES.recSeg/60)*HB_WALK_KM_MIN, pace:'', zona:'Z1', desc:`Caminhada ${CORRIDA_STRIDES.recSeg} s`, tipo:'tempo', metaSeg:CORRIDA_STRIDES.recSeg });
    }
  };
  if(E.strides) blocoStrides(E.strides, 'inicio');
  // 3) parte principal
  const pr = partes.principal;
  add({ fase:'principal', titulo:'Principal', min:pr.min, km:pr.km, pace:pr.pace, zona:pr.zona, desc:pr.desc });
  (pr.display || [{ name:'Principal', km:Math.max(0.5, roundToHalf(pr.km)), pace:pr.pace, zona:pr.zona, desc:pr.desc }]).forEach(s=>steps.push(s));
  pr.gps.forEach(s=>gps.push(s));
  if(E.stridesFim) blocoStrides(E.stridesFim, 'fim');
  // 4) desaquecimento em Z1
  if(partes.desaqMin>0){
    const k = kmFromMinAtPace(partes.desaqMin, P.Es);
    const desc = `${partes.desaqMin} min em Z1 · trote leve e caminhada`;
    add({ fase:'desaquecimento', titulo:'Desaquecimento', min:partes.desaqMin, km:k, pace:ctx.easyPace, zona:'Z1', desc });
    const s = { name:'Desaquecimento', km:hbKmDeMin(ctx, partes.desaqMin), pace:ctx.easyPace, zona:'Z1', desc };
    steps.push(s); gps.push({ ...s, km:k, tipo:'tempo', metaSeg:partes.desaqMin*60 });
  }
  // 5) alongamento opcional
  if(E.alongamentos.length){
    const itens = E.alongamentos.map(x=>({ id:x, ...CORRIDA_ALONGAMENTOS[x] }));
    const seg = itens.reduce((t, x)=>t + x.seg, 0);
    const desc = itens.map(x=>`${x.nome} (${x.dose})`).join(' · ');
    add({ fase:'alongamento', titulo:'Alongamento (opcional)', min:seg/60, km:0, opcional:true, itens:itens.map(x=>({ id:x.id, nome:x.nome, dose:x.dose })), desc });
    const s = { name:'Alongamento (opcional)', km:0, pace:'', zona:'', desc, tipo:'tempo', metaSeg:seg };
    steps.push(s); gps.push(s);
  }
  const aquecDesc = blocos.filter(b=>b.fase==='aquecimento' || b.fase==='preparacao' || (b.fase==='strides' && b.onde==='inicio')).map(b=>b.desc).join(' · ');
  const desaqDesc = blocos.filter(b=>b.fase==='desaquecimento' || b.fase==='alongamento' || (b.fase==='strides' && b.onde==='fim')).map(b=>b.desc).join(' · ');
  const sessao = {
    type:op.tipo, nomeSessao:op.nome, opcao:id, cor:CC_COR[op.tipo] || 'var(--blue)', objetivo:partes.objetivo, sessao:op.sessao, modo:'hibrido',
    warmupDesc:aquecDesc, warmupPace:ctx.easyPace, mainDesc:pr.desc, mainPace:pr.pace, cooldownDesc:desaqDesc, cooldownPace:ctx.easyPace,
    zonaFC:pr.zona,
    totalKm:Math.max(0.5, steps.reduce((t, x)=>t + (x.km || 0), 0)), totalMin:Math.round(min),
    kmEstimado:Math.round(km*100)/100,
    steps, gpsSteps:gps, blocos, catalogoVersao:CORRIDA_CATALOGO_VERSAO,
  };
  sessao.cargaIntensa = corridaCargaIntensa(sessao);
  return sessao;
}
// Repetições com recuperação: monta GPS e texto. rep = { tipo:'distancia'|'tempo', km|seg, pace (faixa ou ''), paceDias (para estimar), zona, nome }
function ccRepeticoes(ctx, n, rep, rec, rotulo){
  const P = ctx.paces, gps = [];
  let km = 0, min = 0;
  for(let i=1;i<=n;i++){
    if(rep.tipo==='distancia'){
      gps.push({ name:`${rep.nome} ${i}/${n}`, km:rep.km, pace:rep.pace, zona:rep.zona, desc:rep.desc, tipo:'distancia' });
      km += rep.km; min += minFromKmAtPace(rep.km, rep.paceDias);
    }else{
      const k = kmFromMinAtPace(rep.seg/60, rep.paceDias);
      gps.push({ name:`${rep.nome} ${i}/${n}`, km:k, pace:rep.pace, zona:rep.zona, desc:rep.desc, tipo:'tempo', metaSeg:rep.seg });
      km += k; min += rep.seg/60;
    }
    if(i<n && rec.seg>0){
      const rk = rec.caminhada ? (rec.seg/60)*HB_WALK_KM_MIN : kmFromMinAtPace(rec.seg/60, P.Es);
      gps.push({ name:`${rec.nome} ${i}/${n}`, km:rk, pace:rec.pace, zona:'Z1', desc:`${rec.nome} ${hbFmtRest(rec.seg)}`, tipo:'tempo', metaSeg:rec.seg });
      km += rk; min += rec.seg/60;
    }
  }
  return { desc:rotulo(n), km, min, gps };
}

// Principal de cada opção para um orçamento de minutos. Devolve null se não couber.
function ccPrincipal(est, id, orcMin, cdia){
  const op = CORRIDA_OPCOES[id], c = est.corrida, ctx = c.ctx, P = ctx.paces;
  const fmtSeg = (s)=>hbFmtRest(Math.round(s));
  const trote = { nome:'Trote', pace:ctx.easyPace };
  if(op.familia==='leve' || op.familia==='longo'){
    if(c.regime==='run_walk'){
      const t = ctx.runWalk ? ctx.runWalk.t : 2, w = ctx.runWalk ? ctx.runWalk.w : 1;
      const kmMin = (t*(1/(P.Es*1440)) + w*HB_WALK_KM_MIN)/(t + w);
      let alvoKm = Math.max(0.5, orcMin*kmMin), r = null;
      for(let g=0; g<20; g++){ r = hbRunWalk(ctx, alvoKm, op.familia==='longo' ? 1 : 0); if(r.min<=orcMin + 0.49 || alvoKm<0.6) break; alvoKm *= 0.92; }
      return r && r.min<=orcMin + 0.49 ? { desc:r.desc, pace:r.pace, zona:r.zona, km:r.km, min:r.min, gps:r.gps } : null;
    }
    if(id==='REGENERATIVO'){
      const lo = ccSegPorKm(P.Es), pace = ccFaixa(lo, 30), meio = (lo + 15)/86400;
      let k = roundToHalf(kmFromMinAtPace(orcMin, meio)); while(k>0.5 && minFromKmAtPace(k, meio)>orcMin) k -= 0.5;
      if(k<0.5) return null;
      const desc = `${fmtKm(k)} bem leves (Z1/Z2), mais devagar que a rodagem`;
      return { desc, pace, zona:'Z1/Z2', km:k, min:minFromKmAtPace(k, meio), gps:[{ name:'Regenerativo', km:k, pace, zona:'Z1', desc, tipo:'distancia' }] };
    }
    if(id==='LONGO_PROGRESSIVO' || id==='LONGO_FINAL_M'){
      const frac = id==='LONGO_FINAL_M' ? (c.goalKey==='42.195' ? 0.3 : 0.2) : 0.15;
      // total em Z2 + final em M; ajusta o km para caber nos minutos
      let tot = kmFromMinAtPace(orcMin, P.Es), eKm, mKm, mn;
      for(let g=0; g<30; g++){
        eKm = roundToHalf(tot*(1 - frac)); mKm = Math.max(0.5, roundToHalf(tot - eKm));
        mn = minFromKmAtPace(eKm, P.Es) + minFromKmAtPace(mKm, P.M);
        if(mn<=orcMin) break; tot -= 0.5;
      }
      if(mn>orcMin || eKm<1) return null;
      const paceM = paceRangeWithMargin(P.M, 3) + '/km';
      const desc = id==='LONGO_FINAL_M' ? `${fmtKm(eKm)} em Z2 + ${fmtKm(mKm)} finais em ritmo de maratona (${daysToPaceStr(P.M)}/km)`
        : `${fmtKm(eKm)} em Z2 + ${fmtKm(mKm)} finais acelerando até o ritmo de maratona (${daysToPaceStr(P.M)}/km)`;
      return { desc, pace:ctx.easyPace, zona:'Z2/Z3', km:eKm + mKm, min:mn,
        display:[{ name:'Longão em Z2', km:eKm, pace:ctx.easyPace, zona:'Z2', desc:`${fmtKm(eKm)} em Z2` }, { name:'Final em ritmo de maratona', km:mKm, pace:paceM, zona:'Z3', desc:`${fmtKm(mKm)} em ritmo de maratona` }],
        gps:[{ name:'Longão em Z2', km:eKm, pace:ctx.easyPace, zona:'Z2', desc:`${fmtKm(eKm)} em Z2`, tipo:'distancia' }, { name:'Final em ritmo de maratona', km:mKm, pace:paceM, zona:'Z3', desc:`${fmtKm(mKm)} em ritmo de maratona`, tipo:'distancia' }] };
    }
    // LEVE / LONGO / LEVE_STRIDES: contínuo em Z2 (mesmo ritmo médio que o motor usa em cada um)
    // Mesma conta do motor: o tempo usa o km bruto que preenche o orçamento; o km mostrado é arredondado a 0,5.
    const meio = op.familia==='longo' ? P.Es : (P.Es + P.Ef)/2;
    const kBruto = kmFromMinAtPace(Math.floor(orcMin), meio), k = Math.max(0.5, roundToHalf(kBruto));
    if(kBruto<0.5) return null;
    const desc = `${fmtKm(k)} contínuos em Z2`;
    return { desc, pace:ctx.easyPace, zona:'Z2', km:kBruto, min:minFromKmAtPace(kBruto, meio), gps:[{ name:op.familia==='longo' ? 'Longão' : 'Principal', km:k, pace:ctx.easyPace, zona:'Z2', desc, tipo:'distancia' }] };
  }
  // ---- qualidade: escolhe o MAIOR número de repetições que cabe nos minutos e na carga do motor ----
  const cargaMax = cdia.ref.carga + 0.05;
  const melhor = (montar, nMin, nMax)=>{
    for(let n=nMax; n>=nMin; n--){
      const r = montar(n);
      if(r && r.min<=orcMin + 0.49 && ccCargaDoPrincipal(r)<=cargaMax) return r;
    }
    return null;
  };
  const nivelBonus = est.capacidade.corrida==='avancado' ? 1 : 0;
  if(op.familia==='intervalo'){
    const chave = op.m<=300 ? 'R' : 'I', paceD = P[chave], pace = paceRangeWithMargin(paceD, 3) + '/km';
    const zona = 'Z5';
    const r = melhor((n)=>ccRepeticoes(ctx, n, { tipo:'distancia', km:op.m/1000, pace, paceDias:paceD, zona, nome:'Tiro', desc:`${op.m} m` }, { ...trote, seg:op.rest },
      (n)=>`${n} × ${op.m} m em Z5 (ritmo ${chave}), trote ${fmtSeg(op.rest)} entre`), op.reps[0], op.reps[1] + nivelBonus);
    return r ? { ...r, pace, zona } : null;
  }
  if(op.familia==='limiar'){
    const pace = paceRangeWithMargin(P.T, 3) + '/km';
    if(op.cont){
      for(let m=op.cont[1]; m>=op.cont[0]; m--){
        const k = kmFromMinAtPace(m, P.T);
        const r = { desc:`${m} min contínuos em limiar (Z4)`, km:k, min:m, gps:[{ name:'Limiar', km:k, pace, zona:'Z4', desc:`${m} min em limiar`, tipo:'distancia' }] };
        if(r.min<=orcMin + 0.49 && ccCargaDoPrincipal(r)<=cargaMax) return { ...r, pace, zona:'Z4', display:[{ name:'Principal', km:Math.max(0.5, roundToHalf(k)), pace, zona:'Z4', desc:r.desc }] };
      }
      return null;
    }
    const r = melhor((n)=>ccRepeticoes(ctx, n, { tipo:'distancia', km:op.m/1000, pace, paceDias:P.T, zona:'Z4', nome:'Limiar', desc:`${op.m} m em limiar` }, { ...trote, seg:op.rest },
      (n)=>`${n} × ${fmtKm(op.m/1000)} em limiar (Z4), trote ${fmtSeg(op.rest)} entre`), op.reps[0], op.reps[1] + nivelBonus);
    return r ? { ...r, pace, zona:'Z4' } : null;
  }
  if(op.familia==='ritmo_prova'){
    const dist = parseFloat(c.goalKey), segKm = predictRaceTimeSec(c.vdot, dist)/dist, paceD = segKm/86400;
    const pace = ccFaixa(segKm - 2, 4);
    // Do bloco mais longo para o mais curto: o primeiro que cabe nos minutos e na carga da sessão do motor.
    const blocos = { '5':[{ m:1000, reps:[3, 5], rest:120 }, { m:800, reps:[3, 6], rest:90 }, { m:600, reps:[4, 6], rest:75 }],
      '10':[{ m:2000, reps:[2, 4], rest:120 }, { m:1600, reps:[2, 4], rest:90 }, { m:1000, reps:[3, 6], rest:60 }],
      '21.0975':[{ m:3000, reps:[2, 3], rest:180 }, { m:2000, reps:[2, 4], rest:120 }, { m:1600, reps:[3, 4], rest:90 }] }[c.goalKey];
    if(!blocos) return null;
    const zona = c.goalKey==='5' ? 'Z5' : 'Z4';
    for(const bloco of blocos){
      const r = melhor((n)=>ccRepeticoes(ctx, n, { tipo:'distancia', km:bloco.m/1000, pace, paceDias:paceD, zona, nome:'Ritmo de prova', desc:`${fmtKm(bloco.m/1000)} no ritmo da prova` }, { ...trote, seg:bloco.rest },
        (n)=>`${n} × ${fmtKm(bloco.m/1000)} no ritmo de prova (${formatPace(segKm)}/km), trote ${fmtSeg(bloco.rest)} entre`), bloco.reps[0], bloco.reps[1]);
      if(r) return { ...r, pace, zona, bloco };
    }
    return null;
  }
  if(op.familia==='maratona'){
    const pace = paceRangeWithMargin(P.M, 3) + '/km';
    for(const v of [{ reps:3, km:5, rec:2 }, { reps:2, km:8, rec:3 }, { reps:2, km:6, rec:2 }, { reps:2, km:5, rec:2 }, { reps:2, km:4, rec:1.5 }, { reps:2, km:3, rec:1 }, { reps:1, km:6, rec:0 }]){
      const gps = []; let km = 0, min = 0;
      for(let i=1;i<=v.reps;i++){
        gps.push({ name:v.reps>1 ? `Ritmo de maratona ${i}/${v.reps}` : 'Ritmo de maratona', km:v.km, pace, zona:'Z3', desc:`${fmtKm(v.km)} em ritmo de prova`, tipo:'distancia' });
        km += v.km; min += minFromKmAtPace(v.km, P.M);
        if(i<v.reps && v.rec){ gps.push({ name:`Recuperação ${i}/${v.reps}`, km:v.rec, pace:ctx.easyPace, zona:'Z2', desc:`${fmtKm(v.rec)} em Z2`, tipo:'distancia' }); km += v.rec; min += minFromKmAtPace(v.rec, P.Es); }
      }
      const r = { desc:v.reps>1 ? `${v.reps} × ${fmtKm(v.km)} em ritmo de maratona (Z3), ${fmtKm(v.rec)} em Z2 entre` : `${fmtKm(v.km)} contínuos em ritmo de maratona (Z3)`, km, min, gps };
      if(min<=orcMin + 0.49 && ccCargaDoPrincipal(r)<=cargaMax) return { ...r, pace, zona:'Z3' };
    }
    return null;
  }
  if(op.familia==='fartlek'){
    const pT = paceRangeWithMargin(P.T, 3) + '/km', pI = paceRangeWithMargin(P.I, 3) + '/km';
    if(op.blocos==='piramide'){
      for(const seq of [[1, 2, 3, 2, 1], [1, 2, 3, 2], [1, 2, 2, 1], [1, 2, 1]]){
        const gps = []; let km = 0, min = 0;
        seq.forEach((m, i)=>{
          const k = kmFromMinAtPace(m, P.T);
          gps.push({ name:`Forte ${i + 1}/${seq.length}`, km:k, pace:pT, zona:'Z4', desc:`${m} min forte (limiar)`, tipo:'tempo', metaSeg:m*60 }); km += k; min += m;
          if(i<seq.length - 1){ const rs = m*30, rk = kmFromMinAtPace(rs/60, P.Es); gps.push({ name:`Trote ${i + 1}/${seq.length}`, km:rk, pace:ctx.easyPace, zona:'Z1', desc:`Trote ${hbFmtRest(rs)}`, tipo:'tempo', metaSeg:rs }); km += rk; min += rs/60; }
        });
        const r = { desc:`Pirâmide ${seq.join('-')} min forte em limiar (Z4), trote de metade do tempo entre`, km, min, gps };
        if(min<=orcMin + 0.49 && ccCargaDoPrincipal(r)<=cargaMax) return { ...r, pace:pT, zona:'Z4' };
      }
      return null;
    }
    const forte = op.blocos==='1x1' ? { seg:60, pace:pI, paceDias:P.I, zona:'Z5', rot:'1 min forte (ritmo I)' } : { seg:120, pace:pT, paceDias:P.T, zona:'Z4', rot:'2 min forte (limiar)' };
    const nMax = op.blocos==='1x1' ? 12 : 8, nMin = op.blocos==='1x1' ? 6 : 4;
    const r = melhor((n)=>ccRepeticoes(ctx, n, { tipo:'tempo', seg:forte.seg, pace:forte.pace, paceDias:forte.paceDias, zona:forte.zona, nome:'Forte', desc:forte.rot }, { ...trote, seg:60 },
      (n)=>`${n} × (${forte.rot} + 1 min de trote)`), nMin, nMax);
    return r ? { ...r, pace:forte.pace, zona:forte.zona } : null;
  }
  if(op.familia==='subidas'){
    // Por esforço: sem pace-alvo (o GPS não cobra ritmo na ladeira). Distância estimada a ~115% do tempo do limiar.
    const paceD = P.T*1.15;
    const r = melhor((n)=>ccRepeticoes(ctx, n, { tipo:'tempo', seg:op.seg, pace:'', paceDias:paceD, zona:'Z4/Z5', nome:'Subida', desc:`Subida de ${op.seg} s forte (esforço 8 de 10)` },
      { nome:'Descida', pace:'', seg:op.rest, caminhada:false },
      (n)=>`${n} × ${op.seg} s subindo forte (esforço 8 de 10, ladeira de 4–8% ou esteira inclinada), descida em trote leve (${fmtSeg(op.rest)})`), op.reps[0], op.reps[1]);
    return r ? { ...r, pace:'esforço 8 de 10', zona:'Z4/Z5' } : null;
  }
  return null;
}
function ccCargaDoPrincipal(r){ return corridaCargaIntensa({ gpsSteps:r.gps }); }

// Faixa de duração de cada opção em relação à sessão do motor para o dia (regenerativo é de propósito mais curto).
function ccFaixaDuracao(id){ return id==='REGENERATIVO' ? [0.6, 0.8] : [0.8, 1]; }
// Monta a opção para o dia. escolhas: undefined = padrão do catálogo; objeto = escolhas de fora (conferidas).
// Devolve null se a opção não for elegível, se as escolhas forem inválidas ou se não couber.
function corridaMontarOpcao(est, id, cdia, escolhas){
  const el = corridaOpcaoElegivel(est, id, cdia);
  if(!el.ok) return null;
  if(id==='QUALIDADE_MOTOR') return JSON.parse(JSON.stringify(cdia.sessaoMotor));
  if(escolhas!==undefined){ const E = ccConferirEscolhas(est, escolhas); return E ? ccMontarCom(est, id, cdia, E) : null; }
  // Padrão do catálogo; se não couber, encolhe (sem alongamento, depois sem educativos, depois sem nada) antes de desistir.
  const P0 = corridaAquecimentoPadrao(est, id);
  for(const E of [P0, { ...P0, alongamentos:[] }, { ...P0, alongamentos:[], educativos:[] }, { mobilidade:[], educativos:[], alongamentos:[], strides:0, stridesFim:P0.stridesFim }]){
    const s = ccMontarCom(est, id, cdia, E);
    if(s) return s;
  }
  return null;
}
function ccMontarCom(est, id, cdia, E){
  const op = CORRIDA_OPCOES[id], c = est.corrida, ctx = c.ctx;
  const faixa = ccFaixaDuracao(id);
  const alvo = Math.floor(cdia.limiteMin*faixa[1]);
  const ehQual = op.dia==='qualidade';
  // aquecimento/desaquecimento: as mesmas regras do motor (qualidade: por prova e nível; leve e longão: 60% e 5 min)
  let aquecMin = ehQual ? ctx.warmMin : Math.max(5, Math.round(ctx.warmMin*0.6));
  let desaqMin = ehQual ? HYBRID_COOLDOWN_MIN[ctx.nivel] : 5;
  if(id==='REGENERATIVO'){ aquecMin = 0; desaqMin = 0; }          // regenerativo já é todo em Z1/Z2: sem blocos extras
  // Mobilidade, educativos e acelerações fazem parte do aquecimento; alongamento, do desaquecimento. Eles usam o tempo
  // que o motor já reserva para essas fases, deixando um mínimo de trote (5 min antes de qualidade, 3 min nos outros).
  const segPrep = E.mobilidade.reduce((t, x)=>t + CORRIDA_MOBILIDADE[x].seg, 0) + E.educativos.reduce((t, x)=>t + CORRIDA_EDUCATIVOS[x].seg, 0) + E.strides*(CORRIDA_STRIDES.seg + CORRIDA_STRIDES.recSeg);
  const segFim = E.alongamentos.reduce((t, x)=>t + CORRIDA_ALONGAMENTOS[x].seg, 0) + E.stridesFim*(CORRIDA_STRIDES.seg + CORRIDA_STRIDES.recSeg);
  if(aquecMin>0) aquecMin = Math.max(ehQual ? 5 : 3, Math.round(aquecMin - segPrep/60));
  if(desaqMin>0) desaqMin = Math.max(3, Math.round(desaqMin - segFim/60));
  const orc = alvo - aquecMin - desaqMin - (segPrep + segFim)/60;
  if(orc<5) return null;
  const pr = ccPrincipal(est, id, orc, cdia);
  if(!pr) return null;
  // Qualidade: a sobra de tempo (até 10 min) vira trote leve no desaquecimento, para a sessão ficar perto da duração do motor.
  if(ehQual){ const sobra = Math.floor(orc - pr.min); if(sobra>0) desaqMin += Math.min(10, sobra); }
  const objetivo = ({ leve:VDOT_OBJETIVO['Fácil'], longo:VDOT_OBJETIVO['Longão'], intervalo:VDOT_OBJETIVO['Intervalado'], limiar:VDOT_OBJETIVO['Limiar'], maratona:VDOT_OBJETIVO['Limiar'],
    ritmo_prova:CORRIDA_OBJETIVOS.ritmo_prova, fartlek:CORRIDA_OBJETIVOS.fartlek, subidas:CORRIDA_OBJETIVOS.subidas })[op.familia];
  const objetivoFinal = id==='REGENERATIVO' ? CORRIDA_OBJETIVOS.regenerativo : id==='LEVE_STRIDES' ? CORRIDA_OBJETIVOS.strides : id==='LONGO_PROGRESSIVO' ? CORRIDA_OBJETIVOS.progressivo : objetivo;
  const s = ccMontar(est, id, cdia, { aquecMin, desaqMin, escolhas:E, principal:pr, objetivo:objetivoFinal });
  // Limites que nenhuma opção passa: duração do motor para o dia e carga de intensidade da sessão do motor.
  if(s.totalMin > alvo || s.totalMin < Math.floor(cdia.limiteMin*faixa[0])) return null;
  if(s.cargaIntensa > cdia.ref.carga + 0.05) return null;
  return s;
}

// Menu do dia: opções elegíveis que cabem (com as escolhas padrão), em ordem estável.
function corridaOpcoesDoDia(est, cdia){
  if(!cdia) return [];
  return Object.keys(CORRIDA_OPCOES).filter(id=>corridaMontarOpcao(est, id, cdia)!==null);
}
// Itens do catálogo que a pessoa pode fazer (dor, impacto e nível). Usado no pedido da IA (menus fechados).
function corridaItensPermitidos(est){
  const ok = (cat)=>Object.keys(cat).filter(x=>ccItemPermitido(est, cat[x]));
  return { mobilidade:ok(CORRIDA_MOBILIDADE), educativos:ok(CORRIDA_EDUCATIVOS), alongamentos:ok(CORRIDA_ALONGAMENTOS), strides:ccItemPermitido(est, CORRIDA_STRIDES) };
}
// Opção do catálogo que corresponde à sessão que o motor já deu ao dia.
const CORRIDA_OPCAO_DO_MOTOR = { leve:'LEVE', longa:'LONGO', qualidade:'QUALIDADE_MOTOR' };
// Blocos detalhados de uma sessão montada pelo catálogo (para telas futuras); sessões do motor não têm blocos.
function corridaBlocosDetalhados(sessao){ return (sessao && Array.isArray(sessao.blocos)) ? sessao.blocos : null; }

Object.assign(globalThis, {
  CORRIDA_CATALOGO_VERSAO, CORRIDA_MOBILIDADE, CORRIDA_EDUCATIVOS, CORRIDA_ALONGAMENTOS, CORRIDA_STRIDES, CORRIDA_OPCOES, CORRIDA_OBJETIVOS,
  corridaCargaIntensa, corridaContextoDoDia, corridaOpcaoElegivel, corridaAquecimentoPadrao, corridaMontarOpcao, corridaOpcoesDoDia, corridaBlocosDetalhados,
  corridaItensPermitidos, CORRIDA_OPCAO_DO_MOTOR, ccConferirEscolhas,
});
