// Histórico real de corrida no Motor V2 (Etapa 1): longão e volume passam a depender do que foi feito.
// Sem histórico o motor é idêntico ao anterior. Só usa ok() (nunca snapshot).
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { BASE, D7 } = require('../harness/perfis.js');

const DIAS = { Ter: { on: true, min: 60 }, Qui: { on: true, min: 60 }, Sáb: { on: true, min: 60 }, Dom: { on: true, min: 200 } };
const MARATONA_INIC = { obj: 'prova', dist: 42.195, data: '2027-01-28', semData: false, cSit: 'regular', cExp: '3-6m', cFreq: 2, cMaior: '5', mSit: 'nunca', local: 'academia', dias: DIAS };
// 4 semanas reais crescentes (min): 3 corridas por semana, o longão no domingo.
const HIST = [['2026-09-08', 25], ['2026-09-10', 25], ['2026-09-13', 40], ['2026-09-15', 25], ['2026-09-17', 25], ['2026-09-20', 45],
  ['2026-09-22', 25], ['2026-09-24', 25], ['2026-09-27', 50], ['2026-09-29', 25], ['2026-10-01', 25], ['2026-10-04', 55]];
function progresso(lista) { const o = {}; lista.forEach(([d, m], i) => { o['r' + i] = { done: true, data: d, tempo: m + ':00', km: String(Math.round(m / 6.5)) }; }); return o; }
const longo = w => Math.max(0, ...((w && w.corridaWeek) || []).filter(c => c.type === 'Longão').map(c => c.totalMin || 0));
const longoKm = w => Math.max(0, ...((w && w.corridaWeek) || []).filter(c => c.type === 'Longão').map(c => c.totalKm || 0));
const HOJE = new Date('2026-10-05T10:00:00-03:00');

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'historicoCorridaReal']);
  const S = T.state;
  async function gerar(R, hist) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    S.corridaProgress = hist ? progresso(hist) : {}; S.atividadesLivres = [];
    await T.qv2Aplicar({ ...BASE, ...R });
    await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData; const semanas = [hp.plan[0]];
    for (let n = 2; n <= hp.plan.length; n++) { const w = T.gerarSemanaV2(n); hp.plan[n - 1] = w; semanas.push(w); }
    return { hp, semanas, fases: hp.trajetoria.map(t => t.fase) };
  }
  const resumo = g => JSON.stringify(g.semanas.map(w => w.corridaWeek.map(c => [c.day, c.type, c.totalKm, c.totalMin])));

  // 1. função pura
  ok(T.historicoCorridaReal({}, [], HOJE) === null, 'sem registros: histórico nulo');
  ok(T.historicoCorridaReal(progresso(HIST.slice(0, 2)), [], HOJE) === null, 'menos de 3 registros: histórico nulo');
  const h = T.historicoCorridaReal(progresso(HIST), [], HOJE);
  ok(h && h.maiorMin30d === 55 && h.minutosSemana === 98 && h.semanas >= 2, 'histórico: 98 min/semana e maior corrida 55 min (' + JSON.stringify(h) + ')');
  const comCam = T.historicoCorridaReal(progresso(HIST), [{ data: '2026-10-02', tipo: 'caminhada', tempoSeg: 6000 }], HOJE);
  ok(comCam && comCam.maiorMin30d === 55 && comCam.minutosSemana === 98, 'caminhada não entra no histórico');
  const semReg = progresso(HIST); semReg.x = { done: true, data: '2026-10-03' };
  ok(T.historicoCorridaReal(semReg, [], HOJE).registros === 12, 'concluído sem registro não conta');

  // 2. iniciante em maratona, 16 semanas, histórico crescente
  const sem = await gerar(MARATONA_INIC, null);
  const com = await gerar(MARATONA_INIC, HIST);
  ok(com.hp.totalWeeks === 16, 'plano de 16 semanas');
  const lk = com.semanas.map(longoKm), lm = com.semanas.map(longo), lk0 = sem.semanas.map(longoKm);
  console.log('INFO longão sem histórico (km): ' + lk0.join(' '));
  console.log('INFO longão com histórico (km): ' + lk.join(' '));
  console.log('INFO longão com histórico (min): ' + lm.join(' '));
  console.log('INFO fases: ' + com.fases.join(','));
  console.log('INFO alvo semanal (min): ' + com.hp.trajetoria.map(t => t.corridaMinAlvo).join(' '));
  ok(lm[0] <= Math.round(55 * 1.15) + 3, 'semana 1: longão <= 115% da maior corrida dos 30 dias (' + lm[0] + ' min)');
  let refOk = true, detalhe = '';
  for (let n = 2; n <= 16; n++) {
    let ref = 0; for (let k = n - 1; k >= 1; k--) { if (com.fases[k - 1] === 'Descarga') continue; if (lm[k - 1] > 0) { ref = lm[k - 1]; break; } }
    const teto = (com.fases[n - 1] === 'Descarga' ? 0.8 : 1.15) * ref + 3;
    if (lm[n - 1] > teto) { refOk = false; detalhe += ' S' + n + ':' + lm[n - 1] + '>' + Math.round(teto); }
  }
  ok(refOk, 'da semana 2 em diante: longão <= 115% do longão anterior do plano (80% na semana de alívio)' + detalhe);
  const pico = Math.max(...lk);
  ok(pico > 11.5, 'longão passa de 11,5 km (pico ' + pico + ' km)');
  ok(pico > Math.max(...lk0), 'longão com histórico supera o sem histórico (' + pico + ' > ' + Math.max(...lk0) + ')');
  ok(com.fases.every((f, i) => f !== 'Descarga' || lm[i] < lm[i - 1]), 'semana de alívio (4ª do ciclo 3:1) tem longão menor que a anterior');
  ok(com.semanas.every(w => w && !w.pendente && (w.corridaWeek || []).length > 0), 'todas as semanas geradas com corrida');
  const alvos = com.hp.trajetoria.map(t => t.corridaMinAlvo);
  ok(Math.max(...alvos) <= 300, 'volume alvo respeita o teto da maratona do iniciante (300 min): ' + Math.max(...alvos));

  // 3. sem histórico (ou insuficiente): idêntico
  const outra = await gerar(MARATONA_INIC, HIST.slice(0, 2));
  ok(resumo(sem) === resumo(outra), 'histórico insuficiente: plano idêntico ao sem histórico');
  const i10 = { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 4, cMaior: '12', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) };
  const a = await gerar(i10, null), b = await gerar(i10, []);
  ok(resumo(a) === resumo(b), 'intermediário 10K sem histórico: igual');

  // 4. dor ativa e sono reduzido: o histórico não sobe nada
  const dor = { ...MARATONA_INIC, dor: true, dorRegioes: ['joelho'], dorInt: 'moderada', dorRep: false };
  const dorSem = await gerar(dor, null), dorCom = await gerar(dor, HIST);
  ok(resumo(dorSem) === resumo(dorCom), 'dor moderada no joelho: plano igual com e sem histórico (' + dorCom.semanas.map(longo).join(' ') + ')');
  const sono = { ...MARATONA_INIC, sono: 'menos6' };
  const sonoSem = await gerar(sono, null), sonoCom = await gerar(sono, HIST);
  ok(resumo(sonoSem) === resumo(sonoCom), 'sono menor que 6 h: plano igual com e sem histórico');
  semErro();
  process.exit(process.exitCode || 0);
})();
