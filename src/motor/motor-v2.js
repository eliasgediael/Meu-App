// Motor V2 — do athleteProfile ao plano semanal (lerEstado → definirPrioridade → definirFrequencias →
// distribuirSessoes → montarSessoes → validarPlano). Movido sem alterações de treino-app.html (Bloco 2).
/* eslint-disable */
/* ===== MOTOR V2 — do athleteProfile ao plano semanal =====
   lerEstado → definirPrioridade → definirFrequencias → distribuirSessoes → montarSessoes → validarPlano,
   orquestrados por gerarPlanoSemanal(). Só LÊ o athleteProfile (Questionário V2 congelado); reaproveita os construtores de
   sessão de corrida (hb*), o construtor de musculação, o catálogo, o VDOT e a matriz de fadiga que já existiam.
   Regra de conflito: 1 segurança/restrições > 2 disponibilidade real > 3 capacidade atual > 4 objetivo > 5 recuperação > 6 preferências.
   Os números abaixo são PROVISÓRIOS (calibráveis) e ficam todos nesta tabela. */
const MOTOR_ENGINE_VERSION = '2.1.0';
const MOTOR_PARAMS = {
  minSlotCorrida:25, minSlotMusc:30, minDobro:55, diaSemInfo:40,
  minSessaoCorrida:20,
  tetoFreqCorrida:{ iniciante:3, intermediario:4, avancado:5 },
  tetoFreqMusc:{ iniciante:3, intermediario:4, avancado:4 },
  tetoSessoes:{ iniciante:5, intermediario:7, avancado:8 },
  volumeRef:{ iniciante:90, intermediario:180, avancado:270 },            // min/semana de corrida (até 10 km)
  fatorDistancia:{ '5':1, '10':1, '21.0975':1.2, '42.195':1.4 },
  sessaoPadrao:{ iniciante:30, intermediario:40, avancado:50 },           // min, quando não há dado
  fracaoSessaoTipica:0.6, tetoSessaoTipica:1.5,                            // sessão típica ≈ 60% da maior (conservador), no máx 1,5× a padrão
  fracaoRetomada:[0.8, 0.6, 0.5, 0.4, 0.3],                                // por faixa de tempo parado
  tetoLongo:{ iniciante:45, intermediario:75, avancado:105 }, tetoLongoDistancia:20,
  shareLonga:{ 2:0.55, 3:0.42, 4:0.36, 5:0.30 },
  toleranciaVolume:0.10, reducaoDorModerada:0.8, reducaoSonoReduzido:0.9,
  vdotPadrao:{ iniciante:30, intermediario:40, avancado:50 },
  passoSemanal:0.08, validadeDesempenhoDias:92,
  minutosPorExercicio:4.6, aquecimentoMusc:5, tetoRunWalk:40,
};
const MOTOR_NIVEIS = ['iniciante','intermediario','avancado'];
const MOTOR_FAIXAS = {
  experiencia:['menos3m','3-6m','6-12m','1-3a','mais3a'],
  parado:['menos1m','1-3m','3-6m','6-12m','mais1a'],
  continuo:['menos5','5-10','10-20','20-30','30-60','mais60'],
  sono:['menos6','6-7','7mais'],
};
function motorNivelMin(a, b){ return MOTOR_NIVEIS[Math.min(MOTOR_NIVEIS.indexOf(a), MOTOR_NIVEIS.indexOf(b))]; }
function motorClamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
// Lê o primeiro caminho preenchido do perfil (o motor aceita o caminho do Questionário V2 e o do esquema anterior).
function motorGet(p, ...caminhos){
  for(const c of caminhos){
    const raw = athleteGetPath(p, c);
    if(raw===undefined || raw===null) continue;
    const v = valorDe(raw);
    if(ehDado(raw) && (raw.naoSei===true || v==='naoSei')) return { v:null, naoSei:true };
    if(v!==null && v!==undefined && v!=='' && !(Array.isArray(v) && !v.length)) return { v, naoSei:false };
  }
  return { v:null, naoSei:false };
}
function motorFaixaIdx(tipo, v){
  if(v===null || v===undefined) return null;
  if(typeof v==='number'){
    if(tipo==='experiencia') return v<3?0 : v<6?1 : v<12?2 : v<36?3 : 4;      // meses
    if(tipo==='parado') return v<4.3?0 : v<13?1 : v<26?2 : v<52?3 : 4;        // semanas
    return null;
  }
  const i = MOTOR_FAIXAS[tipo].indexOf(String(v));
  return i>=0 ? i : null;
}
function motorSituacao(v){
  if(v===null || v===undefined) return null;
  const s = normalizeNoAccents(String(v)).replace(/[^a-z]+/g,'_');
  if(/^(regular|regularmente|ativo)/.test(s)) return 'regular';
  if(/ocasional|as_vezes|de_vez|vez_em_quando/.test(s)) return 'ocasional';
  if(/parado|parei|ja_/.test(s)) return 'parado';
  if(/^nunca/.test(s)) return 'nunca';
  return null;
}
function motorRegiao(r){
  const s = normalizeNoAccents(String(r||''));
  if(/joelho/.test(s)) return 'joelho';
  if(/tornozelo/.test(s)) return 'tornozelo';
  if(/quadril/.test(s)) return 'quadril';
  if(/canela|\bpe\b|fascite|calcanhar/.test(s)) return 'pe';
  if(/lombar|costas|coluna/.test(s)) return 'lombar';
  if(/ombro/.test(s)) return 'ombro';
  if(/punho|cotovelo|mao/.test(s)) return 'punho';
  return 'outra';
}
const MOTOR_REGIAO_MEMBRO_INFERIOR = ['joelho','tornozelo','quadril','pe'];
const MOTOR_BLOQUEIO_REGIAO = {
  joelho:   /agachamento|leg press|hack|extensora|afundo|passada|step up|bulgaro|salto|wall sit/,
  tornozelo:/panturrilha|salto|escalador|corda|step up|passada/,
  quadril:  /afundo|passada|step up|bulgaro|elevacao de quadril|abdutora|adutora|stiff|terra/,
  pe:       /panturrilha|salto|escalador|passada/,
  lombar:   /terra|stiff|bom dia|good morning|remada curvada|remada cavalinho|hiperextens|superman/,
  ombro:    /desenvolvimento|arnold|elevacao lateral|elevacao frontal|remada alta|pike|mergulho|crucifixo inverso|atras da nuca/,
  punho:    /flexao|mergulho|rosca de punho|pike|escalador/,
};
// Padrão de movimento (o mesmo vocabulário das respostas de "movimentos que faz com segurança").
function motorPadraoChave(n){
  if(/unilateral|afundo|passada|step up|bulgaro/.test(n)) return 'unilateral';
  if(/agachamento|leg press|hack|goblet/.test(n)) return 'agachar';
  if(/stiff|terra|bom dia|elevacao de quadril|ponte de gluteo/.test(n)) return 'dobradica';
  if(/barra fixa|puxada|pulldown|pullover/.test(n)) return 'puxarV';
  if(/remada/.test(n)) return 'puxarH';
  if(/desenvolvimento|arnold|pike|elevacao lateral|elevacao frontal/.test(n)) return 'empurrarV';
  if(/supino|flexao|crucifixo|peck deck|voador|mergulho|crossover/.test(n)) return 'empurrarH';
  return null;
}

/* ---------- ETAPA 0/1: estado atual ---------- */
function motorLerDor(p){
  const lista = motorGet(p, 'restricoesTreino.dorAtual', 'estadoAtual.limitacoesAtivas').v || [];
  return (Array.isArray(lista) ? lista : []).map(d=>{
    const it = (d && typeof d==='object') ? d : { regiao:d };
    const intens = normalizeNoAccents(String(valorDe(it.intensidade) || 'moderada'));
    return { regiao:motorRegiao(valorDe(it.regiao)), regiaoOriginal:valorDe(it.regiao), intensidade: /forte/.test(intens) ? 'forte' : /leve/.test(intens) ? 'leve' : 'moderada', emRepouso: valorDe(it.emRepouso)===true };
  });
}
function motorLerCautela(p, dor){
  const estado = motorGet(p, 'sinaisDeAlerta.cautela.estado').v || 'nenhum';
  const itens = ((motorGet(p, 'sinaisDeAlerta.itens').v) || []).map(i=>typeof i==='string' ? i : (i && i.codigo)).filter(Boolean);
  if(dor.some(d=>d.intensidade==='forte' || d.emRepouso)) itens.push('dor_forte_ou_em_repouso');
  const temAlerta = itens.length>0;
  let modo = 'normal', bloqueado = false, motivo = null;
  if(estado==='seguir_por_conta_propria') modo = 'conservador';
  else if(temAlerta){
    if(estado==='em_andamento'){ bloqueado = true; motivo = 'avaliacao_em_andamento'; }
    else if(estado==='liberado' || estado==='liberado_com_restricoes') modo = 'liberado';
    else { bloqueado = true; motivo = 'cautela_pendente'; }
  }
  return { estado, itens, temAlerta, bloqueado, motivo, modo };
}
function motorLerRestricoes(p, dor, cautela){
  const r = { dor, regioes:[...new Set(dor.map(d=>d.regiao))], corridaSemQualidade:false, volumeCorridaFator:1, regexBloqueio:[], evitarNomes:new Set(), semImpacto:false, motivos:[] };
  dor.forEach(d=>{
    const reg = d.regiao;
    if(MOTOR_BLOQUEIO_REGIAO[reg]) r.regexBloqueio.push(MOTOR_BLOQUEIO_REGIAO[reg]);
    r.corridaSemQualidade = true;                                    // qualquer região com dor: sem sessão de qualidade
    if(MOTOR_REGIAO_MEMBRO_INFERIOR.includes(reg)){
      if(d.intensidade!=='leve') r.volumeCorridaFator = Math.min(r.volumeCorridaFator, MOTOR_PARAMS.reducaoDorModerada);
      if(d.intensidade==='forte') r.volumeCorridaFator = Math.min(r.volumeCorridaFator, 0.6);
    }else if(reg==='lombar' && d.intensidade!=='leve') r.volumeCorridaFator = Math.min(r.volumeCorridaFator, 0.9);
    r.motivos.push('dor_'+reg+'_'+d.intensidade);
  });
  const orient = motorGet(p, 'restricoesTreino.vindasDeOrientacao').v || [];
  (Array.isArray(orient) ? orient : []).forEach(o=>{
    const s = normalizeNoAccents(String((o && (o.descricao||o.codigo)) || o || ''));
    if(/impacto/.test(s)){ r.semImpacto = true; r.corridaSemQualidade = true; r.volumeCorridaFator = Math.min(r.volumeCorridaFator, 0.7); r.regexBloqueio.push(/salto|escalador|corda|pular|burpee/); r.motivos.push('orientacao_impacto'); }
    if(/esforco|intens/.test(s)){ r.corridaSemQualidade = true; r.motivos.push('orientacao_esforco'); }
    if(/acima da cabeca|cabeca/.test(s)){ r.regexBloqueio.push(/desenvolvimento|arnold|pike|remada alta/); r.motivos.push('orientacao_sem_overhead'); }
  });
  const ev = motorGet(p, 'restricoesTreino.evitarExercicios').v || [];
  (Array.isArray(ev) ? ev : []).forEach(n=>r.evitarNomes.add(n));
  if(cautela.modo==='conservador') r.corridaSemQualidade = true;
  r.temDorRelevante = dor.some(d=>d.intensidade!=='leve') || r.semImpacto;
  return r;
}
function motorLerEquipamentos(p){
  const itensObj = motorGet(p, 'equipamentos.itens').v;
  const local = motorGet(p, 'equipamentos.local').v;
  const material = motorGet(p, 'equipamentos.material').v;
  let set = null, fonte = 'desconhecido';
  if(itensObj && typeof itensObj==='object' && !Array.isArray(itensObj) && Object.keys(itensObj).length && local!=='casa'){
    set = new Set(Object.keys(itensObj).filter(k=>itensObj[k]===true)); fonte = 'itens';
  }else if(local==='academia'){ set = new Set(EQUIP_PERFIS.academia.itens); fonte = 'local'; }
  else if(local==='condominio'){ set = new Set(EQUIP_PERFIS.condominio.itens); fonte = 'local'; }
  else if(local==='casa'){
    const h = itensObj && typeof itensObj==='object' ? itensObj.halteres : null;
    set = new Set(h===true ? ['halteres'] : []); fonte = 'local'; // casa: só o que foi dito; nada além de halteres/peso do corpo é assumido
  }else if(material==='academia'){ set = new Set(EQUIP_PERFIS.academia.itens); fonte = 'material'; }
  else if(material==='halteres'){ set = new Set(['halteres']); fonte = 'material'; }
  if(!set) set = new Set();
  set.add('corpo');
  return { set, local:local||null, fonte };
}
function motorVdot(p, nivel, conservador, hoje, log){
  if(!conservador){
    const ud = athleteGetPath(p, 'estadoAtual.corrida.ultimoDesempenho');
    if(ud && typeof ud==='object'){
      const dataStr = valorDe(ud.data);
      const vdRaw = ud.vdot;
      let vdot = athleteNumero(valorDe(vdRaw));
      if(vdot===null){
        const dist = valorDe(ud.distKey) || (valorDe(ud.distanciaKm)!=null ? String(Math.round(athleteNumero(valorDe(ud.distanciaKm))*1000)) : null);
        let seg = athleteNumero(valorDe(ud.tempoSeg));
        if(seg===null && valorDe(ud.tempo)) seg = parseClockInput(String(valorDe(ud.tempo)));
        if(dist && seg && VDOT_TEST_COEF[dist]) vdot = vdotFromTest(dist, seg);
      }
      if(vdot!==null && vdot>15 && vdot<85){
        let refData = dataStr || (ehDado(vdRaw) && vdRaw.origem!=='migrado' ? vdRaw.atualizadoEm : null);
        const dias = refData ? (hoje - new Date(refData))/86400000 : null;
        if(dias!==null && dias>=0 && dias<=MOTOR_PARAMS.validadeDesempenhoDias){
          log.push({ etapa:1, regra:'vdot_do_desempenho', motivo:'desempenho recente válido', dados:{ vdot, dias:Math.round(dias) } });
          return { vdot, fonte:'desempenho' };
        }
        log.push({ etapa:1, regra:'vdot_ignorado', motivo:'desempenho sem data válida ou fora dos últimos 3 meses', dados:{ vdot } });
      }
    }
  }
  const padrao = MOTOR_PARAMS.vdotPadrao[nivel];
  log.push({ etapa:1, regra:'vdot_padrao', motivo:'sem desempenho válido: padrão do nível', dados:{ nivel, vdot:padrao } });
  return { vdot:padrao, fonte:'padrao' };
}

