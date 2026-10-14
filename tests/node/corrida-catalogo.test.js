// Catálogo técnico de corrida e opções de sessão (src/motor/corrida-catalogo.js) — Etapa 1.
// Integridade do catálogo; para cada um dos 20 perfis e cada dia de corrida da semana do motor: menu do dia,
// coerência de cada opção (duração, distância, tempo das etapas, pace na zona, carga ≤ motor, repetições nas tabelas),
// validarPlano (V1–V10) com a opção no lugar da sessão do motor, determinismo; segurança para iniciante, dor e
// recuperação; qualidade só no dia de qualidade e nunca 2 na semana; variedade.
// EXEMPLOS=1 imprime sessões de exemplo (iniciante, intermediário, avançado).
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const copia = (x) => JSON.parse(JSON.stringify(x));
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const REGIOES = ['joelho', 'tornozelo', 'quadril', 'pe', 'lombar', 'ombro', 'punho', 'outra'];
const AJ0 = { reduzir: 0, semQualidade: false, semDobros: false, volumeFator: 1, aliviarInferior: false, semProgressao: false };

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'lerEstado', 'definirPrioridade', 'motorConstruir', 'validarPlano']);
  const S = T.state, G = globalThis;
  const preparar = async (R) => { S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {}; await T.qv2Aplicar(R); };
  const pace = (str) => G.parsePaceRangeToSec(str);
  const meio = (str) => { const r = pace(str); return r ? (r.lo + r.hi) / 2 : null; };

  // ================= 1. Integridade do catálogo =================
  {
    const cats = { mobilidade: G.CORRIDA_MOBILIDADE, educativos: G.CORRIDA_EDUCATIVOS, alongamentos: G.CORRIDA_ALONGAMENTOS };
    const ids = Object.values(cats).flatMap(c => Object.keys(c));
    ok(new Set(ids).size === ids.length, `catálogo: ${ids.length} itens com ids únicos entre mobilidade, educativos e alongamentos`);
    const ruins = [];
    for (const [cat, c] of Object.entries(cats)) for (const [id, it] of Object.entries(c)) {
      if (!it.nome || !it.dose || !(it.seg > 0) || !Array.isArray(it.contra) || it.contra.some(r => !REGIOES.includes(r))) ruins.push(cat + ':' + id);
      if (it.impacto && !['baixo', 'medio', 'alto'].includes(it.impacto)) ruins.push(cat + ':' + id + ' impacto');
      if (it.nivelMin && !NIVEIS.includes(it.nivelMin)) ruins.push(cat + ':' + id + ' nível');
    }
    ok(ruins.length === 0, 'catálogo: todo item com nome, dose, duração, regiões de dor válidas, impacto e nível válidos' + (ruins.length ? ' — ' + ruins.join(', ') : ''));
    const SESSOES = ['RUN_EASY_Z2', 'RUN_LONG_RUN', 'RUN_INTERVALS_VO2MAX', 'RUN_TEMPO_THRESHOLD'], TIPOS = ['Rodagem Leve', 'Longão', 'Intervalado', 'Limiar'];
    const opRuins = Object.entries(G.CORRIDA_OPCOES).filter(([id, o]) => !['leve', 'longa', 'qualidade'].includes(o.dia) || !o.nome || !NIVEIS.includes(o.nivelMin) || !o.regimes.length
      || (id !== 'QUALIDADE_MOTOR' && (!SESSOES.includes(o.sessao) || !TIPOS.includes(o.tipo))) || (o.provas && o.provas.some(p => !['5', '10', '21.0975', '42.195'].includes(p)))
      || (o.dia === 'qualidade' && !o.qualidade)).map(([id]) => id);
    ok(opRuins.length === 0, `opções: ${Object.keys(G.CORRIDA_OPCOES).length} opções com dia, tipo, código de fadiga, nível e provas válidos; toda opção de qualidade marcada como qualidade` + (opRuins.length ? ' — ' + opRuins.join(', ') : ''));
    ok(['Intervalado', 'Limiar'].every(t => Object.values(G.CORRIDA_OPCOES).filter(o => o.dia === 'qualidade' && o.tipo).every(o => ['Intervalado', 'Limiar'].includes(o.tipo))),
      'opções de qualidade usam os tipos que V1/V6 já reconhecem como intensidade (Intervalado/Limiar)');
    ok(G.CORRIDA_STRIDES.impacto === 'alto' && G.CORRIDA_STRIDES.contra.length === 4 && G.CORRIDA_STRIDES.nivelMin === 'intermediario', 'acelerações: impacto alto, saem com dor em membro inferior, só intermediário em diante');
  }

  // ================= 2. Por perfil e por dia =================
  const problemas = { duracao: [], km: [], tempoEtapas: [], zona: [], semPaceComTempo: [], carga: [], reps: [], validar: [], determinismo: [], blocos: [], equivalente: [] };
  let nSessoes = 0, nDias = 0;
  const menus = {};
  const exemplos = {};
  const zonaOk = (z, p, P) => {
    // P em s/km. Faixas largas por zona: confere que o pace segue a zona e vem do VDOT (nunca inventado).
    if (/Z5/.test(z)) return p <= P.T + 5;
    if (/Z4/.test(z)) return p >= P.I - 8 && p <= P.M + 5;
    if (/Z3/.test(z)) return Math.abs(p - P.M) <= 12;
    if (/Z1|Z2/.test(z)) return p >= P.Ef - 5 && p <= P.Es + 35;
    return true;
  };
  for (const [nome, R0] of PERFIS) {
    const n = nome.slice(0, 2);
    await preparar({ ...BASE, ...R0 });
    const est = T.lerEstado(S.athleteProfile);
    if (est.cautela && est.cautela.bloqueado) continue;
    const prio = T.definirPrioridade(est);
    const cons = T.motorConstruir(est, prio, { ...AJ0 });
    const base = T.validarPlano(est, prio, cons.freq, cons.dist, cons.semana, { ...AJ0 });
    const codsBase = new Set(base.erros.map(e => e.cod));
    const P = Object.fromEntries(Object.entries(est.corrida.paces).map(([k, v]) => [k, v * 86400]));
    menus[n] = { nivel: est.capacidade.corrida, regime: est.corrida.regime, prova: est.corrida.goalKey, dor: est.restricoes.regioes, prontidao: est.recuperacao.prontidao, dias: {} };
    for (const w of cons.semana.corridaWeek) {
      const cdia = G.corridaContextoDoDia(est, cons.semana, w.day, AJ0);
      const menu = G.corridaOpcoesDoDia(est, cdia);
      menus[n].dias[w.day] = { tipoDia: cdia.tipoDia, menu };
      nDias++;
      // equivalência: LEVE / LONGO sem nenhum extra ≈ a sessão do motor
      const eq = cdia.tipoDia === 'leve' ? 'LEVE' : cdia.tipoDia === 'longa' ? 'LONGO' : null;
      if (eq && menu.includes(eq) && est.corrida.regime === 'continuo') {
        const s0 = G.corridaMontarOpcao(est, eq, cdia, { mobilidade: [], educativos: [], alongamentos: [], strides: 0, stridesFim: 0 });
        // tolerância: meio km no ritmo fácil (o catálogo mostra e conta o km arredondado a 0,5; o motor conta o km bruto)
        const tolMin = Math.ceil(0.5 * P.Es / 60) + 1;
        if (!s0 || s0.totalMin > w.totalMin || w.totalMin - s0.totalMin > tolMin || Math.abs(s0.totalKm - w.totalKm) > Math.max(0.5, w.totalKm * 0.05)) problemas.equivalente.push(`${n} ${w.day} ${eq}: motor ${w.totalMin}min/${w.totalKm}km, catálogo ${s0 && s0.totalMin}min/${s0 && s0.totalKm}km`);
      }
      for (const id of menu) {
        const s = G.corridaMontarOpcao(est, id, cdia);
        nSessoes++;
        const tag = `${n} ${w.day} ${id}`;
        if (id === 'QUALIDADE_MOTOR') continue;
        if (!(exemplos[n])) exemplos[n] = {};
        exemplos[n][w.day + ' ' + id] = s;
        // duração: dentro de 80–100% da sessão do motor
        const fx = id === 'REGENERATIVO' ? [0.6, 0.8] : [0.8, 1];   // regenerativo: de propósito mais curto que a rodagem
        if (s.totalMin > Math.floor(cdia.limiteMin * fx[1]) || s.totalMin < Math.floor(cdia.limiteMin * fx[0])) problemas.duracao.push(`${tag}: ${s.totalMin} min (motor ${cdia.limiteMin})`);
        // blocos: tudo contabilizado (aquecimento, mobilidade, educativos, acelerações, principal, desaquecimento, alongamento)
        const somaMin = s.blocos.reduce((t, b) => t + b.min, 0), somaKm = s.blocos.reduce((t, b) => t + b.km, 0);
        if (Math.abs(Math.round(somaMin) - s.totalMin) > 0) problemas.blocos.push(`${tag}: soma dos blocos ${somaMin.toFixed(1)} min ≠ total ${s.totalMin}`);
        const somaEtapas = s.steps.reduce((t, x) => t + (x.km || 0), 0), nCorrendo = s.steps.filter(x => x.km > 0).length;
        if (Math.abs(somaEtapas - s.totalKm) > 0.001 || s.steps.some(x => Math.round(x.km * 2) !== x.km * 2) || Math.abs(somaKm - s.totalKm) > 0.25 * nCorrendo + 0.01) problemas.km.push(`${tag}: etapas ${somaEtapas} km, total ${s.totalKm}, real ${somaKm.toFixed(2)} km`);
        // etapas do GPS cobrem a sessão (tempo ≈ km × pace)
        const gpsMin = s.gpsSteps.reduce((t, g) => t + (g.tipo === 'tempo' ? g.metaSeg / 60 : (g.km * (meio(g.pace) || 0)) / 60), 0);
        if (Math.abs(gpsMin - somaMin) > Math.max(1.5, somaMin * 0.07)) problemas.tempoEtapas.push(`${tag}: GPS ${gpsMin.toFixed(1)} min x blocos ${somaMin.toFixed(1)} min`);
        // pace de cada etapa na zona; etapa sem pace só por tempo (sem alerta de ritmo)
        s.gpsSteps.forEach(g => {
          const m = meio(g.pace);
          if (m === null) { if (g.tipo !== 'tempo') problemas.semPaceComTempo.push(`${tag}: ${g.name} sem pace e por distância`); return; }
          if (/^Caminhada/.test(g.name) && g.zona === 'Z1') return;   // caminhada da corrida/caminhada: ritmo de caminhada do motor
          if (!zonaOk(g.zona, m, P)) problemas.zona.push(`${tag}: ${g.name} ${g.pace} fora de ${g.zona}`);
        });
        // carga de intensidade nunca acima da sessão do motor
        if (s.cargaIntensa > cdia.ref.carga + 0.05) problemas.carga.push(`${tag}: carga ${s.cargaIntensa} > motor ${cdia.ref.carga}`);
        // repetições dentro das tabelas
        const op = G.CORRIDA_OPCOES[id];
        if (op.reps) {
          const reps = s.gpsSteps.filter(g => /^(Tiro|Limiar|Subida|Ritmo de prova) \d+\//.test(g.name)).length;
          const max = op.reps[1] + (est.capacidade.corrida === 'avancado' && op.familia !== 'subidas' ? 1 : 0);
          if (reps < op.reps[0] || reps > max) problemas.reps.push(`${tag}: ${reps} repetições fora de ${op.reps[0]}–${max}`);
          const rec = s.gpsSteps.filter(g => /^(Trote|Descida) \d+\//.test(g.name));
          if (rec.some(g => g.metaSeg !== op.rest)) problemas.reps.push(`${tag}: recuperação diferente de ${op.rest} s`);
        }
        // V1–V10 com a opção no lugar da sessão do motor
        const c2 = copia({ freq: cons.freq, dist: cons.dist, semana: cons.semana });
        const i = c2.semana.corridaWeek.findIndex(x => x.day === w.day);
        c2.semana.corridaWeek[i] = { ...c2.semana.corridaWeek[i], ...copia(s), day: w.day, duracaoMin: s.totalMin };
        c2.semana.sessoes.filter(x => x.dia === w.day && x.modalidade === 'corrida').forEach(x => { x.duracaoMin = s.totalMin; x.km = s.totalKm; });
        const v = T.validarPlano(est, prio, c2.freq, c2.dist, c2.semana, { ...AJ0 });
        const novos = v.erros.filter(e => !codsBase.has(e.cod));
        if (novos.length) problemas.validar.push(`${tag}: ${novos.map(e => e.cod + ' ' + e.detalhe).join('; ')}`);
        // determinismo
        if (JSON.stringify(G.corridaMontarOpcao(est, id, cdia)) !== JSON.stringify(s)) problemas.determinismo.push(tag);
      }
    }
    // escolhas inválidas são recusadas
    if (n === '08') {
      const cq = G.corridaContextoDoDia(est, cons.semana, cons.semana.corridaWeek.find(w => w.estimulo && w.estimulo.tipo === 'qualidade').day, AJ0);
      ok(G.corridaMontarOpcao(est, 'I_800', cq, { mobilidade: ['nao_existe'], educativos: [], alongamentos: [], strides: 0 }) === null, 'escolha com item inexistente → recusada');
      ok(G.corridaMontarOpcao(est, 'I_800', cq, { mobilidade: [], educativos: [], alongamentos: [], strides: 10 }) === null, 'acelerações acima de 6 → recusadas');
      ok(G.corridaMontarOpcao(est, 'I_800', cq, { mobilidade: ['tornozelo', 'tornozelo'], educativos: [], alongamentos: [], strides: 0 }) === null, 'item repetido → recusado');
      ok(G.corridaMontarOpcao(est, 'OPCAO_FALSA', cq) === null && G.corridaMontarOpcao(est, 'LONGO', cq) === null, 'opção inexistente ou de outro tipo de dia → recusada');
      const sem = G.corridaContextoDoDia(est, cons.semana, cq.dia, { ...AJ0, semQualidade: true });
      ok(G.corridaOpcoesDoDia(est, sem).filter(id => G.CORRIDA_OPCOES[id].qualidade).length === 0, 'check-in sem qualidade (semQualidade): menu sem nenhuma opção de qualidade');
    }
    if (n === '15') {
      const d = cons.semana.corridaWeek[0];
      const cd = G.corridaContextoDoDia(est, cons.semana, d.day, AJ0);
      ok(G.corridaMontarOpcao(est, cd.tipoDia === 'longa' ? 'LONGO' : 'LEVE', cd, { mobilidade: [], educativos: ['skip_alto'], alongamentos: [], strides: 0 }) === null, 'dor no joelho: educativo de impacto escolhido de fora → recusado');
    }
  }
  for (const [k, lista] of Object.entries(problemas)) {
    const rot = { duracao: 'duração entre 80% e 100% da sessão do motor (regenerativo: 60% a 80%)', km: 'km total = soma das etapas mostradas (cada uma arredondada a 0,5 km) e perto da distância real', tempoEtapas: 'etapas do GPS cobrem a sessão (tempo ≈ km × pace)',
      zona: 'pace de cada etapa dentro da zona (calculado pelo VDOT)', semPaceComTempo: 'etapa sem pace-alvo só por tempo (sem alerta de ritmo)', carga: 'carga de intensidade nunca acima da sessão do motor',
      reps: 'repetições e recuperações dentro das tabelas', validar: 'validarPlano (V1–V10) sem erro novo com a opção no lugar da sessão do motor', determinismo: 'mesma entrada, mesma sessão',
      blocos: 'tempo de mobilidade, educativos, acelerações, recuperações, desaquecimento e alongamento contado no total', equivalente: 'LEVE/LONGO sem extras ≈ sessão do motor (nunca mais longa; km dentro de 0,5 km ou 5%)' }[k];
    ok(lista.length === 0, `${rot} — ${nSessoes} sessões em ${nDias} dias` + (lista.length ? ' — ' + lista.slice(0, 4).join(' | ') + (lista.length > 4 ? ` (+${lista.length - 4})` : '') : ''));
  }

  // ================= 3. Segurança e menus =================
  const todos = (f) => Object.entries(menus).flatMap(([n, m]) => Object.entries(m.dias).map(([d, x]) => ({ n, d, ...x, m })));
  const op = (id) => G.CORRIDA_OPCOES[id];
  const ini = todos().filter(x => x.m.nivel === 'iniciante' || x.m.regime === 'run_walk');
  ok(ini.length > 0 && ini.every(x => x.menu.every(id => ['LEVE', 'LONGO', 'REGENERATIVO'].includes(id))), `iniciante e corrida/caminhada: só rodagem, regenerativo e longão (${ini.length} dias) — sem tiro, limiar, subida, acelerações nem progressivo`);
  const iniSess = Object.entries(exemplos).filter(([n]) => menus[n].nivel === 'iniciante' || menus[n].regime === 'run_walk').flatMap(([, e]) => Object.values(e));
  ok(iniSess.every(s => s.gpsSteps.every(g => !/Z3|Z4|Z5/.test(g.zona || '')) && !s.blocos.some(b => b.fase === 'strides')), 'iniciante: nenhuma etapa em Z3/Z4/Z5 nem acelerações');
  const dorInf = todos().filter(x => (x.m.dor || []).some(r => ['joelho', 'tornozelo', 'quadril', 'pe'].includes(r)));
  ok(dorInf.length > 0 && dorInf.every(x => !x.menu.some(id => /SUBIDAS|STRIDES/.test(id))), `dor em membro inferior: sem subidas nem acelerações (${dorInf.length} dias)`);
  const dorSess = Object.entries(exemplos).filter(([n]) => (menus[n].dor || []).some(r => ['joelho', 'tornozelo', 'quadril', 'pe'].includes(r))).flatMap(([, e]) => Object.values(e));
  ok(dorSess.every(s => s.blocos.every(b => !(b.itens || []).some(it => (G.CORRIDA_EDUCATIVOS[it.id] || {}).impacto === 'alto'))), 'dor em membro inferior: nenhum educativo de impacto alto nas sessões');
  ok(dorInf.every(x => !x.menu.some(id => op(id).qualidade)), 'dor (corrida sem qualidade pelo motor): nenhuma opção de qualidade nem progressiva');
  const red = todos().filter(x => x.m.prontidao !== 'normal');
  ok(red.length > 0 && red.every(x => !x.menu.some(id => op(id).prontidaoNormal || op(id).qualidade)), `recuperação reduzida (sono < 6 h): sem acelerações, progressivo, ritmo de prova ou qualidade (${red.length} dias)`);
  ok(todos().every(x => x.menu.every(id => op(id).dia === x.tipoDia)), 'cada dia só oferece opções do seu tipo (qualidade só no dia de qualidade; longão só no longão)');
  ok(Object.values(menus).every(m => Object.values(m.dias).filter(d => d.menu.some(id => op(id).dia === 'qualidade')).length <= 1), 'nunca mais de 1 dia com opções de qualidade na semana');
  const comQual = todos().filter(x => x.tipoDia === 'qualidade');
  const poucas = comQual.filter(x => x.menu.filter(id => id !== 'QUALIDADE_MOTOR').length < 4);
  ok(comQual.length > 0 && poucas.length === 0, `variedade: todo dia de qualidade tem pelo menos 4 opções além da do motor (${comQual.map(x => x.n + ':' + (x.menu.length - 1)).join(', ')})` + (poucas.length ? ' — poucas: ' + poucas.map(x => x.n).join(',') : ''));
  const leves = Object.entries(exemplos).filter(([n]) => menus[n].regime === 'continuo').flatMap(([, e]) => Object.entries(e)).filter(([k]) => / (LEVE|REGENERATIVO)$/.test(k));
  ok(leves.length > 0 && leves.every(([, s]) => !s.blocos.some(b => b.fase === 'preparacao' || b.fase === 'alongamento')), 'rodagem leve e regenerativo (corrida contínua): sem mobilidade, educativos ou alongamento automáticos (nem toda sessão precisa)');
  const subidas = Object.values(exemplos).flatMap(e => Object.entries(e)).filter(([k]) => /SUBIDAS/.test(k));
  ok(subidas.length > 0 && subidas.every(([, s]) => s.gpsSteps.filter(g => /^Subida/.test(g.name)).every(g => g.pace === '' && g.tipo === 'tempo' && /esforço/.test(g.desc))), `subidas: por esforço, sem pace-alvo (${subidas.length} sessões)`);

  // ================= 4. Exemplos =================
  if (process.env.EXEMPLOS === '1') {
    const mostrar = (n, chave) => {
      const s = exemplos[n] && exemplos[n][chave];
      if (!s) { console.log(`\n[${n} ${chave}] não disponível`); return; }
      console.log(`\n=== Perfil ${n} (${menus[n].nivel}, prova ${menus[n].prova}) · ${chave} · ${s.nomeSessao} · ${s.totalKm} km · ${s.totalMin} min · carga ${s.cargaIntensa}`);
      s.blocos.forEach(b => console.log(`  ${b.titulo.padEnd(26)} ${String(Math.round(b.min * 10) / 10).padStart(5)} min  ${b.km ? (Math.round(b.km * 100) / 100 + ' km').padEnd(9) : ''.padEnd(9)} ${b.pace ? b.pace + ' ' : ''}${b.zona ? '[' + b.zona + '] ' : ''}${b.desc}`));
    };
    console.log('\nMenus:'); Object.entries(menus).forEach(([n, m]) => console.log(`  ${n} ${m.nivel}/${m.regime}/${m.prova}: ` + Object.entries(m.dias).map(([d, x]) => `${d}(${x.tipoDia}) ${x.menu.join(',')}`).join(' | ')));
    for (const [n, k] of (process.env.EXEMPLOS_LISTA || '').split(';').filter(Boolean).map(x => x.split('|'))) mostrar(n, k);
  }
  semErro();
  process.exit(process.exitCode || 0);
})();
