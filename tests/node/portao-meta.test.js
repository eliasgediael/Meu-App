// Portão de meta (Etapa 3): viabilidade da meta no retorno do plano. Só motor, sem tela; o plano gerado não muda por causa dela.
// Só usa ok() (nunca snapshot). Hoje congelado = segunda 05/10/2026.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { BASE, D7 } = require('../harness/perfis.js');

const DIAS = { Ter: { on: true, min: 60 }, Qui: { on: true, min: 60 }, Sáb: { on: true, min: 60 }, Dom: { on: true, min: 200 } };
const MARATONA_INIC = { obj: 'prova', dist: 42.195, data: '2027-01-21', semData: false, cSit: 'regular', cExp: '3-6m', cFreq: 2, cMaior: '5', mSit: 'nunca', local: 'academia', dias: DIAS };
const DEZ_K = { obj: 'prova', dist: 10, data: '2026-12-24', semData: false, cSit: 'regular', cExp: '1-3a', cFreq: 4, cMaior: '14', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qui', 'Sáb', 'Dom']) };
// 4 semanas reais crescentes (≈ 98 min por semana): 3 corridas por semana, o longão no domingo.
const HIST = [['2026-09-08', 25], ['2026-09-10', 25], ['2026-09-13', 40], ['2026-09-15', 25], ['2026-09-17', 25], ['2026-09-20', 45],
  ['2026-09-22', 25], ['2026-09-24', 25], ['2026-09-27', 50], ['2026-09-29', 25], ['2026-10-01', 25], ['2026-10-04', 55]];
function progresso(lista) { const o = {}; lista.forEach(([d, m], i) => { o['r' + i] = { done: true, data: d, tempo: m + ':00', km: String(Math.round(m / 6.5)) }; }); return o; }
const ORDEM = { sim: 0, apertado: 1, nao: 2 };

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'gerarPlanoSemanal', 'motorViabilidadeMeta']);
  const S = T.state;
  async function gerar(R, hist) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    S.corridaProgress = hist ? progresso(hist) : {}; S.atividadesLivres = [];
    await T.qv2Aplicar({ ...BASE, ...R });
    const r = await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData;
    return { r, hp };
  }

  // iniciante com ~98 min/semana (histórico real) em maratona de 16 semanas: não cabe
  {
    const { r, hp } = await gerar(MARATONA_INIC, HIST);
    const v = r.viabilidade;
    ok(hp.plan.length === 16, 'maratona iniciante: plano de 16 semanas');
    ok(v && v.projecao.volumeAtualMin === 98, 'iniciante parte de 98 min/semana (veio ' + (v && v.projecao.volumeAtualMin) + ')');
    ok(v && (v.viavel === 'nao' || v.viavel === 'apertado'), 'iniciante, 98 min/semana, maratona em 16 semanas: nao ou apertado (veio ' + (v && v.viavel) + ')');
    ok(v && typeof v.motivo === 'string' && v.motivo.length > 20, 'traz o motivo: ' + (v && v.motivo));
    ok(v && v.alternativa && ['mais_semanas', 'distancia_menor'].includes(v.alternativa.tipo), 'traz alternativa: ' + (v && v.alternativa && v.alternativa.texto));
    // a alternativa sugerida de fato resolve
    if (v && v.alternativa) {
      const e = { distanciaKm: v.projecao.distanciaKm, nivel: v.projecao.nivel, volumeMin: v.projecao.volumeAtualMin, longoMin: v.projecao.longoAtualMin, freq: 2, semanas: v.projecao.semanas, calibracao: false };
      const alt = v.alternativa.tipo === 'mais_semanas' ? { ...e, semanas: v.alternativa.semanas } : { ...e, distanciaKm: v.alternativa.distanciaKm };
      const r2 = T.motorViabilidadeMeta(alt);
      ok(r2.viavel === 'sim', 'a alternativa (' + v.alternativa.tipo + ') daria "sim" (veio ' + r2.viavel + ')');
    }
    // a simulação bate com o que o plano realmente constrói (volume e longão de pico, sem o polimento)
    const picoVolPlano = Math.max(...hp.trajetoria.filter(t => t.fase !== 'Polimento').map(t => t.corridaMinAlvo));
    const semanas = [hp.plan[0]]; for (let n = 2; n <= hp.plan.length; n++) { const w = T.gerarSemanaV2(n); hp.plan[n - 1] = w; semanas.push(w); }
    const picoLongoPlano = Math.max(...semanas.map(w => Math.max(0, ...(w.corridaWeek || []).filter(c => c.type === 'Longão').map(c => c.totalMin))));
    ok(Math.abs(v.projecao.volumePicoMin - picoVolPlano) <= picoVolPlano * 0.05, 'volume de pico projetado (' + v.projecao.volumePicoMin + ') ≈ do plano (' + picoVolPlano + ')');
    ok(Math.abs(v.projecao.longoPicoMin - picoLongoPlano) <= picoLongoPlano * 0.1, 'longão de pico projetado (' + v.projecao.longoPicoMin + ') ≈ do plano (' + picoLongoPlano + ')');
  }

  // intermediário em 10K com base boa: sim, sem alternativa
  {
    const { r } = await gerar(DEZ_K);
    const v = r.viabilidade;
    ok(v && v.viavel === 'sim' && v.alternativa === null, 'intermediário, 10K, base boa: sim e sem alternativa (veio ' + (v && v.viavel) + ')');
    ok(v && v.projecao.nivel === 'intermediario' && v.projecao.longoPicoMin >= v.projecao.longoNecessarioMin, '10K: longão de pico ' + (v && v.projecao.longoPicoMin) + ' min >= ' + (v && v.projecao.longoNecessarioMin));
  }

  // mais semanas nunca piora; sem data a viabilidade usa o horizonte do plano; objetivo sem prova não tem o campo
  {
    const base = { distanciaKm: 42.195, nivel: 'iniciante', volumeMin: 98, longoMin: 55, freq: 3, calibracao: false };
    let ant = 2, mono = true;
    for (let s = 4; s <= 40; s += 2) { const c = ORDEM[T.motorViabilidadeMeta({ ...base, semanas: s }).viavel]; if (c > ant) mono = false; ant = c; }
    ok(mono, 'mais semanas nunca piora a viabilidade (maratona, iniciante)');
    const longe = T.motorViabilidadeMeta({ ...base, semanas: 52 });
    ok(longe.viavel === 'sim' && longe.alternativa === null, 'com semanas de sobra a maratona fica viável');
    const curto = T.motorViabilidadeMeta({ ...base, distanciaKm: 5, volumeMin: 98, semanas: 8 });
    ok(curto.viavel === 'sim', 'iniciante com 98 min/semana em 5K de 8 semanas: sim');
    const semData = await gerar({ ...MARATONA_INIC, data: '', semData: true }, HIST);
    ok(semData.r.viabilidade && semData.r.viabilidade.projecao.semanas === 8, 'sem data: viabilidade usa as 8 semanas do plano');
    const saude = await gerar({ obj: 'saude', cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '6', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(60, ['Seg', 'Qua', 'Sex']) });
    ok(saude.r.viabilidade === undefined, 'objetivo que não é prova: sem o campo viabilidade');
  }

  // o plano gerado não muda por causa da viabilidade
  {
    const { r, hp } = await gerar(MARATONA_INIC, HIST);
    ok(r.viabilidade && hp.plan.length === 16 && hp.trajetoria.length === 16, 'plano com viabilidade segue com 16 semanas');
    ok(JSON.stringify(hp).indexOf('viabilidade') === -1, 'a viabilidade não é gravada no plano (só no retorno)');
  }
  semErro();
  process.exit(process.exitCode || 0);
})();
