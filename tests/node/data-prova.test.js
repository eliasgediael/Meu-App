// Data da prova (Etapa 2): o plano se alinha à data. Hoje congelado = segunda 05/10/2026.
// Cobre 5K, 10K, meia e maratona, prova a 3, 8, 16 e 30 semanas em dias diferentes da semana e datas inválidas.
// Só usa ok() (nunca snapshot). Sem data válida no futuro o plano não pode mudar.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { BASE, D7 } = require('../harness/perfis.js');

const TODOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const SEG0 = new Date(2026, 9, 5);   // segunda-feira de hoje
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Prova que cai na semana N (contando a de hoje como 1), no dia k da semana (0 = segunda).
const dataProva = (semanas, k) => iso(somaDias(SEG0, (semanas - 1) * 7 + k));
const perfil = (dist, data, extra) => ({ obj: 'prova', dist, data, semData: !data, cSit: 'regular', cExp: '1-3a', cFreq: 4, cMaior: dist >= 21 ? '16' : '12',
  mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(75, TODOS), ...(extra || {}) });
const POLIMENTO = { 5: 1, 10: 1, 21.0975: 2, 42.195: 3 };

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'gerarPlanoSemanal', 'predictRaceTimeSec', 'formatPace']);
  const S = T.state;
  async function gerar(R) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {};
    S.corridaProgress = {}; S.atividadesLivres = [];
    await T.qv2Aplicar({ ...BASE, ...R });
    const r = await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData; const semanas = [hp.plan[0]];
    for (let n = 2; n <= hp.plan.length; n++) { const w = T.gerarSemanaV2(n); hp.plan[n - 1] = w; semanas.push(w); }
    return { r, hp, semanas };
  }
  const idx = d => TODOS.indexOf(d);
  const provas = semanas => semanas.flatMap((w, i) => ((w && w.corridaWeek) || []).filter(c => c.type === 'Prova').map(c => ({ semana: i + 1, c })));

  // ---- datas válidas: 4 distâncias × 4 prazos, cada combinação com a prova num dia diferente da semana ----
  let k = 0;
  for (const dist of [5, 10, 21.0975, 42.195]) {
    for (const sem of [3, 8, 16, 30]) {
      const diaK = (k++ * 2 + (dist === 5 ? 0 : 1)) % 7;
      const data = dataProva(sem, diaK);
      const nome = dist + ' km, ' + sem + ' sem, ' + TODOS[diaK] + ' ' + data;
      let g;
      try { g = await gerar(perfil(dist, data)); } catch (e) { ok(false, nome + ': erro ' + e.message); continue; }
      const { r, hp, semanas } = g;
      const esperado = sem < 4 ? sem : Math.min(sem, 24);
      ok(!r.bloqueado, nome + ': plano gerado');
      ok(hp.plan.length === esperado && hp.totalWeeks === esperado, nome + ': semanas do plano = ' + esperado + ' (veio ' + hp.plan.length + ')');
      ok(r.prova && r.prova.iso === data && r.prova.semanasReais === sem, nome + ': resultado traz a prova e as semanas reais');
      ok(semanas.every(w => w && !w.pendente), nome + ': todas as semanas geradas');
      if (sem > 24) {
        ok(r.prova.alemDoPlano === true && provas(semanas).length === 0, nome + ': prova além do horizonte de 24 semanas: sem sessão Prova e sem polimento');
        ok(!hp.trajetoria.some(t => t.fase === 'Polimento'), nome + ': sem polimento');
        continue;
      }
      // a sessão Prova cai exatamente na data
      const ps = provas(semanas);
      ok(ps.length === 1 && ps[0].semana === esperado, nome + ': uma única sessão Prova, na última semana');
      if (ps.length === 1) {
        const c = ps[0].c;
        const dataDaSessao = iso(somaDias(new Date(hp.startMonday + 'T00:00:00'), (esperado - 1) * 7 + idx(c.day)));
        ok(dataDaSessao === data, nome + ': Prova cai exatamente na data (' + dataDaSessao + ')');
        ok(c.distanciaProvaKm === dist && Math.abs(c.steps[c.steps.length - 1].km - dist) < 0.06, nome + ': distância da prova');
        const vdot = r.estado.corrida.vdot;
        const pace = T.formatPace(T.predictRaceTimeSec(vdot, dist) / dist) + '/km';
        ok(c.mainPace === pace && c.paceProvaSegKm === Math.round(T.predictRaceTimeSec(vdot, dist) / dist), nome + ': ritmo previsto pelo VDOT para ' + dist + ' km (' + pace + ')');
        // depois da prova: descanso (nenhuma corrida nem musculação em dia posterior; véspera sem corrida)
        const w = semanas[esperado - 1], i = idx(c.day);
        ok(!w.corridaWeek.some(x => idx(x.day) > i) && !Object.keys(w.muscPlan).some(d => idx(d) >= i - 2), nome + ': descanso depois da prova e musculação fora dos 2 dias antes');
        ok(!w.corridaWeek.some(x => idx(x.day) === i - 1), nome + ': véspera sem corrida');
        ok(semanas.slice(0, esperado - 1).every(x => !x.corridaWeek.some(c2 => c2.type === 'Prova')), nome + ': antes da última semana não há Prova');
      }
      // polimento por distância e volume caindo até a semana da prova
      const pol = hp.trajetoria.filter(t => t.fase === 'Polimento');
      const polEsperado = Math.min(POLIMENTO[dist], esperado);
      ok(pol.length === polEsperado, nome + ': ' + polEsperado + ' semana(s) de polimento (veio ' + pol.length + ')');
      const vols = hp.trajetoria.slice(esperado - polEsperado - 1).map(t => t.corridaMinAlvo);
      ok(vols.every((v, j) => j === 0 || v < vols[j - 1]), nome + ': volume cai a cada semana de polimento (' + vols.join(' > ') + ')');
      const ultima = hp.trajetoria[esperado - 1], base = Math.max(...hp.trajetoria.slice(0, esperado - polEsperado).map(t => t.corridaMinAlvo));
      if(esperado > polEsperado) ok(ultima.corridaMinAlvo <= base * 0.65, nome + ': semana da prova com carga bem baixa (' + ultima.corridaMinAlvo + ' de ' + base + ' min)');
      ok(hp.trajetoria[esperado - 1].prova && hp.trajetoria[esperado - 1].prova.iso === data, nome + ': trajetória marca a semana da prova');
      // prazo curto: aviso e manutenção; prazo normal: sem aviso
      if (sem < 4) {
        ok(r.avisoPrazo && r.avisoPrazo.semanasReais === sem, nome + ': avisoPrazo marcado');
        ok(hp.trajetoria.filter(t => t.fase !== 'Polimento').every(t => t.fase === 'Manutenção') || polEsperado === esperado, nome + ': semanas fora do polimento são de manutenção');
        const antes = hp.trajetoria.slice(0, esperado - polEsperado).map(t => t.corridaMinAlvo);
        ok(antes.every(v => v === antes[0]), nome + ': manutenção sem progressão de volume');
      } else ok(r.avisoPrazo === null, nome + ': sem avisoPrazo');
    }
  }

  // ---- semana da prova: só rodagens leves e curtas, volume não passa do da semana anterior ----
  const somaMin = w => (w.corridaWeek || []).reduce((t, c) => t + (c.totalMin || 0), 0);
  function checarSemanaDaProva(g, nome) {
    const n = g.hp.plan.length, w = g.semanas[n - 1], i = idx(((w.corridaWeek || []).find(c => c.type === 'Prova') || {}).day);
    const pv = w.corridaWeek.find(c => c.type === 'Prova'), outras = w.corridaWeek.filter(c => c.type !== 'Prova');
    ok(!!pv, nome + ': tem a Prova');
    ok(outras.every(c => c.type === 'Rodagem Leve'), nome + ': sem limiar, intervalado nem longão na semana da prova (' + outras.map(c => c.type).join(',') + ')');
    ok(outras.length <= 3 && outras.every(c => c.totalMin <= 25), nome + ': no máximo 3 rodagens de até 25 min (' + outras.map(c => c.totalMin).join(',') + ')');
    const pico = g.hp.trajetoria[n - 1].prova.picoMin, soma = outras.reduce((t, c) => t + c.totalMin, 0);
    ok(soma <= pico * 0.25 + 0.001, nome + ': corridas fora a Prova somam ' + soma + ' min, no máximo 25% do pico (' + pico + ')');
    ok(outras.every(c => idx(c.day) < i - 1), nome + ': nenhuma corrida na véspera nem no dia da prova além da Prova');
    ok(!w.corridaWeek.some(c => idx(c.day) === i - 1 && c.totalMin > 20), nome + ': véspera com no máximo 20 min');
    if (n > 1) {
      const ant = somaMin(g.semanas[n - 2]), tot = somaMin(w);
      ok(pv.totalMin > ant ? soma < ant : tot <= ant, nome + ': volume da semana (' + tot + ') não passa do da anterior (' + ant + ')' + (pv.totalMin > ant ? ' / sem a Prova ' + soma + ' < ' + ant : ''));
    }
  }
  {
    const g = await gerar(perfil(21.0975, dataProva(10, 6)));   // meia, prova em 13/12 (domingo), 10 semanas
    ok(g.hp.plan.length === 10, 'meia 13/12: 10 semanas');
    ok(!g.semanas[9].corridaWeek.some(c => /Limiar|Intervalado|Longão/.test(c.type)), 'meia 13/12: semana da prova sem Limiar');
    checarSemanaDaProva(g, 'meia 13/12');
  }
  for (const dist of [5, 10, 21.0975, 42.195]) {
    for (const diaK of [1, 4, 5]) {
      const g = await gerar(perfil(dist, dataProva(12, diaK)));
      checarSemanaDaProva(g, dist + ' km, prova ' + TODOS[diaK]);
    }
  }

  // ---- prova nesta mesma semana (plano de 1 semana) ----
  {
    const data = dataProva(1, 5); // sábado desta semana
    const g = await gerar(perfil(5, data));
    const w = g.semanas[0], p = provas(g.semanas);
    ok(g.hp.plan.length === 1 && p.length === 1 && p[0].c.day === 'Sáb', '5 km, prova neste sábado: plano de 1 semana com a Prova no sábado');
    ok(g.r.avisoPrazo && g.r.avisoPrazo.semanasReais === 1, 'prova neste sábado: avisoPrazo marcado');
    ok(!w.corridaWeek.some(x => idx(x.day) > 5), 'prova neste sábado: nada depois dela');
  }
  // ---- prova na segunda-feira da semana N (dia 0) e no domingo (dia 6) ----
  for (const [diaK, nome] of [[0, 'segunda'], [6, 'domingo']]) {
    const g = await gerar(perfil(10, dataProva(6, diaK)));
    const p = provas(g.semanas);
    ok(g.hp.plan.length === 6 && p.length === 1 && p[0].c.day === TODOS[diaK] && p[0].semana === 6, '10 km, prova na ' + nome + ' da 6ª semana: Prova em ' + TODOS[diaK]);
  }

  // ---- data inválida, vazia, de hoje ou do passado: o plano é o de sempre (8 semanas, sem Prova, sem campos novos) ----
  const base = await gerar(perfil(10, ''));
  ok(base.r.prova === undefined && base.hp.plan.length === 8, 'sem data: plano de 8 semanas, sem o campo prova');
  for (const [rotulo, data] of [['inexistente', '2026-02-30'], ['texto', 'amanhã'], ['mês 13', '2026-13-01'], ['passado', '2026-09-01'], ['hoje', '2026-10-05']]) {
    const g = await gerar(perfil(10, data));
    ok(g.r.prova === undefined && g.r.avisoPrazo === undefined, 'data ' + rotulo + ' (' + data + '): sem alinhamento à data');
    ok(g.hp.plan.length === 8, 'data ' + rotulo + ': continua com 8 semanas (veio ' + g.hp.plan.length + ')');
    ok(provas(g.semanas).length === 0, 'data ' + rotulo + ': sem sessão Prova');
    ok(!g.hp.trajetoria.some(t => t.prova), 'data ' + rotulo + ': trajetória sem marca de prova');
  }
  // data fora do objetivo prova é ignorada
  { const g = await gerar(perfil(10, dataProva(8, 3), { obj: 'saude' })); ok(g.r.prova === undefined && provas(g.semanas).length === 0, 'objetivo que não é prova ignora a data'); }

  semErro();
  process.exit(process.exitCode || 0);
})();
