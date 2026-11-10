// Histórico curto de corrida (2 ou 3 semanas): a média por semana divide pelas semanas que o histórico cobre (2 a 4),
// e com histórico válido a semana não fica com uma corrida só quando a carga já cobre 2 sessões mínimas.
// Só usa ok() (nunca snapshot). Hoje congelado = segunda 05/10/2026.
const crypto = require('crypto');
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { BASE, D7 } = require('../harness/perfis.js');

const DEZ_K = { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qui', 'Sáb', 'Dom']) };
// 4 corridas em 2 semanas (145 min), a maior de 50 min.
const HIST2 = [['2026-09-21', 30], ['2026-09-24', 35], ['2026-09-29', 30], ['2026-10-03', 50]];
const HIST3 = [['2026-09-14', 30], ['2026-09-17', 35], ['2026-09-22', 30], ['2026-09-24', 30], ['2026-09-29', 30], ['2026-10-03', 50]];
const HOJE = new Date('2026-10-05T10:00:00-03:00');
// Hash do plano completo (plan + trajetoria, sem os ids, que vêm do relógio real) do perfil DEZ_K sem histórico,
// calculado no commit 63cdcfc (antes desta correção).
const HASH_SEM_HISTORICO = 'c5d475cbff6570b1a837fb82f412e5fc20c10792404518f9576063816d6f52b6';
function progresso(lista) { const o = {}; lista.forEach(([d, m], i) => { o['r' + i] = { done: true, data: d, tempo: m + ':00', km: String(Math.round(m / 6.5)) }; }); return o; }
const longoDe = w => Math.max(0, ...((w && w.corridaWeek) || []).filter(c => c.type === 'Longão').map(c => c.totalMin || 0));

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'historicoCorridaReal']);
  const S = T.state;
  async function gerar(R, hist) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    S.corridaProgress = hist ? progresso(hist) : {}; S.atividadesLivres = [];
    await T.qv2Aplicar({ ...BASE, ...R });
    const r = await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData; const semanas = [hp.plan[0]];
    for (let n = 2; n <= hp.plan.length; n++) { const w = T.gerarSemanaV2(n); hp.plan[n - 1] = w; semanas.push(w); }
    return { r, hp, semanas };
  }

  // função pura: divide pelas semanas cobertas
  const h2 = T.historicoCorridaReal(progresso(HIST2), [], HOJE);
  ok(h2 && h2.semanasCobertas === 2 && h2.minutosSemana === 73, '2 semanas de histórico: 145 / 2 = 73 min/semana (veio ' + JSON.stringify(h2) + ')');
  const h3 = T.historicoCorridaReal(progresso(HIST3), [], HOJE);
  ok(h3 && h3.semanasCobertas === 3 && h3.minutosSemana === Math.round(205 / 3), '3 semanas de histórico: 205 / 3 (veio ' + JSON.stringify(h3) + ')');
  // semana atual com corrida registrada conta como semana coberta
  const h2b = T.historicoCorridaReal(progresso([...HIST2, ['2026-10-05', 30]]), [], HOJE);
  ok(h2b && h2b.semanasCobertas === 3 && h2b.minutosSemana === Math.round(175 / 3), 'semana atual com corrida entra na conta (veio ' + JSON.stringify(h2b) + ')');
  // mínimo 2 e máximo 4
  const h1 = T.historicoCorridaReal(progresso([['2026-10-01', 30], ['2026-10-02', 30], ['2026-10-03', 30]]), [], HOJE);
  ok(h1 === null, 'só 1 semana de histórico: continua nulo (precisa de 2 semanas)');

  // o cenário: intermediário em 10K, 4 corridas em 2 semanas, maior de 50 min
  const g = await gerar(DEZ_K, HIST2);
  const est = g.r.estado.corrida;
  ok(est.carga.fonte === 'minutos_observados' && Math.abs(est.carga.min - 72) <= 3, 'carga inicial perto de 72 min/semana (veio ' + est.carga.min + ')');
  const fases = g.hp.trajetoria.map(t => t.fase);
  g.semanas.forEach((w, i) => {
    const n = w.corridaWeek.length;
    ok(n >= 2, 'semana ' + (i + 1) + ' (' + fases[i] + '): pelo menos 2 corridas (veio ' + n + ')');
    if (fases[i] !== 'Descarga') ok(longoDe(w) > 0, 'semana ' + (i + 1) + ' (' + fases[i] + '): tem longão (' + longoDe(w) + ' min)');
  });
  ok(longoDe(g.semanas[0]) > 0 && longoDe(g.semanas[0]) <= Math.floor(50 * 1.15 + 0.5) + 1, 'semana 1: longão ' + longoDe(g.semanas[0]) + ' min não passa de 115% da maior corrida (50 min = 57,5 min)');
  const w1max = Math.max(...g.semanas[0].corridaWeek.map(c => c.totalMin || 0));
  ok(w1max <= 57.5 + 1, 'semana 1: nenhuma corrida passa de 115% da maior (' + w1max + ' min)');

  // sem histórico o plano é idêntico ao de antes (hash do plano completo sem os ids)
  const s = await gerar(DEZ_K, null);
  const limpo = JSON.stringify({ plan: s.hp.plan, trajetoria: s.hp.trajetoria }).replace(/"id":"[a-z0-9]+",?/g, '');
  const hash = crypto.createHash('sha256').update(limpo).digest('hex');
  
  ok(hash === HASH_SEM_HISTORICO, 'sem histórico: plano idêntico ao anterior (hash ' + hash.slice(0, 12) + ')');
  semErro();
  process.exit(process.exitCode || 0);
})();