// Regra de nível fechada: situação atual > carga recente > histórico. Sem score.
function motorNivelCorrida(c){
  const idx = n=>MOTOR_NIVEIS.indexOf(n);
  const expN = c.expIdx===null ? null : (c.expIdx===0 ? 'iniciante' : c.expIdx<=2 ? 'intermediario' : 'avancado');
  if(c.situacao==='nunca') return { nivel:'iniciante', motivo:'nunca correu' };
  if(c.situacao==='ocasional') return { nivel:'iniciante', motivo:'corre de vez em quando' };
  if(c.situacao==='parado'){
    if(c.paradoIdx===null || c.paradoIdx>=3) return { nivel:'iniciante', motivo:'parado há 6 meses ou mais (ou tempo desconhecido)' };
    const teto = c.paradoIdx===0 ? 'avancado' : 'intermediario';
    return { nivel:motorNivelMin(expN || 'iniciante', teto), motivo:'parado; histórico limitado pelo tempo parado' };
  }
  const eixos = [];
  if(c.freq!==null) eixos.push(c.freq<=2 ? 'iniciante' : c.freq<=4 ? 'intermediario' : 'avancado');
  if(c.maiorKm!==null) eixos.push(c.maiorKm<=5 ? 'iniciante' : c.maiorKm<=12 ? 'intermediario' : 'avancado');
  else if(c.maiorMinDecl!==null) eixos.push(c.maiorMinDecl<=30 ? 'iniciante' : c.maiorMinDecl<=75 ? 'intermediario' : 'avancado');
  if(c.continuoIdx!==null) eixos.push(c.continuoIdx<=2 ? 'iniciante' : c.continuoIdx<=4 ? 'intermediario' : 'avancado');
  if(!eixos.length) return { nivel:'iniciante', motivo:'sem dados de carga (conservador)' };
  let base = eixos.reduce((a,b)=>motorNivelMin(a,b));
  if(expN) base = motorNivelMin(base, expN);
  return { nivel:base, motivo:'carga recente limitada pelo histórico' };
}
function motorNivelMusc(m){
  const expN = m.expIdx===null ? null : (m.expIdx===0 ? 'iniciante' : m.expIdx<=2 ? 'intermediario' : 'avancado');
  const nMov = m.padroes.size;
  const movN = m.padroesInformados ? (nMov<=2 ? 'iniciante' : nMov<=5 ? 'intermediario' : 'avancado') : null;
  let hist = null;
  if(expN && movN) hist = motorNivelMin(expN, movN); else hist = expN || movN;
  if(m.situacao==='nunca') return { nivel:'iniciante', motivo:'nunca treinou' };
  if(m.situacao==='ocasional') return { nivel:'iniciante', motivo:'treina às vezes' };
  if(m.situacao==='parado'){
    if(m.paradoIdx===null || m.paradoIdx>=3) return { nivel:'iniciante', motivo:'parado há 6 meses ou mais (ou tempo desconhecido)' };
    const teto = m.paradoIdx===0 ? 'avancado' : 'intermediario';
    return { nivel:motorNivelMin(hist || 'iniciante', teto), motivo:'parado; histórico limitado pelo tempo parado' };
  }
  const carga = m.freq===null ? null : (m.freq<=2 ? 'iniciante' : m.freq<=4 ? 'intermediario' : 'avancado');
  if(!carga && !hist) return { nivel:'iniciante', motivo:'sem dados (conservador)' };
  const base = carga && hist ? motorNivelMin(carga, hist) : (carga || hist);
  return { nivel:base, motivo:'frequência limitada pelo histórico' };
}

