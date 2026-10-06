// Planos dourados: para cada um dos 20 perfis, congela a saída completa do Motor V2 numa data fixa
// (semana 1 + todas as semanas seguintes do bloco). Qualquer mudança no motor que altere um plano faz este teste
// falhar; "npm run comparar" mostra o que mudou, perfil por perfil.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');

// Resumo estável de uma semana (sem ids, só o que o atleta recebe).
function resumoSemana(w) {
  if (!w) return null;
  return {
    weekNumber: w.weekNumber, phaseLabel: w.phaseLabel, totalWeeks: w.totalWeeks, pendente: !!w.pendente,
    corrida: (w.corridaWeek || []).map(c => ({ day: c.day, type: c.type, sessao: c.sessao, totalKm: c.totalKm, totalMin: c.totalMin, chave: !!c.chave,
      steps: (c.steps || []).map(s => ({ name: s.name, km: s.km, pace: s.pace, zona: s.zona, tipo: s.tipo, metaSeg: s.metaSeg })) })),
    musc: Object.fromEntries(Object.entries(w.muscPlan || {}).map(([d, l]) => [d, l.map(e => ({ nome: e.nome, grupo: e.grupo, series: e.series, reps: e.reps, carga: e.carga, descanso: e.descanso, tier: e.tier, sessao: e.sessao }))])),
    legEasingNotes: w.legEasingNotes || [],
  };
}

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'gerarPlanoSemanal', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2']);
  const S = T.state;
  for (const [nome, R0] of PERFIS) {
    const chave = 'plano-' + nome.slice(0, 2);
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null;
    S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar({ ...BASE, ...R0 });
    let r;
    try { r = T.gerarPlanoSemanal(S.athleteProfile); } catch (e) { ok(false, nome + ': erro no motor ' + e.message); continue; }
    const semana1 = r.bloqueado ? { bloqueado: true, status: r.status, motivo: r.motivo } : {
      capacidade: r.capacidade, prioridade: r.prioridade, confianca: r.confianca, calibracao: r.calibracao,
      resumo: r.resumo, sched: r.sched, dayPicks: r.dayPicks, descanso: r.descanso, alertas: r.alertas, ajustes: r.ajustes,
      validacao: r.validacao, progressoes: r.progressoes, trajetoria: r.trajetoria,
      sessoes: r.sessoes, cortes: r.cortes, descartadas: r.descartadas,
      semana: resumoSemana(r.semana), decisoes: r.decisoes,
    };
    // Bloco inteiro: cria o plano como o app faz e gera cada semana seguinte.
    let bloco = null;
    if (!r.bloqueado) {
      try {
        await T.gerarPrimeiroPlanoV2();
        const hp = S.hybridPlanData;
        bloco = { totalWeeks: hp.totalWeeks, sched: hp.sched, dayPicks: hp.dayPicks, semanas: [resumoSemana(hp.plan[0])] };
        for (let n = 2; n <= hp.plan.length; n++) bloco.semanas.push(resumoSemana(T.gerarSemanaV2(n)));
      } catch (e) { ok(false, nome + ': erro ao gerar o bloco ' + e.message); }
    }
    conferir(chave, { perfil: nome, semana1, bloco });
  }
  semErro();
  process.exit(process.exitCode || 0);
})();
