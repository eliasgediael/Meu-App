// Caracterização do Motor V2 (comportamento atual, não julga se está certo):
// regras V1–V10 da validação, correções do motorAjustar, semana 1 parcial em cada dia da semana,
// bloqueio por sinais de alerta e semanas seguintes depois de cada resultado do check-in semanal.
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const copia = (x) => JSON.parse(JSON.stringify(x));
const resumoDias = (w) => w ? {
  fase: w.phaseLabel,
  corrida: (w.corridaWeek || []).map(c => `${c.day}:${c.type}:${c.totalMin}min${c.chave ? '★' : ''}`),
  musc: Object.entries(w.muscPlan || {}).map(([d, l]) => `${d}:${l.length}ex:${l.reduce((t, e) => t + (parseInt(e.series, 10) || 0), 0)}séries`),
} : null;

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'lerEstado', 'definirPrioridade', 'motorConstruir', 'validarPlano', 'motorAjustar',
    'gerarPlanoSemanal', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'aplicarCheckinSemanalV2', 'MOTOR_PARAMS']);
  const S = T.state;
  const preparar = async (R) => { S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {}; await T.qv2Aplicar(R); };

  // ---------- 1. validarPlano: o que cada mutação de uma semana válida dispara ----------
  {
    await preparar(perfil('08'));
    const est = T.lerEstado(S.athleteProfile), prio = T.definirPrioridade(est);
    const aj0 = { reduzir: 0, semQualidade: false, semDobros: false, volumeFator: 1, aliviarInferior: false, semProgressao: false };
    const cons = T.motorConstruir(est, prio, { ...aj0 });
    const validar = (mut) => { const c = copia({ freq: cons.freq, dist: cons.dist, semana: cons.semana }); const e2 = { ...est, equip: { ...est.equip, set: new Set(est.equip.set) } }; mut(c, e2);
      const v = T.validarPlano(e2, prio, c.freq, c.dist, c.semana, { ...aj0 }); return { ok: v.ok, erros: v.erros.map(x => x.cod + ': ' + x.detalhe), avisos: v.avisos.map(x => x.cod) }; };
    const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const r = {
      base: validar(() => {}),
      V2_sessao_maior_que_o_dia: validar((c) => { c.semana.sessoes[0].duracaoMin = 999; }),
      V3_duas_duras_no_mesmo_dia: validar((c) => { const s = c.semana.sessoes.find(x => x.dura); if (s) c.semana.sessoes.push({ ...s, modalidade: 'musculacao', tipo: 'lower', dura: true }); }),
      V4_volume_corrida_triplicado: validar((c) => { c.semana.corridaWeek.forEach(w => { w.totalMin *= 3; }); }),
      V5_corrida_acima_do_teto: validar((c) => { const w = c.semana.corridaWeek[0]; for (let i = 0; i < 4; i++) c.semana.corridaWeek.push({ ...w }); }),
      V6_treino_todos_os_dias: validar((c) => { dias.forEach((d, i) => { if (!c.semana.sessoes.some(s => s.dia === d)) c.semana.sessoes.push({ ...c.semana.sessoes[i % c.semana.sessoes.length], dia: d, dura: false }); }); }),
      V7_sem_equipamento: validar((c, e2) => { e2.equip.set = new Set(['corpo']); }),
      V9_duras_em_dias_seguidos: validar((c) => { const s = c.semana.sessoes.find(x => x.dura); if (s) { const nx = dias[(dias.indexOf(s.dia) + 1) % 7]; c.semana.sessoes.push({ ...s, dia: nx }); } }),
      V10_progressao_sem_justificativa: validar((c) => { c.freq.progressoes = [{ modalidade: 'corrida', justificativa: null }]; }),
    };
    conferir('motor-validar-plano', r);
    ok(r.base.ok, 'semana gerada pelo motor passa na validação');
  }
  {
    await preparar(perfil('15'));
    const est = T.lerEstado(S.athleteProfile), prio = T.definirPrioridade(est);
    const aj0 = { reduzir: 0, semQualidade: false, semDobros: false, volumeFator: 1, aliviarInferior: false, semProgressao: false };
    const cons = T.motorConstruir(est, prio, { ...aj0 });
    const c = copia({ freq: cons.freq, dist: cons.dist, semana: cons.semana });
    const d = Object.keys(c.semana.muscPlan)[0];
    if (d) c.semana.muscPlan[d].push({ nome: 'Agachamento livre com barra', grupo: 'Pernas', series: '3', reps: '8' });
    const v = T.validarPlano(est, prio, c.freq, c.dist, c.semana, { ...aj0 });
    conferir('motor-validar-V1-dor-joelho', { erros: v.erros.map(x => x.cod + ': ' + x.detalhe) });
  }

  // ---------- 2. motorAjustar: correção aplicada para cada código ----------
  {
    const base = { reduzir: 0, semQualidade: false, semDobros: false, volumeFator: 1, aliviarInferior: false, semProgressao: false };
    const out = {};
    ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'].forEach(cod => { out[cod] = T.motorAjustar(base, [{ cod }]); });
    out.V6_segunda_vez = T.motorAjustar({ ...base, aliviarInferior: true }, [{ cod: 'V6' }]);
    out.V9_terceira_vez = T.motorAjustar({ ...base, aliviarInferior: true, semQualidade: true }, [{ cod: 'V9' }]);
    conferir('motor-ajustar', out);
  }

  // ---------- 3. Semana 1 parcial: plano criado em cada dia da semana ----------
  {
    const out = {};
    for (const n of ['01', '08', '09']) {
      out[n] = {};
      for (let i = 0; i < 7; i++) {
        H.congelarRelogio(new Date(`2026-10-${String(5 + i).padStart(2, '0')}T10:00:00-03:00`).getTime());
        await preparar(perfil(n));
        try { await T.gerarPrimeiroPlanoV2(); out[n]['dia' + i] = { inicio: S.hybridPlanData.inicioPlano, semana1: resumoDias(S.hybridPlanData.plan[0]) }; }
        catch (e) { out[n]['dia' + i] = 'erro: ' + e.message; }
      }
    }
    H.congelarRelogio('2026-10-05T10:00:00-03:00');
    conferir('motor-semana-parcial', out);
  }

  // ---------- 4. Sinais de alerta e modo conservador ----------
  {
    const out = {};
    for (const [nome, extra] of [['sintomas_esforco', { alertasOk: true, alertas: ['sintomas_esforco'] }], ['gestacao', { alertasOk: true, alertas: ['gestacao_pos_parto'] }],
      ['cirurgia', { alertasOk: true, alertas: ['cirurgia_recente'] }], ['orientacao_profissional', { alertasOk: true, alertas: ['orientacao_profissional'], orient: ['evitar_impacto'] }],
      ['nao_respondeu', { alertasOk: false, alertas: [] }]]) {
      await preparar({ ...perfil('08'), ...extra });
      const r = T.gerarPlanoSemanal(S.athleteProfile);
      out[nome] = r.bloqueado ? { bloqueado: true, status: r.status, motivo: r.motivo } : { bloqueado: false, alertas: r.alertas, ajustes: r.ajustes, semana: resumoDias(r.semana) };
    }
    conferir('motor-alertas-e-cautela', out);
  }

  // ---------- 5. Check-in semanal → ajuste da próxima semana → semana 2 gerada ----------
  {
    await preparar(perfil('08'));
    await T.gerarPrimeiroPlanoV2();
    const hp0 = copia(S.hybridPlanData);
    const out = {};
    for (const fadiga of [1, 2, 3, 4, 5]) for (const dor of [false, true]) for (const resposta of ['facil', 'normal', 'dificil']) {
      const hp = T.aplicarCheckinSemanalV2(copia(hp0), 1, { fadiga, dor, motivos: [] }, resposta);
      S.hybridPlanData = hp;
      out[`fadiga${fadiga}-dor${dor ? 'sim' : 'nao'}-${resposta}`] = { ajuste: hp.ajusteProximaSemana, semana2: resumoDias(T.gerarSemanaV2(2)) };
    }
    S.hybridPlanData = hp0;
    conferir('motor-checkin-semanal', out);
  }

  ok(T.MOTOR_PARAMS.passoSemanal === 0.08, 'baseline preservado: progressão de corrida +8% por semana');
  {
    await preparar(perfil('08'));
    const r = await T.gerarPrimeiroPlanoV2();
    ok(/^2\./.test(r.engineVersion || ''), 'Passo 1: saída do motor registra engineVersion');
    ok(Array.isArray(r.decisoes) && r.validacao && typeof r.validacao.ok === 'boolean', 'Passo 1: saída do motor registra decisões e validação');
    ok(S.hybridPlanData.engineVersion === r.engineVersion && Array.isArray(S.hybridPlanData.decisoes) && S.hybridPlanData.validacao, 'Passo 1: semana salva preserva versão, decisões e validação');
  }
  semErro();
  process.exit(process.exitCode || 0);
})();
