// Número da semana na geração (P1) e aviso de treino forte removido pelo ajuste da agenda (parte informativa da P6),
// aprovados em 08/10/2026 (docs/auditoria-motor-2026-10-08.md).
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const QUAL = /Intervalado|Limiar/;

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'gerarPlanoSemanal',
    'renderTreinoV2Content', 'HB_INTERVALO_VARIANTS', 'HB_TEMPO_VARIANTS']);
  const S = T.state;
  const preparar = async (n) => {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar(perfil(n)); await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData, semanas = [];
    for (let k = 1; k <= hp.plan.length; k++) { const w = T.gerarSemanaV2(k); if (w) hp.plan[k - 1] = w; semanas.push(w); }
    return semanas;
  };
  const qualidade = (w) => (w && w.corridaWeek || []).find(c => QUAL.test(c.type));

  // 1. Defeito: a sessão de qualidade era a mesma nas 8 semanas porque o contexto ficava na semana 1.
  const s08 = await preparar('08');
  const q08 = s08.map(qualidade);
  ok(q08.every(Boolean), '08: todas as semanas têm a sessão de tiro');
  const metros08 = q08.map(q => +(/× (\d+)m/.exec(q.mainDesc) || [])[1]);
  const esperado10k = s08.map((w, i) => T.HB_INTERVALO_VARIANTS[10][i % 4].m);
  ok(JSON.stringify(metros08) === JSON.stringify(esperado10k), '08: o tiro segue a variante da semana (' + metros08.join(', ') + ')');
  ok(new Set(q08.map(q => q.mainDesc)).size >= 3, '08: o tiro muda ao longo do plano');

  const s03 = await preparar('03');
  const q03 = s03.map(qualidade);
  ok(q03.every(Boolean) && new Set(q03.map(q => q.mainDesc)).size >= 3, '03: o limiar muda ao longo do plano');

  // 2. Semana gerada fora do plano (sem alvo) continua na semana 1, como antes.
  const solta = T.gerarPlanoSemanal(S.athleteProfile, {});
  ok(qualidade(solta.semana) && qualidade(solta.semana).mainDesc === q03[0].mainDesc, 'sem alvo da semana, usa a variante da semana 1');

  // 3. Segurança preservada: quem não tinha treino forte continua sem, e trote/caminhada continua trote/caminhada.
  for (const n of ['01', '02', '05', '06', '11', '15', '17', '18']) {
    const ss = await preparar(n);
    ok(!ss.some(qualidade), n + ': continua sem treino forte nas 8 semanas');
  }
  const s05 = await preparar('05');
  ok(s05.every(w => w.corridaWeek.every(c => /trote \+ .*caminhada/.test(c.mainDesc))), '05: retorno segue em trote/caminhada');

  // 4. Aviso: o ajuste da agenda removeu o treino forte (19 e 20) e o usuário vê o motivo na aba Treino.
  for (const n of ['19', '20']) {
    const ss = await preparar(n);
    const w1 = S.hybridPlanData.plan[0];
    ok(!qualidade(w1) && w1.avisoQualidade && w1.avisoQualidade.motivo === 'agenda' && w1.avisoQualidade.texto, n + ': semana sem treino forte guarda o motivo');
    ok(ss.every(w => !qualidade(w) === !!(w && w.avisoQualidade)), n + ': aviso só nas semanas em que o treino forte saiu');
    S.weekOffset = 0; S.treinosSubTab = 'corrida';
    const html = T.renderTreinoV2Content();
    ok(html.includes(w1.avisoQualidade.texto), n + ': aba Treino mostra o motivo');
  }

  // 5. Sem aviso quando o treino forte nunca foi permitido (segurança) ou quando ele ficou na semana.
  for (const n of ['01', '15', '18', '08']) {
    const ss = await preparar(n);
    ok(ss.every(w => !w.avisoQualidade), n + ': sem aviso de treino forte removido pela agenda');
  }

  // 6. Corte de dose ligado por uma sessão que saiu da semana é revisto (perfil 20, semana 4 de descarga).
  await preparar('20');
  const tr20 = S.hybridPlanData.trajetoria;
  const r20 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: tr20[3] });
  const r20sem1 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: { ...tr20[3], semana: 1 } });
  const mins = (r) => r.semana.corridaWeek.map(c => c.day + c.totalMin).join(',');
  ok(r20.ajustes.volumeFator === 1 && !r20.ajustes.semProgressao && r20.decisoes.some(d => d.regra === 'corte_revisto'), '20 S4: corte de volume revisto com as sessões que ficaram');
  ok(mins(r20) === mins(r20sem1), '20 S4: volume não depende do tiro que saiu (' + mins(r20) + ')');
  ok(r20.ajustes.semQualidade && !qualidade(r20.semana), '20 S4: o treino forte continua fora');
  // Corte ainda justificado fica (06, semana 4) e o corte vindo do check-in nunca é desfeito.
  await preparar('06');
  const r06 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: S.hybridPlanData.trajetoria[3] });
  ok(r06.ajustes.volumeFator < 1 && !r06.decisoes.some(d => d.regra === 'corte_revisto' && d.dados.ajuste === 'volumeFator'), '06 S4: corte de volume necessário continua');
  await preparar('08');
  const r08 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: S.hybridPlanData.trajetoria[1], ajustesIniciais: { volumeFator: 0.9, semProgressao: true } });
  ok(r08.ajustes.volumeFator <= 0.9 && r08.ajustes.semProgressao, '08: corte do check-in não é revisto');

  // 7. Perfil 07, semana 4: o limite de volume mede contra o volume planejado, não contra o corte da própria correção.
  await preparar('07');
  const tr07 = S.hybridPlanData.trajetoria;
  const r07 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: tr07[3] });
  const r07s3 = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: tr07[2] });
  const longao = (r) => Math.max(...r.semana.corridaWeek.filter(c => c.type === 'Longão').map(c => c.totalMin));
  ok(!r07.decisoes.some(d => d.regra === 'reducao_forcada'), '07 S4: sem redução forçada');
  ok(Object.keys(r07.semana.muscPlan).length === Object.keys(r07s3.semana.muscPlan).length, '07 S4: a musculação da semana continua');
  ok(longao(r07) <= longao(r07s3), `07 S4: longão da descarga (${longao(r07)}′) não passa o da semana 3 (${longao(r07s3)}′)`);
  const tot = (r) => r.semana.corridaWeek.reduce((t, c) => t + c.totalMin, 0);
  ok(tot(r07) <= tr07[3].corridaMinAlvo * 1.1 + 2 && tot(r07) < tot(r07s3), `07 S4: volume dentro do alvo de descarga (${tot(r07)} de ${tr07[3].corridaMinAlvo} min)`);
  // check-in pedindo redução: o limite acompanha o pedido
  const r07ck = T.gerarPlanoSemanal(S.athleteProfile, { alvoSemana: tr07[2], ajustesIniciais: { volumeFator: 0.8 } });
  ok(tot(r07ck) <= tr07[2].corridaMinAlvo * 0.8 * 1.1 + 2, '07: com check-in de −20% a semana respeita o volume reduzido');

  semErro();
})();