function lerEstado(perfil, opcoes){
  opcoes = opcoes || {};
  const hoje = opcoes.hoje ? new Date(opcoes.hoje) : new Date();
  const log = [];
  const L = (regra, motivo, dados)=>log.push({ etapa:1, regra, motivo, dados });
  const P = MOTOR_PARAMS;
  const dor = motorLerDor(perfil);
  const cautela = motorLerCautela(perfil, dor);
  if(cautela.temAlerta) L('cautela', 'sinal de alerta presente', { estado:cautela.estado, modo:cautela.modo, bloqueado:cautela.bloqueado, itens:cautela.itens });
  const restricoes = motorLerRestricoes(perfil, dor, cautela);
  const conservador = cautela.modo==='conservador';
  let naoSeiCount = 0, nsC = 0, nsM = 0; const naoSei = (x, mod)=>{ if(x.naoSei){ naoSeiCount++; if(mod==='c') nsC++; if(mod==='m') nsM++; } return x; };

  // objetivo
  const tipo = motorGet(perfil, 'objetivos.principal.tipo').v;
  const dist = athleteNumero(motorGet(perfil, 'objetivos.distanciaAlvoKm', 'objetivos.prova.distanciaKm').v);
  const goal = (dist!==null && HYBRID_WEEKLY_KM[dist]) ? dist : 5;   // 5 km = fallback técnico do gerador legado (invisível)
  const dataProva = motorGet(perfil, 'objetivos.prova.data').v;
  let semanasAteProva = null;
  if(tipo==='prova' && dataProva){ const d = new Date(dataProva+'T00:00:00'); if(!isNaN(d)) semanasAteProva = Math.floor((d - hoje)/(7*86400000)); }
  const objetivo = { tipo:tipo || null, distanciaKm:goal, distanciaInformada:dist!==null, dataProva:dataProva||null, semanasAteProva };

  // corrida
  const cSit = motorSituacao(motorGet(perfil, 'estadoAtual.corrida.situacao').v);
  const cFreqR = naoSei(motorGet(perfil, 'estadoAtual.corrida.carga.declarada.frequenciaSemana', 'estadoAtual.corrida.cargaRecente.frequenciaSemana'), 'c');
  const cMaiorKmR = motorGet(perfil, 'estadoAtual.corrida.carga.declarada.maiorSessaoRecenteKm', 'estadoAtual.corrida.cargaRecente.maiorSessaoRecenteKm');
  const cMaiorMinR = motorGet(perfil, 'estadoAtual.corrida.carga.declarada.maiorSessaoRecenteMin');
  const cMaiorNaoSei = cMaiorKmR.naoSei || cMaiorMinR.naoSei;
  const cContR = motorGet(perfil, 'estadoAtual.corrida.corridaContinuaFaixa');
  const cExpR = motorGet(perfil, 'historico.corrida.experienciaFaixa', 'historico.corrida.experienciaMeses');
  const cParR = motorGet(perfil, 'estadoAtual.corrida.semanasSemTreinoFaixa', 'estadoAtual.corrida.semanasSemTreino');
  const minObserv = athleteNumero(motorGet(perfil, 'estadoAtual.corrida.carga.observada.minutosSemana').v);
  const sessTipDecl = athleteNumero(motorGet(perfil, 'estadoAtual.corrida.carga.declarada.duracaoTipicaMin').v);
  const corr = {
    situacao: cSit, freq: athleteNumero(cFreqR.v), maiorKm: athleteNumero(cMaiorKmR.v), maiorMinDecl: athleteNumero(cMaiorMinR.v),
    continuoIdx: motorFaixaIdx('continuo', cContR.v), expIdx: motorFaixaIdx('experiencia', cExpR.v), paradoIdx: motorFaixaIdx('parado', cParR.v),
    minutosObservados: minObserv, sessaoTipicaDecl: sessTipDecl,
  };
  if(cSit==='parado' && cParR.naoSei) L('naoSei', 'tempo parado desconhecido: faixa mais conservadora', { modalidade:'corrida' });
  // musculação
  const mSit = motorSituacao(motorGet(perfil, 'estadoAtual.musculacao.situacao').v);
  const mFreqR = naoSei(motorGet(perfil, 'estadoAtual.musculacao.carga.declarada.frequenciaSemana', 'estadoAtual.musculacao.cargaRecente.frequenciaSemana'), 'm');
  const mExpR = motorGet(perfil, 'historico.musculacao.experienciaFaixa', 'historico.musculacao.experienciaMeses');
  const mParR = motorGet(perfil, 'estadoAtual.musculacao.semanasSemTreinoFaixa', 'estadoAtual.musculacao.semanasSemTreino');
  const padR = motorGet(perfil, 'historico.musculacao.padroesDominados');
  const padList = Array.isArray(padR.v) ? padR.v.filter(x=>x && x!=='nenhum') : [];
  const musc = {
    situacao: mSit, freq: athleteNumero(mFreqR.v), expIdx: motorFaixaIdx('experiencia', mExpR.v), paradoIdx: motorFaixaIdx('parado', mParR.v),
    padroes: new Set(padList), padroesInformados: Array.isArray(padR.v),
  };
  if(cExpR.naoSei){ naoSeiCount++; nsC++; }
  if(mExpR.naoSei){ naoSeiCount++; nsM++; }
  if(cContR.naoSei){ naoSeiCount++; nsC++; }
  if(cMaiorNaoSei){ naoSeiCount++; nsC++; }

  // níveis (regra fechada) — modo conservador ("seguir por conta própria") força iniciante
  const nC = conservador ? { nivel:'iniciante', motivo:'modo conservador (seguir por conta própria)' } : motorNivelCorrida(corr);
  const nM = conservador ? { nivel:'iniciante', motivo:'modo conservador (seguir por conta própria)' } : motorNivelMusc(musc);
  L('nivel_corrida', nC.motivo, { nivel:nC.nivel, situacao:cSit }); L('nivel_musculacao', nM.motivo, { nivel:nM.nivel, situacao:mSit });
  const capacidade = { corrida:nC.nivel, musc:nM.nivel };

  // VDOT e ritmos
  const vd = motorVdot(perfil, capacidade.corrida, conservador, hoje, log);
  const paces = computeVdotPaces(vd.vdot);
  const minPorKm = paces.Es*1440;
  corr.maiorMin = corr.maiorMinDecl!==null ? corr.maiorMinDecl : (corr.maiorKm!==null ? corr.maiorKm*minPorKm : null);
  corr.vdot = vd.vdot; corr.vdotFonte = vd.fonte; corr.paces = paces;

  // histórico de corrida (só acelera a reconstrução)
  corr.histNivel = corr.expIdx===null ? 'iniciante' : (corr.expIdx===0 ? 'iniciante' : corr.expIdx<=2 ? 'intermediario' : 'avancado');
  const fatorD = P.fatorDistancia[String(goal)] || 1;
  corr.fatorDistancia = fatorD;

  // regime (contínuo ou run/walk)
  const cont = corr.continuoIdx===null ? null : [2.5,7.5,15,25,45,75][corr.continuoIdx];
  const refMin = Math.max(cont||0, (corr.situacao==='regular' || corr.situacao==='ocasional') ? (corr.maiorMin||0) : 0);
  let regime = 'continuo', runWalk = null;
  if(corr.situacao==='nunca' || refMin<20){
    regime = 'run_walk';
    let t=1, w=2;
    if(corr.situacao==='parado'){ t = corr.histNivel==='iniciante' ? 2 : 3; w = 1; }
    else if(cont!==null){ if(cont>=10){ t=3; w=1; } else if(cont>=5){ t=2; w=1; } }
    else if(corr.maiorMin){ if(corr.maiorMin>=15){ t=3; w=1; } else if(corr.maiorMin>=10){ t=2; w=1; } }
    runWalk = { t, w };
  }
  if(restricoes.semImpacto && regime==='continuo'){ regime = 'run_walk'; runWalk = { t: capacidade.corrida==='iniciante' ? 2 : 3, w:1 }; L('impacto_limitado', 'orientação de limitar impacto: run/walk, sem qualidade e volume reduzido', {}); }
  corr.regime = regime; corr.runWalk = runWalk;

  // recuperação (perfil habitual): sono <6 h = recuperação reduzida (não é bloqueio); desconhecido = normal com menos confiança
  const sonoR = motorGet(perfil, 'recuperacaoHabitual.sono', 'estadoAtual.recuperacao.sono');
  const sonoIdx = motorFaixaIdx('sono', sonoR.v);
  const recuperacao = { sonoIdx, prontidao: sonoIdx===0 ? 'reduzida' : 'normal', confianca: (sonoIdx===null) ? 'baixa' : 'media' };
  if(recuperacao.prontidao==='reduzida') L('sono_reduzido', 'sono <6 h: recuperação reduzida (sem progressão, menos volume e sem sessões duras em excesso)', {});
  if(sonoIdx===null) L('sono_desconhecido', 'sono desconhecido: prontidão normal com confiança menor', {});

  // carga inicial de corrida (o que provavelmente se sustenta AGORA; nunca um salto sobre o declarado)
  const V = MOTOR_PARAMS;
  const vref = V.volumeRef[capacidade.corrida]*fatorD;
  const sessPad = V.sessaoPadrao[capacidade.corrida];
  let v0, fonte, incerteza = 0;
  if(corr.situacao==='nunca'){ v0 = 2*V.sessaoPadrao.iniciante; fonte='nunca_corri'; }
  else if(corr.situacao==='parado'){
    const vHist = V.volumeRef[corr.histNivel]*fatorD;
    const frac = V.fracaoRetomada[corr.paradoIdx===null ? 4 : corr.paradoIdx];
    v0 = Math.min(vHist*frac, vref); fonte='retomada';
    corr.volumeHistorico = vHist;
  }else{
    const freq = corr.freq!==null ? corr.freq : 2;
    if(corr.freq===null) incerteza++;
    if(corr.minutosObservados){ v0 = corr.minutosObservados; fonte='minutos_observados'; }
    else if(corr.sessaoTipicaDecl && corr.freq!==null){ v0 = freq*corr.sessaoTipicaDecl*0.9; fonte='sessao_tipica_declarada'; }
    else if(corr.maiorMin && corr.freq!==null){
      const sessEst = Math.min(V.fracaoSessaoTipica*corr.maiorMin, V.tetoSessaoTipica*sessPad);
      v0 = freq*Math.max(sessEst, V.minSessaoCorrida); fonte='freq_x_maior_conservador';
    }else if(corr.maiorMin){ v0 = 2*Math.min(sessPad, corr.maiorMin); fonte='so_maior_sessao'; incerteza++; }
    else if(corr.freq!==null){ v0 = freq*sessPad; fonte='so_frequencia'; incerteza++; }
    else { v0 = 2*sessPad*0.85; fonte='sem_dados'; incerteza+=2; }
    if(corr.situacao==='ocasional') v0 = Math.min(v0, V.volumeRef.iniciante*fatorD);
    if(incerteza>=2) v0 *= 0.85; else if(incerteza===1) v0 *= 0.9;
    v0 = Math.min(v0, vref);
  }
  let fatorVol = restricoes.volumeCorridaFator * (recuperacao.prontidao==='reduzida' ? V.reducaoSonoReduzido : 1);
  v0 = Math.max(2*V.minSessaoCorrida*0.9, v0*fatorVol);
  corr.carga = { min:Math.round(v0), fonte, incerteza, fatorVolume:fatorVol, volumeRef:Math.round(vref) };
  L('carga_inicial_corrida', 'carga que provavelmente se sustenta agora', corr.carga);
  // teto da corrida longa: nunca acima da maior corrida recente (sem salto), do teto do nível nem de nada que a carga não sustente
  const tetoL = V.tetoLongo[capacidade.corrida] + (goal>=21 ? V.tetoLongoDistancia : 0);
  corr.tetoLonga = corr.maiorMin ? Math.min(tetoL, Math.max(corr.maiorMin, V.minSessaoCorrida)) : tetoL;
  // contexto dos construtores de sessão (reuso de hbMontarSessao/hbSessao*)
  const goalKey = String(goal);
  corr.goalKey = goalKey;
  corr.ctx = {
    nivel:capacidade.corrida, ini:regime==='run_walk', goalKey, paces, kmFactor:1, weekNumber:1,
    easyPace:`${daysToPaceStr(paces.Ef)} ~ ${daysToPaceStr(paces.Es)}/km`,
    warmMin:(HYBRID_WARMUP_MIN[goalKey] || HYBRID_WARMUP_MIN[10])[capacidade.corrida] || 10,
    runWalk,
  };

  // disponibilidade
  let dias = DAY_ABBR.map((d, idx)=>{
    const x = (perfil.disponibilidade && perfil.disponibilidade.dias && perfil.disponibilidade.dias[d]) || {};
    const rest = valorDe(x.restricao);
    const disp = valorDe(x.disponivel)===true && rest!=='descanso' && rest!=='bloqueado';
    const m = athleteNumero(valorDe(x.minutos));
    return { dia:d, idx, disponivel:disp, minutos: m!==null ? m : P.diaSemInfo, minConhecido: m!==null, pref: valorDe(x.preferencia)||null };
  });
  let semInfoDias = false;
  if(!dias.some(d=>d.disponivel)){
    semInfoDias = true;
    ['Seg','Qua','Sex'].forEach(nm=>{ const d = dias.find(x=>x.dia===nm); d.disponivel = true; });
    L('sem_disponibilidade', 'nenhum dia informado: 3 dias alternados com o tempo padrão', {});
  }
  const combPref = motorGet(perfil, 'disponibilidade.combinacao.preferencia').v || 'indiferente';
  const longaPref = motorGet(perfil, 'disponibilidade.diaLongaoPreferido').v || null;
  const modPref = motorGet(perfil, 'objetivos.modalidadePrioritaria').v || null;

  // calibração e confiança
  const motivosCal = [];
  let calC = false, calM = false;
  if(['nunca','parado','ocasional'].includes(cSit)){ motivosCal.push('corrida_'+cSit); calC = true; }
  if(['nunca','parado','ocasional'].includes(mSit)){ motivosCal.push('musculacao_'+mSit); calM = true; }
  if(!cSit){ motivosCal.push('situacao_corrida_desconhecida'); calC = true; }
  if(!mSit){ motivosCal.push('situacao_musculacao_desconhecida'); calM = true; }
  if(corr.carga.incerteza>=1 && cSit==='regular'){ motivosCal.push('carga_de_corrida_incerta'); calC = true; }
  if(nsC>=1){ motivosCal.push('dados_de_corrida_desconhecidos'); calC = true; }
  if(nsM>=1){ motivosCal.push('dados_de_musculacao_desconhecidos'); calM = true; }
  if(conservador){ motivosCal.push('seguir_por_conta_propria'); calC = true; calM = true; }
  const calibracao = { ativa: calC || calM, corrida:calC, musc:calM, motivos: motivosCal };
  let confianca = 'alta';
  if(calibracao.ativa) confianca = 'media';
  if(naoSeiCount>=2 || conservador || (!cSit && !mSit) || corr.carga.incerteza>=2) confianca = 'baixa';
  if(recuperacao.confianca==='baixa' && confianca==='alta') confianca = 'media';

  const alertas = [];
  if(calibracao.ativa) alertas.push('calibracao');
  if(recuperacao.prontidao==='reduzida') alertas.push('sono_reduzido');
  restricoes.motivos.forEach(m=>alertas.push('restricao:'+m));
  if(conservador) alertas.push('cautela_conservador');
  if(semInfoDias) alertas.push('sem_disponibilidade_informada');
  return {
    hoje, log, cautela, objetivo, capacidade, corrida:corr, musc, restricoes, equip:motorLerEquipamentos(perfil),
    recuperacao, calibracao, confianca, alertas,
    disp:{ dias, combPref, longaPref, modPref },
    conservador,
  };
}

/* ---------- ETAPA 2: prioridade ---------- */
function definirPrioridade(est){
  const tipo = est.objetivo.tipo;
  let prio = 'equilibrado', motivo = 'objetivo sem modalidade dominante';
  if(tipo==='prova' || tipo==='desempenho_corrida'){ prio = 'corrida'; motivo = 'objetivo de corrida'; }
  else if(tipo==='massa' || tipo==='forca'){ prio = 'musculacao'; motivo = 'objetivo de musculação'; }
  let principal = prio==='equilibrado' ? null : prio;
  if(prio==='equilibrado'){
    // desempate: prioridade informada (Camada 2) → menor frequência recente → corrida
    const mp = est.disp.modPref;
    if(mp==='corrida' || mp==='musculacao'){ principal = mp; motivo += '; desempate pela prioridade informada'; }
    else{
      const fc = (est.corrida.situacao==='regular' || est.corrida.situacao==='ocasional') ? (est.corrida.freq || 0) : 0;
      const fm = (est.musc.situacao==='regular' || est.musc.situacao==='ocasional') ? (est.musc.freq || 0) : 0;
      principal = fm<fc ? 'musculacao' : 'corrida';
      motivo += '; desempate pela menor frequência recente';
    }
  }
  const secundaria = principal==='corrida' ? 'musculacao' : 'corrida';
  const folga = !est.calibracao[secundaria==='corrida' ? 'corrida' : 'musc'] && est.recuperacao.prontidao==='normal' && !est.restricoes.temDorRelevante && !est.conservador;
  est.log.push({ etapa:2, regra:'prioridade', motivo, dados:{ tipo:prio, principal, folgaSecundaria:folga } });
  return { tipo:prio, principal, secundaria, folga, motivo };
}

