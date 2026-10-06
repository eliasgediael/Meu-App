// Caracterização do plano vivo e do treinador: carga real, conflitos de 24 h, escada de ajuste,
// treino perdido, dor muscular do check-in diário e volta dos ajustes de musculação na virada da semana.
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const copia = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'cargaReal', 'conflitosDoDia', 'opcoesAjuste',
    'treinosPerdidos', 'resolverPerdido', 'registrarCheckinDiario', 'guardarOriginalMusc', 'restaurarAjustesMuscAntigos', 'treinoEntryForDay', 'muscListForDay',
    'DAY_ABBR', 'todayISO', 'porQueHoje', 'ehSessaoChaveDia']);
  const S = T.state;
  const preparar = async (n) => { S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    S.corridaProgress = {}; S.workoutSessionsLog = []; S.checkinDiario = {}; S.domsPernas = {}; S.perdidosTratados = {}; S.diarioTreinador = []; S.muscAjusteOrig = {};
    await T.qv2Aplicar(perfil(n)); await T.gerarPrimeiroPlanoV2(); };
  const semana = () => Object.fromEntries(T.DAY_ABBR.map(d => { const e = T.treinoEntryForDay(d), l = T.muscListForDay(d);
    return [d, { corrida: e ? `${e.type}:${e.totalKm}km:${e.totalMin}min` : null, musc: l.length ? l.map(x => `${x.nome} ${x.series}x${x.reps}`) : null }]; }));

  await preparar('08');
  const plano0 = semana();
  conferir('treinador-semana-materializada', { semana: plano0, chave: Object.fromEntries(T.DAY_ABBR.map(d => [d, T.ehSessaoChaveDia(d)])),
    porque: Object.fromEntries(T.DAY_ABBR.map(d => [d, { corrida: T.porQueHoje(d, 'corrida') || null, musc: T.porQueHoje(d, 'musculacao') || null }])) });

  // ---------- carga real ----------
  {
    const chaveDe = (d) => (T.treinoEntryForDay(d) || {}).day;
    const out = {};
    const cenario = (nome, prep) => { S.corridaProgress = {}; S.workoutSessionsLog = []; S.checkinDiario = {}; prep(); out[nome] = T.cargaReal(); };
    cenario('vazio', () => {});
    cenario('intervalado_hoje', () => { S.corridaProgress[chaveDe('Seg')] = { done: true, data: '2026-10-05', tempo: '39:00', km: '6.5' }; });
    cenario('intervalado_hoje_muito_dificil', () => { S.corridaProgress[chaveDe('Seg')] = { done: true, data: '2026-10-05', tempo: '39:00', km: '6.5', comoFoi: 4 }; });
    cenario('leg_day_ontem_9_series', () => { S.workoutSessionsLog = [{ data: '2026-10-04', duracaoSeg: 3000, exercicios: [{ grupo: 'Pernas', series: '4' }, { grupo: 'Pernas', series: '5' }] }]; });
    cenario('semana_pesada_vs_mes_leve', () => {
      for (let i = 0; i < 6; i++) S.workoutSessionsLog.push({ data: `2026-10-0${5 - Math.min(i, 4)}`, duracaoSeg: 3600, exercicios: [{ grupo: 'Peito', series: '3' }] });
      S.workoutSessionsLog.push({ data: '2026-09-20', duracaoSeg: 1800, exercicios: [] });
    });
    cenario('checkin_pernas_pesadas_e_dor_forte', () => { S.checkinDiario['2026-10-05'] = { energia: 1, pernas: 3, dor: 3 }; });
    conferir('treinador-carga-real', out);
  }

  // ---------- conflitos de 24 h (simulação de dias) ----------
  {
    const leg = [{ grupo: 'Pernas', sessao: 'LEG_DAY_HEAVY' }], sup = [{ grupo: 'Peito', sessao: 'UPPER_BODY' }];
    const inter = { type: 'Intervalado' }, leve = { type: 'Rodagem Leve' }, longao = { type: 'Longão' };
    const casos = {
      leg_hoje_intervalado_amanha: { Seg: { corrida: null, musc: leg }, Ter: { corrida: inter, musc: [] } },
      intervalado_ontem_leg_hoje: { Seg: { corrida: inter, musc: [] }, Ter: { corrida: null, musc: leg } },
      intervalado_e_leg_mesmo_dia: { Ter: { corrida: inter, musc: leg } },
      dois_fortes_seguidos: { Seg: { corrida: inter, musc: [] }, Ter: { corrida: longao, musc: [] } },
      leve_e_superiores: { Seg: { corrida: leve, musc: sup }, Ter: { corrida: leve, musc: sup } },
    };
    const out = {};
    for (const [k, sim] of Object.entries(casos)) {
      const cheio = Object.fromEntries(T.DAY_ABBR.map(d => [d, sim[d] || { corrida: null, musc: [] }]));
      out[k] = Object.fromEntries(T.DAY_ABBR.map(d => [d, T.conflitosDoDia(d, cheio)]).filter(([, v]) => v.length));
    }
    conferir('treinador-conflitos-24h', out);
  }

  // ---------- escada de ajuste (interface removida, código ainda usado) ----------
  {
    const out = {};
    for (const d of T.DAY_ABBR) out[d] = T.opcoesAjuste(d).map(o => ({ titulo: o.titulo, desc: o.desc, recomendado: !!o.recomendado }));
    conferir('treinador-opcoes-ajuste', out);
  }

  // ---------- treino perdido (quinta-feira, nada feito desde segunda) ----------
  {
    H.congelarRelogio('2026-10-08T10:00:00-03:00');
    const perdidos = T.treinosPerdidos().map(p => ({ dia: p.dia, mod: p.mod, titulo: p.titulo, chave: p.chave }));
    const antes = semana();
    const primeiro = T.treinosPerdidos()[0];
    if (primeiro) await T.resolverPerdido(primeiro, 'remarcar');
    const depois = semana();
    const mudou = Object.fromEntries(T.DAY_ABBR.filter(d => JSON.stringify(antes[d]) !== JSON.stringify(depois[d])).map(d => [d, { antes: antes[d], depois: depois[d] }]));
    conferir('treinador-treino-perdido', { perdidos, remarcado: primeiro ? { dia: primeiro.dia, mod: primeiro.mod } : null, mudou, depoisLista: T.treinosPerdidos().map(p => p.dia + ':' + p.mod), diario: S.diarioTreinador.map(x => ({ alteracao: x.alteracao, motivo: x.motivo })) });
    H.congelarRelogio('2026-10-05T10:00:00-03:00');
  }

  // ---------- dor muscular do check-in diário (dor forte = DOMS 7) ----------
  {
    await preparar('08');
    const antes = semana();
    await T.registrarCheckinDiario({ energia: 2, pernas: 3, dor: 3 });
    const depois = semana();
    conferir('treinador-dor-checkin-diario', { hoje: T.todayISO(), doms: S.domsPernas, mudou: Object.fromEntries(T.DAY_ABBR.filter(d => JSON.stringify(antes[d]) !== JSON.stringify(depois[d])).map(d => [d, { antes: antes[d], depois: depois[d] }])) });
  }

  // ---------- ajustes de musculação voltam na virada da semana ----------
  {
    await preparar('04');
    const d = T.DAY_ABBR.find(x => T.muscListForDay(x).length);
    const original = copia(S.musculacao[d]);
    T.guardarOriginalMusc(d);
    S.musculacao[d] = S.musculacao[d].slice(0, 1);
    T.restaurarAjustesMuscAntigos('2026-10-05');
    const mesmaSemana = S.musculacao[d].length;
    T.restaurarAjustesMuscAntigos('2026-10-12');
    ok(mesmaSemana === 1, 'ajuste de musculação vale na semana em que foi feito');
    ok(S.musculacao[d].length === original.length && S.musculacao[d].every(e => e.done === false), 'na segunda seguinte a lista original volta (sem "feito")');
  }

  semErro();
  process.exit(process.exitCode || 0);
})();
