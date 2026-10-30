// Variação local da corrida (sem IA): varia de verdade, passa nos mesmos validadores e não mexe na musculação.
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, PERFIS } = require('../harness/ia.js');
const { BASE } = require('../harness/perfis.js');

(async () => {
  const T = await carregarAppComIA(['gerarSemanaV2', 'gerarPrimeiroPlanoV2']);
  const S = T.state;
  const assinatura = (w) => (w.corridaWeek || []).map(c => c.day + ':' + c.type + ':' + c.totalKm + ':' + (c.mainDesc || '') + ':' + (c.steps || []).map(s => s.name).join('/')).join('|');
  const musc = (w) => JSON.stringify(Object.fromEntries(Object.entries(w.muscPlan || {}).map(([d, l]) => [d, l.map(e => [e.nome, e.papel, String(e.series), String(e.reps), e.rpe, e.descanso])])));
  let variadas = 0, total = 0, muscMudou = 0, perfisQueVariam = 0;
  for (const [nome, R0] of PERFIS) {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.equipItens = null; S.corridaVdotData = null;
    await T.qv2Aplicar({ ...BASE, ...R0 });
    try { await T.gerarPrimeiroPlanoV2(); } catch (e) { continue; }
    const hp = S.hybridPlanData; if (!hp || !hp.plan) continue;
    const vistas = new Set(); let variouPerfil = false;
    for (let n = 1; n <= Math.min(8, hp.plan.length); n++) {
      const w = n === 1 ? hp.plan[0] : T.gerarSemanaV2(n);
      const antes = JSON.stringify(w);
      const r = T.iaVariarSemanaLocal({ perfil: S.athleteProfile, opcoes: { alvoSemana: (hp.trajetoria || [])[n - 1] || null }, semanaMotor: w });
      total++;
      ok(JSON.stringify(w) === antes, `${nome.slice(0, 2)} s${n}: a semana do motor nunca é alterada no lugar`);
      if (r.origem !== 'local') { ok(r.semana === w, `${nome.slice(0, 2)} s${n}: sem variação segura (${r.motivo}) devolve a semana do motor`); continue; }
      variadas++; variouPerfil = true; vistas.add(assinatura(r.semana));
      if (musc(r.semana) !== musc(w)) muscMudou++;
    }
    if (variouPerfil) perfisQueVariam++;
  }
  ok(variadas >= 25, `variação local: ${variadas} de ${total} semanas variadas (corredores com nível e prontidão para isso)`);
  ok(perfisQueVariam >= 6, `variação local: ${perfisQueVariam} perfis recebem variação`);
  ok(muscMudou === 0, 'variação local: a musculação não é alterada');

  // descarga e calibração nunca variam
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar({ ...BASE, ...PERFIS.find(p => p[0].startsWith('08'))[1] });
  await T.gerarPrimeiroPlanoV2();
  const hp = S.hybridPlanData;
  const desc = T.gerarSemanaV2(4);
  ok(/descarga/i.test(desc.phaseLabel), 'perfil 08: semana 4 é de descarga');
  ok(T.iaVariarSemanaLocal({ perfil: S.athleteProfile, opcoes: { alvoSemana: (hp.trajetoria || [])[3] || null }, semanaMotor: desc }).origem === 'motor', 'descarga: não varia');
  // semanas seguidas diferem entre si
  const a = T.iaVariarSemanaLocal({ perfil: S.athleteProfile, opcoes: { alvoSemana: (hp.trajetoria || [])[4] || null }, semanaMotor: T.gerarSemanaV2(5) });
  const b = T.iaVariarSemanaLocal({ perfil: S.athleteProfile, opcoes: { alvoSemana: (hp.trajetoria || [])[5] || null }, semanaMotor: T.gerarSemanaV2(6) });
  ok(a.origem === 'local' && b.origem === 'local' && assinatura(a.semana) !== assinatura(b.semana), 'perfil 08: semanas 5 e 6 têm corridas diferentes');
  semErro();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error("ERRO " + e.stack); process.exitCode = 1; });