/* ---------- ETAPA 3: frequência (sessões x dias x combinadas) ---------- */
function motorProibeDobro(est){
  if(est.conservador) return 'modo conservador';
  const nunca = est.corrida.situacao==='nunca' || est.musc.situacao==='nunca';
  if(est.calibracao.ativa && nunca && est.capacidade.corrida==='iniciante' && est.capacidade.musc==='iniciante') return 'calibração de iniciante absoluto';
  return null;
}
function definirFrequencias(est, prio, ajustes){
  ajustes = ajustes || {};
  const P = MOTOR_PARAMS, cap = est.capacidade, log = est.log;
  const progressoes = [];
  const tetoC = P.tetoFreqCorrida[cap.corrida], tetoM = P.tetoFreqMusc[cap.musc];
  const podeProgredirBase = est.recuperacao.prontidao==='normal' && !est.restricoes.temDorRelevante && !est.conservador && !ajustes.semProgressao && prio.tipo!=='equilibrado';
  const desejo = (mod)=>{
    const s = mod==='corrida' ? est.corrida.situacao : est.musc.situacao;
    const freq = est.corrida && mod==='corrida' ? est.corrida.freq : est.musc.freq;
    const teto = mod==='corrida' ? tetoC : tetoM;
    const principal = prio.principal===mod;
    let base;
    if(s==='nunca') base = 2;
    else if(s==='parado') base = principal ? 3 : 2;
    else if(s==='ocasional') base = freq!==null ? Math.max(freq,1) : 2;
    else if(s==='regular') base = freq!==null ? freq : 2;
    else base = 2;
    let alvo = Math.min(base, teto);
    if(base>teto) log.push({ etapa:3, regra:'teto_por_nivel', motivo:'frequência declarada acima do teto do nível', dados:{ modalidade:mod, declarada:base, teto } });
    if(principal && s==='regular' && freq!==null && alvo<teto && podeProgredirBase && !est.calibracao[mod==='corrida' ? 'corrida' : 'musc'] && alvo===Math.min(freq,teto)){
      progressoes.push({ tipo:'frequencia', modalidade:mod, de:alvo, para:alvo+1, justificativa:'modalidade principal, sem calibração, prontidão normal, sem dor e abaixo do teto do nível' });
      alvo += 1;
    }
    return alvo;
  };
  let nc = desejo('corrida'), nm = desejo('musc');
  // a corrida não comporta mais sessões do que a carga sustenta (cada uma precisa ser executável)
  const ncMax = Math.max(1, Math.floor(est.corrida.carga.min/P.minSessaoCorrida));
  if(nc>ncMax){ log.push({ etapa:3, regra:'sessoes_x_volume', motivo:'carga não sustenta mais sessões executáveis', dados:{ desejadas:nc, max:ncMax } }); nc = ncMax; }
  let capPrev = null;
  const diasMusc = est.disp.dias.filter(d=>d.disponivel && d.minutos>=P.minSlotMusc).length;
  const diasCorr = est.disp.dias.filter(d=>d.disponivel && d.minutos>=P.minSlotCorrida).length;
  const semDiaViavel = [];
  if(diasMusc===0 && nm>0){ nm = 0; semDiaViavel.push('musculacao'); }
  if(diasCorr===0 && nc>0){ nc = 0; semDiaViavel.push('corrida'); }
  semDiaViavel.forEach(md=>log.push({ etapa:3, regra:'sem_dia_com_tempo_minimo', motivo:'nenhum dia disponível comporta o mínimo dessa modalidade', dados:{ modalidade:md } }));
  const desC = nc, desM = nm;

  // vagas: DIAS de treino ≠ SESSÕES
  const dias = est.disp.dias.filter(d=>d.disponivel);
  const uteis = dias.filter(d=>d.minutos>=P.minSlotCorrida);
  const livresMin = (cap.corrida==='iniciante' || cap.musc==='iniciante') ? 2 : 1;
  const maxDias = Math.max(1, Math.min(uteis.length, 7-livresMin));
  const proibicao = ajustes.semDobros ? 'ajuste da validação' : motorProibeDobro(est);
  const elegiveisDobro = uteis.filter(d=>d.minutos>=P.minDobro && d.minConhecido).length;
  const maxDobros = proibicao ? 0 : Math.min(elegiveisDobro, maxDias);
  const nivelMax = MOTOR_NIVEIS[Math.max(MOTOR_NIVEIS.indexOf(cap.corrida), MOTOR_NIVEIS.indexOf(cap.musc))];
  let tetoTotal = Math.min(tetoC + tetoM, P.tetoSessoes[nivelMax]);
  if(est.recuperacao.prontidao==='reduzida') tetoTotal -= 1;
  const capacidadeSessoes = Math.min(maxDias + maxDobros, tetoTotal);
  const dobrosNecessarios = Math.max(0, Math.min(nc+nm, capacidadeSessoes) - maxDias);

  const foraDaSemana = [];
  if(progressoes.length && (nc+nm) > capacidadeSessoes - (ajustes.reduzir || 0)){
    progressoes.forEach(g=>{ if(g.modalidade==='corrida') nc -= 1; else nm -= 1; });
    log.push({ etapa:3, regra:'progressao_descartada', motivo:'sem espaço: a progressão é opcional e não desloca a frequência declarada da outra modalidade', dados:{ progressoes:progressoes.length } });
    progressoes.length = 0;
  }
  let total = nc+nm;
  let reducaoExtra = ajustes.reduzir || 0;
  const capEfetiva = capacidadeSessoes - reducaoExtra;
  if(total > capEfetiva){
    const P0 = prio.principal, S0 = prio.secundaria;
    const desP = P0==='corrida' ? nc : nm, desS = P0==='corrida' ? nm : nc;
    const cp = Math.max(1, capEfetiva);
    // Prioridade definida: a principal mantém a frequência desejada primeiro e a outra fica com o que sobrar (registrado como fora da semana/alternância).
    // Equilibrado: divide (a secundária sempre tem pelo menos 1 quando há 2+ vagas).
    let pisoS = prio.tipo==='equilibrado' ? Math.min(desS, cp>=3 ? 1 : (cp===2 ? 1 : 0)) : 0;
    if(desP===0) pisoS = Math.min(desS, cp);            // a principal não tem sessão possível: a outra modalidade ocupa o espaço
    const pF = Math.max(0, Math.min(desP, cp - pisoS));
    const sF = Math.max(0, Math.min(desS, cp - pF));
    if(P0==='corrida'){ nc = pF; nm = sF; } else { nm = pF; nc = sF; }
    log.push({ etapa:3, regra:'preserva_frequencia_por_prioridade', motivo:'mais sessões desejadas que espaço (dias + combinações seguras)', dados:{ desejadas:{ corrida:desC, musc:desM }, final:{ corrida:nc, musc:nm }, capacidadeSessoes:capEfetiva, principal:P0 } });
  }
  if(nc===0) foraDaSemana.push('corrida');
  if(nm===0) foraDaSemana.push('musculacao');
  foraDaSemana.forEach(m=>log.push({ etapa:3, regra:'modalidade_fora_da_semana', motivo:'sem espaço nesta semana: alternar/adaptar na seguinte', dados:{ modalidade:m } }));
  // progressões só valem se a frequência final ainda as contém
  const prog = progressoes.filter(g=>(g.modalidade==='corrida' ? nc : nm) >= g.para);
  const dobrosMin = Math.max(0, (nc+nm) - Math.min(maxDias, nc+nm));
  // combinar por preferência (sem necessidade): só sem calibração e com espaço; a distribuição decide se compensa
  const combinarPreferido = !proibicao && !est.calibracao.ativa && est.disp.combPref==='combinar_preferencial';
  const dobrosPermitidos = proibicao ? 0 : Math.min(elegiveisDobro, Math.min(nc, nm), combinarPreferido ? nc+nm : dobrosMin);
  log.push({ etapa:3, regra:'frequencia', motivo:'sessões, dias e combinações decididos', dados:{ sessoes:{ corrida:nc, musc:nm }, diasUteis:uteis.length, maxDiasTreino:maxDias, dobrosMin, dobrosPermitidos, dobroProibido:proibicao } });
  return { corrida:nc, musc:nm, desejadas:{ corrida:desC, musc:desM }, maxDias, diasLivresMin:livresMin, dobrosMin, dobrosPermitidos, dobroProibido:proibicao, capacidadeSessoes:capEfetiva, foraDaSemana, progressoes:prog };
}

/* ---------- descritores de sessão (o que cada sessão é, antes de escolher o conteúdo) ---------- */
function motorQualidadePermitida(est, ajustes){
  if(ajustes && ajustes.semQualidade) return false;
  if(est.capacidade.corrida==='iniciante') return false;
  if(est.corrida.situacao!=='regular') return false;
  if(est.calibracao.corrida || est.conservador) return false;
  if(est.recuperacao.prontidao!=='normal') return false;
  if(est.restricoes.corridaSemQualidade) return false;
  if(est.corrida.regime!=='continuo') return false;
  return true;
}
function motorSessoesCorrida(est, nc, ajustes){
  if(nc<=0) return [];
  const P = MOTOR_PARAMS, c = est.corrida;
  const V0 = c.carga.min * (ajustes.volumeFator || 1);
  const qual = nc>=3 && motorQualidadePermitida(est, ajustes);
  const janelaMax = Math.max(...est.disp.dias.filter(d=>d.disponivel && d.minutos>=P.minSlotCorrida).map(d=>d.minutos), P.minSlotCorrida);
  const capLonga = Math.min(c.tetoLonga, janelaMax, c.regime==='run_walk' ? P.tetoRunWalk : Infinity);
  const out = [];
  if(nc===1){
    out.push({ mod:'corrida', tipo:'rodagem', dura:false, durMin:Math.round(motorClamp(V0, P.minSessaoCorrida, capLonga)) });
    return out;
  }
  const nLeves = nc - 1 - (qual ? 1 : 0);
  const Q = qual ? Math.min(50, janelaMax, Math.max(35, V0*0.28)) : 0;
  let longa = Math.min(V0*P.shareLonga[Math.min(nc,5)], capLonga);
  let leve = (V0 - longa - Q)/nLeves;
  leve = motorClamp(leve, P.minSessaoCorrida, Math.max(P.minSessaoCorrida, Math.min(60, janelaMax, longa*0.9)));
  if(longa < leve*1.15) longa = Math.min(capLonga, Math.round(leve*1.25));
  const longaDura = est.capacidade.corrida!=='iniciante' || longa>=60;
  if(qual) out.push({ mod:'corrida', tipo:'qualidade', dura:true, durMin:Math.round(Q) });
  out.push({ mod:'corrida', tipo:'longa', dura:longaDura, durMin:Math.round(longa) });
  for(let i=0;i<nLeves;i++) out.push({ mod:'corrida', tipo:'leve', dura:false, durMin:Math.round(leve) });
  return out;
}
function motorQtdExercicios(est, foco){
  const nivel = est.capacidade.musc;
  let q = HB_MUSC_QTD[nivel] || 6;
  if(foco==='manutencao') q = Math.min(q, 4);
  if(foco==='suporte_corrida') q = Math.min(q, 4);
  return q;
}
function motorSessoesMusc(est, prio, nm, ajustes, nDurasCorrida){
  if(nm<=0) return [];
  const nivel = est.capacidade.musc;
  let formas;
  if(nivel==='iniciante') formas = Array(nm).fill('full');
  else formas = ({ 1:['full'], 2:['full','full'], 3:['upper','lower','full'], 4:['upper','lower','upper','lower'] })[Math.min(nm,4)];
  if(est.recuperacao.prontidao==='reduzida' || ajustes.aliviarInferior){
    // sessões duras em excesso: converte inferior em corpo inteiro
    let duras = nDurasCorrida;
    formas = formas.map(f=>{ if(f==='lower'){ if(duras>=2 || ajustes.aliviarInferior){ return 'full'; } duras++; } return f; });
  }
  const principalMusc = prio.principal==='musculacao';
  const focoBase = principalMusc ? (est.objetivo.tipo==='forca' ? 'forca' : 'hipertrofia')
    : (prio.tipo==='corrida' ? (nivel==='iniciante' ? 'hipertrofia' : 'suporte_corrida') : 'hipertrofia');
  const foco = (!principalMusc && !prio.folga && nivel!=='iniciante' && focoBase!=='suporte_corrida') ? 'manutencao' : focoBase;
  return formas.map(f=>({
    mod:'musc', tipo:f, foco, dura:f==='lower',
    durMin:Math.round(motorQtdExercicios(est, foco)*MOTOR_PARAMS.minutosPorExercicio + MOTOR_PARAMS.aquecimentoMusc),
  }));
}

