// Bloco 6: HybridScheduler em modo auditoria. Detecta conflitos sem mover nada; relatório dos 20 perfis.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'auditarSemana', 'auditarSemanaAtual',
    'sessoesDaSemanaGerada', 'sessoesPlanejadasDaSemana']);
  const S = T.state;
  const ses = (dia, modalidade, papel, extra) => ({ id: dia + modalidade, dia, modalidade, papel, titulo: papel, chaveSessao: false, prescricao: {}, ...(extra || {}) });

  // casos sintéticos: cada restrição dispara
  const casos = {
    perna_vespera_intervalado: [ses('Seg', 'musculacao', 'LEG_DAY_HEAVY'), ses('Ter', 'corrida', 'RUN_INTERVALS_VO2MAX')],
    intervalado_vespera_perna: [ses('Seg', 'corrida', 'RUN_INTERVALS_VO2MAX'), ses('Ter', 'musculacao', 'LEG_DAY_HEAVY')],
    tres_dias_fortes: [ses('Seg', 'corrida', 'RUN_TEMPO_THRESHOLD'), ses('Ter', 'musculacao', 'LEG_DAY_HEAVY'), ses('Qua', 'corrida', 'RUN_LONG_RUN')],
    duas_fortes_mesmo_dia: [ses('Qui', 'corrida', 'RUN_INTERVALS_VO2MAX'), ses('Qui', 'musculacao', 'LEG_DAY_HEAVY')],
    sem_conflito: [ses('Seg', 'corrida', 'RUN_EASY_Z2'), ses('Ter', 'musculacao', 'UPPER_BODY'), ses('Qui', 'corrida', 'RUN_INTERVALS_VO2MAX'), ses('Sáb', 'corrida', 'RUN_LONG_RUN')],
  };
  const res = {};
  for (const [k, lista] of Object.entries(casos)) res[k] = T.auditarSemana(lista).conflictsFound.map(c => c.codigo);
  res.tempo = T.auditarSemana([ses('Seg', 'corrida', 'RUN_EASY_Z2', { minutos: 70 })], { minutosPorDia: { Seg: 45 } }).conflictsFound.map(c => c.codigo);
  res.dor = T.auditarSemana([ses('Seg', 'musculacao', 'LEG_DAY_HEAVY')], { dor: ['joelho'] }).conflictsFound.map(c => c.codigo);
  conferir('agenda-casos', res);
  ok(res.perna_vespera_intervalado.includes('perna_pesada_e_corrida_forte') && res.intervalado_vespera_perna.includes('perna_pesada_e_corrida_forte'), 'detecta perna pesada colada no intervalado (antes e depois)');
  ok(res.tres_dias_fortes.includes('dias_fortes_seguidos'), 'detecta três dias fortes seguidos');
  ok(res.duas_fortes_mesmo_dia.includes('duas_fortes_mesmo_dia'), 'detecta duas sessões fortes no mesmo dia');
  ok(res.sem_conflito.length === 0, 'semana equilibrada não gera conflito');
  ok(res.tempo.includes('tempo_acima_do_disponivel') && res.dor.includes('pernas_com_dor_ativa'), 'detecta tempo acima do disponível e pernas com dor ativa');
  const msg = T.auditarSemana(casos.perna_vespera_intervalado).conflictsFound[0];
  ok(msg.mensagem.length <= 70 && msg.sugestao.length <= 50, 'mensagens curtas: "' + msg.mensagem + '" / "' + msg.sugestao + '"');

  // relatório: todas as semanas dos 20 perfis, sem mudar nada
  const relatorio = {}; let total = 0, semanasComConflito = 0, semanas = 0;
  for (const [nome, R0] of PERFIS) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar({ ...BASE, ...R0 });
    try { await T.gerarPrimeiroPlanoV2(); } catch (e) { relatorio[nome] = 'erro: ' + e.message; continue; }
    const hp = S.hybridPlanData; if (!hp) { relatorio[nome] = 'sem plano (bloqueado)'; continue; }
    const ass = hp.assessment || {};
    const antes = JSON.stringify(S.treinos) + JSON.stringify(S.musculacao);
    const porSemana = [];
    for (let n = 1; n <= hp.plan.length; n++) {
      const w = n === 1 ? hp.plan[0] : T.gerarSemanaV2(n);
      if (!w) continue;
      const a = T.auditarSemana(T.sessoesDaSemanaGerada(w), { semana: n, minutosPorDia: ass.minutesByDay, dor: ass.currentPain });
      semanas++; if (a.conflictsFound.length) { semanasComConflito++; total += a.conflictsFound.length; }
      porSemana.push(a.conflictsFound.map(c => `${c.codigo}(${c.dias.join('/')})`).join(', ') || 'ok');
    }
    relatorio[nome] = porSemana;
    ok(JSON.stringify(S.treinos) + JSON.stringify(S.musculacao) === antes, nome.slice(0, 2) + ': auditoria não mudou a agenda');
  }
  conferir('agenda-auditoria-20-perfis', { resumo: { semanas, semanasComConflito, conflitos: total }, relatorio });
  console.log(`  auditoria: ${semanasComConflito} de ${semanas} semanas com conflito (${total} conflitos)`);
  ok(S.hybridPlanData.auditorias && S.hybridPlanData.auditorias[1], 'auditoria da semana fica registrada no plano');
  semErro();
  process.exit(process.exitCode || 0);
})();