/* ---------- ETAPA 4: distribuição ---------- */
function motorCodigoCorrida(s){ return s.tipo==='longa' ? 'RUN_LONG_RUN' : s.tipo==='qualidade' ? (s.qualidadeKind==='limiar' ? 'RUN_TEMPO_THRESHOLD' : 'RUN_INTERVALS_VO2MAX') : 'RUN_EASY_Z2'; }
function motorCodigoMusc(s, aliviar){ return s.tipo==='lower' && !aliviar ? 'LEG_DAY_HEAVY' : s.tipo==='upper' ? 'UPPER_BODY' : 'FULL_BODY_LIGHT'; }
function distribuirSessoes(est, prio, freq, ajustes){
  const P = MOTOR_PARAMS;
  const dias = est.disp.dias.filter(d=>d.disponivel && d.minutos>=Math.min(P.minSlotCorrida, P.minSlotMusc));
  const runs = motorSessoesCorrida(est, freq.corrida, ajustes);
  const goal = est.objetivo.distanciaKm;
  runs.forEach(s=>{ if(s.tipo==='qualidade') s.qualidadeKind = goal<=10 ? 'intervalado' : 'limiar'; });
  const nDurasCorrida = runs.filter(s=>s.dura).length;
  const muscs = motorSessoesMusc(est, prio, freq.musc, ajustes, nDurasCorrida);
  const nLower = muscs.filter(s=>s.tipo==='lower').length;
  const ordemPrio = (a, b)=>{ const rank = s=>s.tipo==='qualidade'?0 : s.tipo==='longa'?1 : s.tipo==='rodagem'?1 : s.tipo==='lower'?2 : s.tipo==='leve'?3 : 4; return rank(a)-rank(b); };
  const todas = [...runs, ...muscs].sort(ordemPrio);
  const idxPorDia = {}; dias.forEach(d=>{ idxPorDia[d.dia] = d; });
  const runWalk = est.corrida.regime==='run_walk';
  let melhor = null, avaliadas = 0;
  const runAt = {}, muscAt = {};
  let nDobros = 0;
  const custoLeaf = ()=>{
    const runCode = {}, muscCode = {};
    let usados = 0;
    dias.forEach(d=>{ if(runAt[d.dia]) runCode[d.dia] = motorCodigoCorrida(runAt[d.dia]); if(muscAt[d.dia]) muscCode[d.dia] = motorCodigoMusc(muscAt[d.dia], ajustes.aliviarInferior); if(runAt[d.dia]||muscAt[d.dia]) usados++; });
    if(7 - usados < Math.min(freq.diasLivresMin, 7 - 1) && dias.length>usados) return null;
    let cost = hybridScheduleCost(runCode, muscCode, nLower, 400);
    const ordem = DAY_ABBR; const nx = d=>ordem[(ordem.indexOf(d)+1)%7];
    // dias seguidos de treino, corrida run/walk em dias seguidos, folga da longa, preferências
    let seguidos = 0;
    ordem.forEach(d=>{
      const tem = !!(runAt[d]||muscAt[d]), temN = !!(runAt[nx(d)]||muscAt[nx(d)]);
      if(tem && temN){ cost += 2; seguidos++; }
      const sD = (runAt[d] && runAt[d].dura) || (muscAt[d] && muscAt[d].dura);
      const sN = (runAt[nx(d)] && runAt[nx(d)].dura) || (muscAt[nx(d)] && muscAt[nx(d)].dura);
      if(sD && sN) cost += 40;
      const muscD = muscAt[d], muscN = muscAt[nx(d)];
      const runD = runAt[d], runN = runAt[nx(d)];
      // Para iniciante, recuperação mínima é regra de segurança — não apenas preferência estética.
      if(est.capacidade.musc==='iniciante' && muscD && muscN) cost += 10000;
      if(est.capacidade.musc==='iniciante' && ((runD && runD.tipo==='longa' && muscN) || (muscD && runN && runN.tipo==='longa'))) cost += 10000;
    });
    dias.forEach(d=>{
      const r = runAt[d.dia], m = muscAt[d.dia];
      if(r && (r.tipo==='longa' || r.tipo==='rodagem')){
        cost += 15*Math.min(1, r.durMin/d.minutos);
        if(est.disp.longaPref===d.dia) cost -= 8;
        else if(!est.disp.longaPref && r.tipo==='longa' && (d.dia==='Sáb' || d.dia==='Dom')) cost -= 6;
      }
      if(r && r.tipo==='qualidade') cost += 6*Math.min(1, r.durMin/d.minutos);
      const pr = prio.principal==='corrida' ? r : m;
      if(pr) cost += 2*(1 - d.minutos/Math.max(...dias.map(x=>x.minutos)));
      if(d.pref && ((d.pref==='corrida' && !r && m) || (d.pref==='musculacao' && !m && r))) cost += 3;
      const necessario = (r?r.durMin:0)+(m?m.durMin:0);
      if(necessario > d.minutos) cost += 20*(necessario/d.minutos - 1);   // sessão encolhe para caber: custo proporcional
      if(r && m){
        if(r.dura) cost += (m.tipo==='full' ? 30 : 10);
        const extra = nDobros > freq.dobrosMin;
        if(extra) cost += est.disp.combPref==='combinar_preferencial' ? -6 : 25;
        if(est.disp.combPref==='separar' && !extra) cost += 4;
      }
    });
    return cost;
  };
  const recurse = (i)=>{
    if(i===todas.length){
      avaliadas++;
      const c = custoLeaf();
      if(c!==null && (!melhor || c < melhor.custo)) melhor = { custo:c, runAt:{...runAt}, muscAt:{...muscAt}, dobros:nDobros };
      return;
    }
    const s = todas[i];
    const prev = i>0 ? todas[i-1] : null;
    const iguais = prev && prev.mod===s.mod && prev.tipo===s.tipo && prev.durMin===s.durMin;
    const lastIdx = iguais ? Math.max(...dias.map((d,k)=> (s.mod==='corrida' ? runAt : muscAt)[d.dia]===prev ? k : -1)) : -1;
    const alvo = s.mod==='corrida' ? runAt : muscAt, outro = s.mod==='corrida' ? muscAt : runAt;
    for(let k=0;k<dias.length;k++){
      if(iguais && k<=lastIdx) continue;
      const d = dias[k];
      if(alvo[d.dia]) continue;
      const min = d.minutos;
      const ocup = outro[d.dia];
      if(ocup){
        if(freq.dobrosPermitidos<=nDobros) continue;
        if(min<P.minDobro || !d.minConhecido) continue;
        if(s.dura && ocup.dura) continue;
        if(s.tipo==='lower' || ocup.tipo==='lower') continue;
        // regra do usuário: no dia do longão, musculação só de superiores (ou nada)
        if((s.tipo==='longa' && ocup.mod==='musc' && ocup.tipo!=='upper') || (ocup.tipo==='longa' && s.mod==='musc' && s.tipo!=='upper')) continue;
      }else{
        const hosp = s.mod==='corrida' ? P.minSlotCorrida : P.minSlotMusc;
        if(min<hosp) continue;
      }
      if(runWalk && s.mod==='corrida'){ const ord = DAY_ABBR; const i0 = ord.indexOf(d.dia); if(runAt[ord[(i0+1)%7]] || runAt[ord[(i0+6)%7]]) continue; }
      alvo[d.dia] = s; if(ocup) nDobros++;
      recurse(i+1);
      delete alvo[d.dia]; if(ocup) nDobros--;
    }
  };
  recurse(0);
  const res = { runs, muscs, todas, dias, melhor, avaliadas, nLower };
  if(melhor){
    const alto = melhor.custo>=5000;
    est.log.push({ etapa:4, regra:'distribuicao', motivo:'menor custo entre as atribuições válidas (fadiga, espaçamento, janela, combinação)', dados:{ custo:Math.round(melhor.custo), avaliadas, dobros:melhor.dobros, conflito:alto } });
  }
  return res;
}

/* ---------- ETAPA 5: construção das sessões ---------- */
// Equipamento que o exercício exige: heurística por nome (a de sempre) + o campo "equipamento" do catálogo quando existe (o mais restritivo vale).
function motorNecessario(nome){
  const base = equipNecessario(nome).filter(x=>x!=='corpo');
  const it = exercicioPorNome(nome);
  const extra = [];
  if(it && it.cat){
    const eq = it.cat.equipamento, n = normalizeNoAccents(nome);
    if(eq==='Smith') extra.push('smith');
    else if(eq==='Polia') extra.push('cabos');
    else if(eq==='Máquina') extra.push(/leg press|hack/.test(n) ? 'legpress' : /extensora|flexora|adutora|abdutora|cadeira/.test(n) ? 'extensora' : 'maquinas');
    else if(eq==='Trenó') extra.push('legpress');
    else if(eq==='Barra' || eq==='Barra W') extra.push('barra');
    else if(eq==='Halteres' || eq==='Kettlebell' || eq==='Peso adicional') extra.push('halteres');
  }
  if(/cavalinho|t-bar/.test(normalizeNoAccents(nome))) extra.push('maquinas');
  return [...new Set([...base, ...extra])];
}
function motorFiltroExercicio(est){
  const P = new Map();
  Object.keys(POOL).forEach(b=>Object.keys(POOL[b]).forEach(g=>POOL[b][g].forEach(e=>{ if(!P.has(e.nome)) P.set(e.nome, e); })));
  const eq = est.equip.set, r = est.restricoes, dom = est.musc.padroes;
  return (nome)=>{
    if(r.evitarNomes.has(nome)) return false;
    const n = normalizeNoAccents(nome);
    if(r.regexBloqueio.some(re=>re.test(n))) return false;
    const need = motorNecessario(nome);
    if(!need.every(id=>id==='corpo' || eq.has(id))) return false;
    const e = P.get(nome) || { nome, nivel:'intermediario' };
    const tier = exercicioTier(e), key = motorPadraoChave(n);
    const livre = need.includes('barra') || need.includes('halteres') || /barra|halter|kettlebell/.test(n);
    if(key && !dom.has(key) && (tier>=3 || (tier>=2 && livre))) return false;   // padrão não dominado: só o que é guiado (máquina/Smith/cabo) ou peso do corpo
    return true;
  };
}
function motorPoolMotor(){
  const pool = {};
  const vistos = new Set();
  Object.keys(POOL).forEach(b=>Object.keys(POOL[b]).forEach(g=>{ (pool[g] = pool[g] || []); POOL[b][g].forEach(e=>{ if(!vistos.has(e.nome)){ vistos.add(e.nome); pool[g].push(e); } }); }));
  return pool;
}
// Família do exercício (padrão de movimento ou grupo funcional): no máximo um por família em cada sessão.
function motorFamilia(n){
  const fam = [[/flexora/,'flexora'],[/extensora/,'extensora'],[/panturrilha/,'panturrilha'],[/prancha|abdominal|crunch|escalador|elevacao de pernas|russian/,'core'],[/rosca/,'rosca'],[/triceps|mergulho/,'triceps'],
    [/elevacao lateral|elevacao frontal/,'elevacao'],[/adutora|abdutora/,'quadril_lat'],[/hiperextens|superman/,'lombar'],[/ponte|elevacao de quadril/,'ponte'],[/wall sit|cadeira \(/,'isometria']];
  const f = fam.find(([re])=>re.test(n));
  return f ? f[1] : padraoMovimento(n);
}
// Completa a sessão até a quantidade do estímulo quando os "slots" clássicos não acharam exercício (equipamento/restrições/padrões).
// Nunca passa da quantidade do estímulo: sobrar tempo NÃO adiciona exercício.
function motorCompletar(sel, sessao, qtd, filtro, pool, nivel){
  const extras = [];
  if(sel.length>=qtd) return extras;
  const usados = new Set(sel.map(x=>x.e.nome));
  const familias = new Set(sel.map(x=>motorFamilia(normalizeNoAccents(x.e.nome))));
  const maxTier = nivel==='avancado' ? 3 : 2;
  const gruposPorForma = { lower:['Pernas','Costas'], upper:['Peito','Costas','Ombro','Braço'], full:['Pernas','Peito','Costas','Ombro','Core','Braço'] };
  const grupos = gruposPorForma[sessao.tipo] || gruposPorForma.full;
  const okGrupo = (g, n)=>{
    if(sessao.tipo==='lower' && g==='Costas') return /dobradica/.test(String(motorPadraoChave(n))) || /hiperextens|ponte|elevacao de quadril|stiff/.test(n);
    if(sessao.tipo==='upper' && g==='Costas') return !/hiperextens|ponte|terra|stiff|bom dia|elevacao de quadril/.test(n);
    return true;
  };
  let rot = 0, guard = 0;
  while(sel.length+extras.length<qtd && guard++<30){
    let escolhido = null;
    for(let k=0;k<grupos.length && !escolhido;k++){
      const g = grupos[(rot+k)%grupos.length];
      const ehCore = g==='Core';
      if(ehCore && sel.length+extras.length < qtd-1 && sessao.tipo==='full') continue;   // core por último no corpo inteiro
      const cands = (pool[g]||[]).filter(e=>{
        const n = normalizeNoAccents(e.nome);
        return !usados.has(e.nome) && filtro(e.nome) && okGrupo(g, n) && exercicioTier(e)<=maxTier && !familias.has(motorFamilia(n));
      });
      const comp = cands.filter(e=>isExercicioComposto(e.nome)!==false);
      const pick = (sel.length+extras.length < qtd-1 && comp.length) ? comp[0] : (cands[0] || comp[0]);
      if(pick){ escolhido = { e:pick, papel: isExercicioComposto(pick.nome)===false || ehCore ? 'isolado' : 'auxiliar', grupo:g }; }
    }
    if(!escolhido) break;
    extras.push(escolhido); usados.add(escolhido.e.nome); familias.add(motorFamilia(normalizeNoAccents(escolhido.e.nome)));
    rot++;
  }
  return extras;
}
function motorEsquema(nivel, papel, foco, retomada, calibracao){
  const base = (HYBRID_PAPEL_SCHEME[papel] && (HYBRID_PAPEL_SCHEME[papel][nivel] || HYBRID_PAPEL_SCHEME[papel].intermediario)) || HYBRID_PAPEL_SCHEME.auxiliar.intermediario;
  let { series, reps, rpe, descanso } = base;
  if(foco==='forca'){
    if(papel==='base'){ series = nivel==='iniciante' ? 3 : 5; reps = 5; rpe = 8; descanso = '120s'; }
    else if(papel==='auxiliar'){ series = 3; reps = 8; rpe = 7; descanso = '90s'; }
    else { series = 2; reps = 10; rpe = 6; descanso = '60s'; }
  }
  if(foco==='manutencao'){ series = Math.min(series, 3); reps = Math.max(reps, 8); rpe = Math.min(rpe, 7); }
  if(foco==='suporte_corrida'){ series = Math.min(series, 3); rpe = Math.min(rpe, 7); }
  if(retomada){ series = Math.max(2, series-1); rpe = Math.min(rpe, 6); }
  if(calibracao) rpe = Math.min(rpe, 7);
  return { series, reps, rpe, descanso };
}
// Estímulo primeiro (forma + foco); depois exercícios válidos; depois volume; depois encaixe no tempo.
function motorMontarMusc(est, sessao, limiteMin, weekTaken, pool, filtro, contexto){
  const nivel = est.capacidade.musc;
  const opts = {};
  opts.qtd = motorQtdExercicios(est, sessao.foco);
  if(sessao.foco==='suporte_corrida' && sessao.tipo==='full') opts.slots = ['joelho','quadril','unilateral','core'];
  opts.semPadraoRepetido = true;
  let sel = buildHybridMuscSession(sessao.tipo==='lower' ? 'leg' : sessao.tipo, nivel, pool, weekTaken, filtro, opts);
  sel = sel.concat(motorCompletar(sel, sessao, opts.qtd, filtro, pool, nivel));
  sel.forEach(x=>weekTaken.add(x.e.nome));
  if(!sel.length) return { lista:[], duracao:0, cortes:[], vazio:true };
  const retomada = est.musc.situacao==='parado' && (est.musc.paradoIdx===null || est.musc.paradoIdx>=1);
  let lista = sel.map(({ e, papel, grupo })=>{
    const sch = motorEsquema(nivel, papel, sessao.foco, retomada, est.calibracao.ativa);
    return { nome:e.nome, series:String(sch.series), reps:String(sch.reps), carga:'', grupo, repdbId:e.id, descanso:sch.descanso, modo:'hibrido', papel, tier:exercicioTier(e), rpe:sch.rpe,
      sessao: sessao.tipo==='lower' ? 'LEG_DAY_HEAVY' : sessao.tipo==='full' ? 'FULL_BODY_LIGHT' : 'UPPER_BODY', estimulo:{ forma:sessao.tipo, foco:sessao.foco },
      orientacaoCarga:'Sem carga definida: escolha uma carga em que sobrem 2–3 repetições.' };
  });
  // fadiga da corrida: inferior perto de corrida dura perde um isolador (nunca ganha exercício por sobrar tempo)
  if(contexto && contexto.inferiorPertoDeCorridaDura){
    const i = lista.map(x=>x.papel).lastIndexOf('isolado');
    if(i>=0 && lista.length>3) lista.splice(i,1);
  }
  const cortes = [];
  const dur = l=>estimateWorkoutMinutes(l) + MOTOR_PARAMS.aquecimentoMusc;
  let guard = 0;
  while(dur(lista) > limiteMin && guard++<30){
    const iIso = lista.map(x=>x.papel).lastIndexOf('isolado');
    if(iIso>=0 && lista.length>2){ cortes.push('remove_isolador:'+lista[iIso].nome); lista.splice(iIso,1); continue; }
    const aux = lista.filter(x=>x.papel==='auxiliar' && parseInt(x.series,10)>2);
    if(aux.length){ const a = aux[aux.length-1]; a.series = String(parseInt(a.series,10)-1); cortes.push('reduz_series:'+a.nome); continue; }
    const iAux = lista.map(x=>x.papel).lastIndexOf('auxiliar');
    if(iAux>=0 && lista.length>2){ cortes.push('remove_acessorio:'+lista[iAux].nome); lista.splice(iAux,1); continue; }
    const base = lista.find(x=>x.papel==='base' && parseInt(x.series,10)>3);
    if(base){ base.series = String(parseInt(base.series,10)-1); cortes.push('reduz_series:'+base.nome); continue; }
    break;
  }
  return { lista, duracao:dur(lista), cortes, vazio:false };
}
function motorMontarCorrida(est, sessao, limiteMin){
  const ctx = est.corrida.ctx;
  const alvo = Math.max(MOTOR_PARAMS.minSessaoCorrida, Math.min(sessao.durMin, limiteMin));
  let s = null, tipoFinal = sessao.tipo;
  if(sessao.tipo==='qualidade'){
    const longKm = kmFromMinAtPace(Math.max(...[sessao.durMin, 60]), ctx.paces.Es);
    const tent = sessao.qualidadeKind==='limiar' ? hbQualidadeTempo(ctx, longKm) : hbQualidadeIntervalo(ctx, longKm);
    if(tent.totalMin <= limiteMin) s = tent; else tipoFinal = 'leve';
  }
  if(!s){
    const build = km=>(tipoFinal==='longa' ? hbSessaoLongo(ctx, km) : hbSessaoLeve(ctx, km));
    let km = Math.max(1, kmFromMinAtPace(alvo, ctx.paces.Es));
    s = build(km);
    for(let i=0;i<6;i++){
      const t = s.totalMin;
      if(Math.abs(t-alvo)<=2 && t<=limiteMin) break;
      const fator = motorClamp(alvo/Math.max(1,t), 0.6, 1.5);
      const km2 = Math.max(0.8, km*fator);
      if(Math.abs(km2-km)<0.05) break;
      km = km2; s = build(km);
    }
    let g = 0;
    while(s.totalMin>limiteMin && g++<8){ km = Math.max(0.8, km*0.92); s = build(km); }
  }
  return { sessao:s, tipoFinal };
}
function montarSessoes(est, prio, freq, dist, ajustes){
  const dias = dist.dias, melhor = dist.melhor;
  const semana = { corridaWeek:[], muscPlan:{}, sessoes:[], descartadas:[], legEasingNotes:[], cortes:[] };
  if(!melhor) return semana;
  const pool = motorPoolMotor(), filtro = motorFiltroExercicio(est), weekTaken = new Set();
  const idxDia = d=>DAY_ABBR.indexOf(d);
  const runDiasDuros = DAY_ABBR.filter(d=>melhor.runAt[d] && melhor.runAt[d].dura);
  const dist2 = (a,b)=>{ const x = Math.abs(idxDia(a)-idxDia(b)); return Math.min(x, 7-x); };
  DAY_ABBR.forEach(d=>{
    const r = melhor.runAt[d], m = melhor.muscAt[d];
    if(!r && !m) return;
    const dia = dist.dias.find(x=>x.dia===d);
    const minutos = dia ? dia.minutos : MOTOR_PARAMS.diaSemInfo;
    const combinada = !!(r && m);
    let rRes = null, mRes = null;
    if(r){
      const reservaMusc = m ? Math.max(25, Math.min(m.durMin, minutos - MOTOR_PARAMS.minSessaoCorrida)) : 0;
      const limite = combinada ? Math.max(MOTOR_PARAMS.minSessaoCorrida, Math.min(r.durMin, minutos - reservaMusc)) : minutos;
      rRes = motorMontarCorrida(est, r, limite);
    }
    if(m){
      const usadoRun = rRes ? rRes.sessao.totalMin : 0;
      const limite = minutos - usadoRun;
      const perto = m.tipo==='lower' && runDiasDuros.some(x=>dist2(x,d)<=2);
      mRes = motorMontarMusc(est, m, limite, weekTaken, pool, filtro, { inferiorPertoDeCorridaDura:perto });
    }
    if(r && rRes){
      const s = rRes.sessao;
      s.duracaoMin = s.totalMin; s.combinada = combinada ? { ordem: (prio.principal==='musculacao' ? 'musculacao_antes' : 'corrida_antes') } : null;
      s.estimulo = { tipo:rRes.tipoFinal, dura:r.dura };
      semana.corridaWeek.push({ day:d, ...s });
      semana.sessoes.push({ dia:d, modalidade:'corrida', tipo:rRes.tipoFinal, duracaoMin:s.totalMin, combinada:combinada, dura:r.dura, km:s.totalKm });
    }
    if(m && mRes && !mRes.vazio){
      const ordem = combinada ? (prio.principal==='musculacao' ? 'musculacao_antes' : 'corrida_antes') : null;
      mRes.lista.forEach(e=>{ e.combinada = ordem ? { ordem } : null; });
      semana.muscPlan[d] = mRes.lista.map(e=>({ id:Date.now().toString(36)+Math.random().toString(36).slice(2,6), done:false, ...e }));
      semana.sessoes.push({ dia:d, modalidade:'musculacao', tipo:m.tipo, foco:m.foco, duracaoMin:mRes.duracao, combinada, dura:m.dura, exercicios:mRes.lista.length });
      if(mRes.cortes.length) semana.cortes.push({ dia:d, cortes:mRes.cortes });
    }else if(m){
      semana.descartadas.push({ dia:d, modalidade:'musculacao', motivo:'nenhum exercício válido para equipamento/restrições' });
    }
  });
  return semana;
}

/* ---------- ETAPA 6: validação ---------- */
function validarPlano(est, prio, freq, dist, semana, ajustes){
  const P = MOTOR_PARAMS, erros = [], avisos = [];
  const E = (cod, detalhe)=>erros.push({ cod, detalhe });
  const A = (cod, detalhe)=>avisos.push({ cod, detalhe });
  const filtro = motorFiltroExercicio(est);
  const porDia = {};
  semana.sessoes.forEach(s=>{ (porDia[s.dia] = porDia[s.dia] || []).push(s); });
  // V1 segurança / restrições
  Object.keys(semana.muscPlan).forEach(d=>semana.muscPlan[d].forEach(e=>{ if(!filtro(e.nome)) E('V1', `exercício não permitido: ${e.nome}`); }));
  semana.corridaWeek.forEach(w=>{ if((w.type==='Intervalado' || w.type==='Limiar' || w.type==='Fartlek Leve') && !motorQualidadePermitida(est, ajustes)) E('V1', `intensidade não permitida: ${w.type}`); });
  // V2 duração de cada sessão / V3 duração de dobros
  Object.keys(porDia).forEach(d=>{
    const dia = dist.dias.find(x=>x.dia===d); const min = dia ? dia.minutos : P.diaSemInfo;
    const lista = porDia[d]; const soma = lista.reduce((t,s)=>t+s.duracaoMin, 0);
    if(soma > min+0.5){ E(lista.length>1 ? 'V3' : 'V2', `${d}: ${soma} min > ${min} min disponíveis`); }
    if(lista.length>1 && (est.conservador || freq.dobroProibido)) E('V3', `${d}: combinação não permitida (${freq.dobroProibido||'modo conservador'})`);
    if(lista.length>1 && lista.filter(x=>x.dura).length>1) E('V3', `${d}: duas sessões duras no mesmo dia`);
    if(lista.length>1 && lista.some(s=>s.tipo==='lower')) E('V3', `${d}: inferior pesado combinado com corrida`);
    if(lista.some(s=>s.tipo==='longa') && lista.some(s=>s.modalidade==='musculacao' && s.tipo!=='upper')) E('V3', `${d}: longão com musculação de pernas no mesmo dia`);
  });
  // V4 volume semanal
  const runMin = semana.corridaWeek.reduce((t,w)=>t+w.totalMin, 0);
  const v0 = est.corrida.carga.min * (ajustes.volumeFator || 1);
  if(semana.corridaWeek.length){
    const limiteVol = Math.max(v0*(1+P.toleranciaVolume)+2, semana.corridaWeek.length*24);
    if(runMin > limiteVol) E('V4', `volume de corrida ${runMin} min acima de ${Math.round(limiteVol)}`);
    const longa = Math.max(...semana.corridaWeek.map(w=>w.totalMin));
    if(est.corrida.maiorMin && longa > Math.max(est.corrida.maiorMin*(1+P.toleranciaVolume)+3, 25) && est.corrida.situacao!=='parado') E('V4', `sessão de ${longa} min acima da maior corrida recente (${Math.round(est.corrida.maiorMin)} min)`);
    if(runMin < v0*(1-P.toleranciaVolume)-5) A('V4', `volume de corrida ${runMin} min abaixo do de partida (${Math.round(v0)} min): limite de disponibilidade/sessões`);
  }
  // V5 frequência
  const nRun = semana.corridaWeek.length, nMusc = Object.keys(semana.muscPlan).length;
  if(nRun > P.tetoFreqCorrida[est.capacidade.corrida]) E('V5', `corrida ${nRun}x acima do teto do nível`);
  if(nMusc > P.tetoFreqMusc[est.capacidade.musc]) E('V5', `musculação ${nMusc}x acima do teto do nível`);
  // V6 recuperação
  const diasUsados = Object.keys(porDia).length;
  const livres = 7 - diasUsados;
  const minLivres = Math.min(freq.diasLivresMin, Math.max(1, 7 - est.disp.dias.filter(d=>d.disponivel && d.minutos>=P.minSlotCorrida).length));
  if(livres < 1) E('V6', 'nenhum dia livre');
  else if(livres < freq.diasLivresMin && est.disp.dias.filter(d=>d.disponivel).length > 7-freq.diasLivresMin) E('V6', `menos de ${freq.diasLivresMin} dias livres para nível iniciante`);
  const duras = semana.sessoes.filter(s=>s.dura).length;
  if(est.recuperacao.prontidao==='reduzida' && duras>2) E('V6', `${duras} sessões duras com recuperação reduzida`);
  if(est.recuperacao.prontidao==='reduzida' && semana.corridaWeek.some(w=>w.type==='Intervalado' || w.type==='Limiar')) E('V6', 'qualidade com recuperação reduzida');
  // V7 equipamentos
  Object.keys(semana.muscPlan).forEach(d=>semana.muscPlan[d].forEach(e=>{
    const need = motorNecessario(e.nome);
    if(!need.every(id=>id==='corpo' || est.equip.set.has(id))) E('V7', `equipamento indisponível para ${e.nome}: ${need.join(',')}`);
  }));
  // V8 coerência com o objetivo (só aviso)
  const nP = prio.principal==='corrida' ? nRun : nMusc, nS = prio.principal==='corrida' ? nMusc : nRun;
  if(prio.tipo!=='equilibrado' && nP < nS) A('V8', 'a modalidade principal ficou com menos sessões que a secundária');
  if(prio.tipo!=='equilibrado' && nP===0) A('V8', 'a modalidade principal ficou fora da semana');
  // V9 distribuição
  if(dist.melhor && dist.melhor.custo>=5000) E('V9', `conflito de estímulos na distribuição (custo ${Math.round(dist.melhor.custo)})`);
  const nx = d=>DAY_ABBR[(DAY_ABBR.indexOf(d)+1)%7];
  const sessaoEm = (d,mod)=>semana.sessoes.find(s=>s.dia===d && (!mod || s.modalidade===mod));
  DAY_ABBR.forEach(d=>{
    const atualM = sessaoEm(d,'musculacao'), proxM = sessaoEm(nx(d),'musculacao');
    const atualR = sessaoEm(d,'corrida'), proxR = sessaoEm(nx(d),'corrida');
    if(est.capacidade.musc==='iniciante' && atualM && proxM) E('V9', `${d}/${nx(d)}: musculação em dias consecutivos para iniciante`);
    if(est.capacidade.musc==='iniciante' && ((atualR && atualR.tipo==='longa' && proxM) || (atualM && proxR && proxR.tipo==='longa'))){
      E('V9', `${d}/${nx(d)}: longão adjacente à musculação para iniciante`);
    }
    const durasD = semana.sessoes.filter(s=>s.dia===d && (s.dura || s.tipo==='longa')).length;
    const durasN = semana.sessoes.filter(s=>s.dia===nx(d) && (s.dura || s.tipo==='longa')).length;
    if(durasD && durasN) E('V9', `${d}/${nx(d)}: estímulos altos em dias consecutivos`);
  });
  if(est.corrida.regime==='run_walk'){
    const d = DAY_ABBR; semana.corridaWeek.forEach(w=>{ const nx = d[(d.indexOf(w.day)+1)%7]; if(semana.corridaWeek.some(x=>x.day===nx)) E('V9', 'run/walk em dias seguidos'); });
  }
  // V10 nenhuma progressão sem justificativa
  freq.progressoes.forEach(g=>{
    if(!g.justificativa) E('V10', 'progressão sem justificativa');
    if(est.calibracao[g.modalidade==='corrida' ? 'corrida' : 'musc'] || est.recuperacao.prontidao!=='normal' || est.restricoes.temDorRelevante || est.conservador || prio.tipo==='equilibrado') E('V10', 'progressão em situação que não a permite');
  });
  if(semana.corridaWeek.length && runMin > Math.max(v0*(1+P.toleranciaVolume)+2, semana.corridaWeek.length*24)) E('V10', 'aumento de volume sem justificativa');
  return { ok:erros.length===0, erros, avisos };
}

/* ---------- orquestração ---------- */
function motorConstruir(est, prio, ajustes){
  // Se as sessões desejadas não têm distribuição válida (dias/minutos/estímulos), reduz sessões e tenta de novo — nunca entrega semana vazia por isso.
  let aj = ajustes, freq, dist;
  for(let k=0;k<10;k++){
    freq = definirFrequencias(est, prio, aj);
    dist = distribuirSessoes(est, prio, freq, aj);
    if(dist.melhor || (freq.corrida+freq.musc)===0) break;
    est.log.push({ etapa:4, regra:'reducao_por_inviabilidade', motivo:'nenhuma distribuição válida para as sessões desejadas: reduz uma sessão', dados:{ sessoes:{ corrida:freq.corrida, musc:freq.musc } } });
    aj = { ...aj, reduzir:(aj.reduzir||0)+1 };
  }
  ajustes.reduzir = aj.reduzir;
  const semana = montarSessoes(est, prio, freq, dist, aj);
  return { freq, dist, semana };
}
function motorAjustar(ajustes, erros){
  const a = { ...ajustes };
  const cods = new Set(erros.map(e=>e.cod));
  if(cods.has('V1')) a.semQualidade = true;
  if(cods.has('V3')) a.semDobros = true;
  if(cods.has('V4')) a.volumeFator = (a.volumeFator||1)*0.9;
  if(cods.has('V6') || cods.has('V9')){ if(!a.aliviarInferior) a.aliviarInferior = true; else if(!a.semQualidade) a.semQualidade = true; else a.reduzir = (a.reduzir||0)+1; }
  if(cods.has('V10')) a.semProgressao = true;
  if(cods.has('V2') || cods.has('V5') || cods.has('V7')) a.reduzir = (a.reduzir||0)+1;
  return a;
}
function motorDescricaoBloqueio(est){
  const c = est.cautela;
  return { engineVersion:MOTOR_ENGINE_VERSION, status: c.motivo==='avaliacao_em_andamento' ? 'avaliacao_em_andamento' : 'cautela_pendente', bloqueado:true, motivo:c.motivo, cautela:c, decisoes:est.log, validacao:{ ok:false, bloqueada:true, motivo:c.motivo, erros:[], avisos:[] }, semana:null };
}
function motorSemanasDoPlano(est){
  const s = est.objetivo.semanasAteProva;
  if(s===null || s===undefined || s<0) return 8;
  if(s>=16) return 16; if(s>=12) return 12; return 8;
}
function motorTrajetoria(est, prio, semana, totalWeeks, foraDaSemana){
  const c = est.corrida, P = MOTOR_PARAMS;
  const goal = est.objetivo.distanciaKm;
  const teto = c.situacao==='parado' ? (c.volumeHistorico || c.carga.volumeRef) : c.carga.volumeRef*1.0;
  const acel = (c.situacao==='parado' && c.histNivel!=='iniciante') ? 1.5 : 1;
  const taperN = est.objetivo.semanasAteProva!==null ? (VDOT_TAPER_WEEKS_BY_GOAL[goal] || 1) : 0;
  let v = c.carga.min; const out = [];
  for(let w=1; w<=totalWeeks; w++){
    const pos = ((w-1)%4)+1;
    let fase = est.calibracao.ativa && w<=2 ? 'Retomada / calibração' : (pos===4 ? 'Descarga' : (w<=4 ? 'Base' : 'Construção'));
    let vol;
    if(w===1) vol = v;
    else if(est.calibracao.ativa && w===2) vol = v;
    else if(pos===4) vol = v*0.75;
    else { v = Math.min(v*(1+P.passoSemanal*acel), Math.max(teto, v)); vol = v; }
    if(taperN && w > totalWeeks - taperN){ const pct = (VDOT_TAPER_PCT[taperN] || [])[w-(totalWeeks-taperN)-1]; fase = 'Polimento'; if(pct!==undefined) vol = v*(1+pct/100); }
    const alternancia = (foraDaSemana && foraDaSemana.length && w%2===0) ? { priorizar:foraDaSemana.slice(), motivo:'ficou fora da semana anterior por falta de espaço' } : null;
    out.push({ semana:w, fase, alternancia, corridaMinAlvo:Math.round(vol), muscSeriesFator: est.calibracao.ativa && w<=2 ? 0.85 : 1, progressao: w>1 && vol>c.carga.min*1.001 ? 'volume_gradual' : 'manter', nota: w===1 ? 'semana 1: sem aumento sobre a carga inicial' : '' });
  }
  return out;
}
function gerarPlanoSemanal(perfil, opcoes){
  opcoes = opcoes || {};
  const est = lerEstado(perfil, opcoes);
  if(est.cautela.bloqueado) return motorDescricaoBloqueio(est);
  // Semana N do plano vivo: o volume de corrida vem da trajetória calculada na semana 1 (progressão,
  // descarga, polimento) em vez da carga inicial.
  if(opcoes.alvoSemana && opcoes.alvoSemana.corridaMinAlvo>0 && est.corrida && est.corrida.carga){
    est.corrida.carga = { ...est.corrida.carga, min: opcoes.alvoSemana.corridaMinAlvo };
  }
  const prio = definirPrioridade(est);
  let ajustes = { reduzir:0, semQualidade:false, semDobros:false, volumeFator:1, aliviarInferior:false, semProgressao:false, ...(opcoes.ajustesIniciais||{}) };
  let cons = null, val = null, ciclos = 0;
  const historicoVal = [];
  for(let ciclo=1; ciclo<=3; ciclo++){
    ciclos = ciclo;
    cons = motorConstruir(est, prio, ajustes);
    val = validarPlano(est, prio, cons.freq, cons.dist, cons.semana, ajustes);
    historicoVal.push({ ciclo, erros:val.erros.map(e=>e.cod+': '+e.detalhe) });
    if(val.ok) break;
    est.log.push({ etapa:6, regra:'correcao', motivo:'validação encontrou erros; ajustando e revalidando', dados:{ ciclo, erros:val.erros } });
    ajustes = motorAjustar(ajustes, val.erros);
  }
  // Plano reprovado nunca é entregue: tira uma sessão por vez (registrando o motivo) até passar em todas as regras.
  for(let k=0; !val.ok && k<12; k++){
    const errosAntes = val.erros;
    ajustes.reduzir = (ajustes.reduzir||0) + 1;
    cons = motorConstruir(est, prio, ajustes);
    val = validarPlano(est, prio, cons.freq, cons.dist, cons.semana, ajustes);
    est.log.push({ etapa:6, regra:'reducao_forcada', motivo:'regra violada: reduz uma sessão e revalida', dados:{ erros:errosAntes, passou:val.ok } });
    if(!cons.semana.sessoes.length) break;
  }
  return motorEmpacotar(est, prio, cons, val, ajustes, ciclos, historicoVal);
}
function motorEmpacotar(est, prio, cons, val, ajustes, ciclos, historicoVal){
  const { freq, dist, semana } = cons;
  const melhor = dist.melhor;
  const runAt = melhor ? melhor.runAt : {}, muscAt = melhor ? melhor.muscAt : {};
  const runTipos = {}, muscTipos = {}, runCode = {}, muscCode = {};
  DAY_ABBR.forEach(d=>{
    const w = semana.corridaWeek.find(x=>x.day===d);
    if(w){ const t = runAt[d]; runTipos[d] = t && t.tipo==='qualidade' ? 'qualidade' : (t && (t.tipo==='longa') ? 'longo' : 'leve'); runCode[d] = w.sessao || 'RUN_EASY_Z2'; }
    if(semana.muscPlan[d]){ const t = muscAt[d]; muscTipos[d] = t.tipo==='lower' ? 'leg' : t.tipo==='upper' ? 'upper' : 'full'; muscCode[d] = motorCodigoMusc(t, ajustes.aliviarInferior); }
  });
  const foco = focoFromObjetivo(est.objetivo.tipo==='forca' ? 'massa' : (est.objetivo.tipo==='desempenho_corrida' ? 'performance' : est.objetivo.tipo));
  const tipos = { runTipos, muscTipos, qualityKind: Object.keys(runTipos).some(d=>runTipos[d]==='qualidade') ? (est.objetivo.distanciaKm<=10 ? 'intervalo' : 'tempo') : null, runCode, muscCode, fadiga:hybridFadigaSemana(runCode, muscCode) };
  let periodos = {};
  try{ periodos = annotateHybridJustifications(semana.corridaWeek, semana.muscPlan, foco, tipos) || {}; }catch(e){}
  const corridaDays = semana.corridaWeek.map(w=>w.day), muscDays = Object.keys(semana.muscPlan);
  const longaoDay = (semana.corridaWeek.find(w=>w.type==='Longão') || {}).day || null;
  const dayPicks = {}; DAY_ABBR.forEach(d=>{ const r = corridaDays.includes(d), m = muscDays.includes(d); dayPicks[d] = r && m ? 'ambos' : r ? 'corrida' : m ? 'musc' : 'descanso'; });
  const totalWeeks = motorSemanasDoPlano(est);
  const trajetoria = motorTrajetoria(est, prio, semana, totalWeeks, freq.foraDaSemana);
  const fase = est.calibracao.ativa ? 'Retomada / calibração' : 'Base';
  const runMin = semana.corridaWeek.reduce((t,w)=>t+w.totalMin, 0);
  const muscMin = semana.sessoes.filter(s=>s.modalidade==='musculacao').reduce((t,s)=>t+s.duracaoMin, 0);
  const alertas = [...est.alertas];
  freq.foraDaSemana.forEach(m=>alertas.push('modalidade_fora_da_semana:'+m));
  if(freq.desejadas.musc>freq.musc && freq.musc>0) alertas.push('musculacao_reduzida_por_espaco');
  if(freq.desejadas.corrida>freq.corrida && freq.corrida>0) alertas.push('corrida_reduzida_por_espaco');
  semana.descartadas.forEach(x=>alertas.push('sessao_descartada:'+x.modalidade));
  if(!semana.sessoes.length) alertas.push('sem_espaco_para_sessoes');
  val.avisos.forEach(a=>alertas.push(a.cod+':'+a.detalhe));
  const dobros = semana.sessoes.filter(s=>s.combinada).length/2;
  const week = {
    weekNumber:1, phaseLabel:fase, totalWeeks, corridaWeek:semana.corridaWeek, muscPlan:semana.muscPlan, legEasingNotes:semana.legEasingNotes,
    fadiga:tipos.fadiga, periodos, motorV2:true,
  };
  return {
    engineVersion:MOTOR_ENGINE_VERSION, status:'ok', bloqueado:false,
    semana:week,
    sessoes:semana.sessoes, cortes:semana.cortes, descartadas:semana.descartadas,
    descanso:DAY_ABBR.filter(d=>!corridaDays.includes(d) && !muscDays.includes(d)),
    resumo:{ sessoesCorrida:semana.corridaWeek.length, sessoesMusculacao:muscDays.length, diasDeTreino:new Set([...corridaDays, ...muscDays]).size, dobros, corridaMin:runMin, musculacaoMin:Math.round(muscMin), volumePartidaCorrida:est.corrida.carga.min },
    sched:{ corridaDays, muscDays, longaoDay }, dayPicks, tipos,
    prioridade:prio, confianca:est.confianca, calibracao:est.calibracao, alertas,
    modalidadesForaDaSemana:freq.foraDaSemana,
    progressoes:freq.progressoes, trajetoria,
    capacidade:est.capacidade,
    validacao:{ ok:val.ok, ciclos, erros:val.erros, avisos:val.avisos, historico:historicoVal },
    ajustes,
    decisoes:est.log,
    estado:{ objetivo:est.objetivo, corrida:{ situacao:est.corrida.situacao, regime:est.corrida.regime, runWalk:est.corrida.runWalk, vdot:est.corrida.vdot, vdotFonte:est.corrida.vdotFonte, carga:est.corrida.carga, maiorMin:est.corrida.maiorMin, tetoLonga:est.corrida.tetoLonga }, musc:{ situacao:est.musc.situacao, freq:est.musc.freq }, recuperacao:est.recuperacao, restricoes:{ regioes:est.restricoes.regioes, motivos:est.restricoes.motivos }, equipamentos:[...est.equip.set], disp:est.disp.dias.map(d=>({ dia:d.dia, disponivel:d.disponivel, minutos:d.minutos, minConhecido:d.minConhecido })) },
  };
}
// Integração com o app: gera o primeiro plano a partir de state.athleteProfile e grava no mesmo formato do plano híbrido atual.
async function gerarPrimeiroPlanoV2(opcoes){
  if(!state.athleteProfile) await carregarAthleteProfile();
  const r = gerarPlanoSemanal(state.athleteProfile, opcoes);
  if(r.bloqueado) return r;
  const vd = r.estado.corrida.vdot;
  if(!state.corridaVdotData || !state.corridaVdotData.vdot || r.estado.corrida.vdotFonte==='desempenho'){
    state.corridaVdotData = { ...(state.corridaVdotData || {}), vdot:vd, paces:computeVdotPaces(vd) };
    await saveCorridaVdotData();
  }
  // Plano começa NESTA semana (estrutura por dia da semana, agenda por data real): a semana 1 é a semana
  // atual e só os dias de hoje em diante entram na agenda. Na segunda seguinte começa a semana 2.
  const inicioPlano = todayISO();
  const startMonday = vdotISODate(vdotMondayOf(new Date()));
  // Semana 1 criada no meio da semana: o motor redistribui as sessões só nos dias que ainda restam
  // (com as mesmas regras de 24 h e de fadiga). A trajetória das próximas semanas continua a da semana cheia.
  const idxHoje = (new Date().getDay()+6)%7;
  if(idxHoje>0){
    try{
      const parcial = JSON.parse(JSON.stringify(state.athleteProfile));
      const porDia = {};
      DAY_ABBR.slice(0, idxHoje).forEach(d=>{ porDia[d] = { disponivel:false, minutos:null }; });
      definirAthleteDisponibilidade(parcial, porDia, { origem:'informado', confianca:'alta', forcar:true });
      const r1 = gerarPlanoSemanal(parcial, opcoes);
      if(r1 && !r1.bloqueado && r1.semana && ((r1.semana.corridaWeek||[]).length || Object.keys(r1.semana.muscPlan||{}).length)){
        r1.semana.weekNumber = 1; r1.semana.totalWeeks = r.semana.totalWeeks; r1.semana.phaseLabel = r.semana.phaseLabel;
        r.semana = r1.semana; // agenda da semana dos dias que restam; o padrão semanal (sched) continua o da semana cheia
      }
    }catch(e){ console.warn('[plano] semana 1 parcial: usando a semana cheia', e); }
  }
  materializeHybridWeekIntoState(r.semana, startMonday, [], inicioPlano);
  const pendentes = [];
  for(let w=2; w<=r.semana.totalWeeks; w++){
    const t = r.trajetoria[w-1];
    pendentes.push({ weekNumber:w, phaseLabel:t.fase, totalWeeks:r.semana.totalWeeks, corridaWeek:[], muscPlan:{}, legEasingNotes:[], fadiga:null, periodos:{}, pendente:true, alvo:t });
  }
  const draft = toLegacyDraft(state.athleteProfile);
  const foco = focoFromObjetivo(draft.objetivo);
  state.hybridPlanData = { draft, sched:r.sched, totalWeeks:r.semana.totalWeeks, checkins:{}, foco, dayPicks:r.dayPicks, plan:[r.semana, ...pendentes], startMonday, currentWeekIndex:1, motorV2:true, engineVersion:r.engineVersion, decisoes:r.decisoes, validacao:r.validacao, assessment:montarAssessment(r), estados:estadosDaSemana(1, r.semana.phaseLabel), inicioPlano, materializadaSeg:startMonday, trajetoria:r.trajetoria, calibracao:r.calibracao, confianca:r.confianca };
  await saveHybridPlanData();
  return r;
}
/* ===== fim MOTOR V2 ===== */

// O app (script principal) e os testes usam estes nomes como globais.
Object.assign(globalThis, {
  MOTOR_ENGINE_VERSION,
  MOTOR_PARAMS,
  MOTOR_NIVEIS,
  MOTOR_FAIXAS,
  motorNivelMin,
  motorClamp,
  motorGet,
  motorFaixaIdx,
  motorSituacao,
  motorRegiao,
  MOTOR_REGIAO_MEMBRO_INFERIOR,
  MOTOR_BLOQUEIO_REGIAO,
  motorPadraoChave,
  motorLerDor,
  motorLerCautela,
  motorLerRestricoes,
  motorLerEquipamentos,
  motorVdot,
  motorNivelCorrida,
  motorNivelMusc,
  lerEstado,
  definirPrioridade,
  motorProibeDobro,
  definirFrequencias,
  motorQualidadePermitida,
  motorSessoesCorrida,
  motorQtdExercicios,
  motorSessoesMusc,
  motorCodigoCorrida,
  motorCodigoMusc,
  distribuirSessoes,
  motorNecessario,
  motorFiltroExercicio,
  motorPoolMotor,
  motorFamilia,
  motorCompletar,
  motorEsquema,
  motorMontarMusc,
  motorMontarCorrida,
  montarSessoes,
  validarPlano,
  motorConstruir,
  motorAjustar,
  motorDescricaoBloqueio,
  motorSemanasDoPlano,
  motorTrajetoria,
  gerarPlanoSemanal,
  motorEmpacotar,
  gerarPrimeiroPlanoV2,
});
