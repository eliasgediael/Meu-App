// IA (Gemini) — validação determinística da proposta. Nenhuma chamada real: as "respostas da IA" são montadas aqui.
// 1) Compatibilidade: o plano do próprio motor, devolvido como resposta, passa em F0–F9 + validarPlano nos 20 perfis
//    (semanas 1 a 5). 2) Ataques: cada resposta inválida ou insegura é reprovada com o código certo. 3) Mudança válida
//    é aceita e a semana final só troca a musculação (corrida e plano do motor intactos).
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade, PERFIS } = require('../harness/ia.js');

const clone = (x) => JSON.parse(JSON.stringify(x));
const cods = (v) => v.erros.map(e => e.cod);
const reprova = (v, cod, msg) => ok(!v.ok && cods(v).includes(cod), msg + (v.ok ? ' (passou)' : ' [' + [...new Set(cods(v))].join(',') + ']'));

(async () => {
  const T = await carregarAppComIA(['motorPoolMotor', 'iaChavesDoPool', 'iaTotalSeries']);
  T.iaChavesDoPool = globalThis.iaChavesDoPool;
  const chaveDe = (nome) => globalThis.iaChavesDoPool(T.motorPoolMotor()).get(nome);

  // ---------- 1) compatibilidade com o motor atual ----------
  let total = 0, aceitos = 0, ctxOk = 0;
  const falhas = [];
  for (const [nome] of PERFIS) {
    const p = await prepararPerfil(T, nome.slice(0, 2));
    const hp = T.state.hybridPlanData;
    for (let k = 1; k <= Math.min(hp.plan.length, 5); k++) {
      const opcoes = k === 1 ? {} : { alvoSemana: (hp.trajetoria || [])[k - 1] || null };
      const w = k === 1 ? T.gerarPlanoSemanal(p, {}).semana : T.gerarSemanaV2(k);
      if (!w || !Object.keys(w.muscPlan || {}).length) continue;
      total++;
      const ctx = T.iaContextoDoMotor(p, opcoes, w);
      if (!ctx.ok) { falhas.push(nome.slice(0, 2) + '/s' + k + ' ctx ' + ctx.motivo); continue; }
      ctxOk++;
      const v = T.iaValidarProposta(ctx, respostaIdentidade(T, w.muscPlan, ctx));
      if (v.ok) aceitos++; else falhas.push(nome.slice(0, 2) + '/s' + k + ' ' + v.erros.map(e => e.cod).join(','));
    }
  }
  ok(total >= 80, `semanas com musculação analisadas: ${total}`);
  ok(ctxOk === total, `contexto do motor reconstruído em todas (${ctxOk}/${total})` + (falhas.length ? ' — ' + falhas.slice(0, 4).join(' | ') : ''));
  ok(aceitos === total, `plano do motor aceito pelos validadores em todas (${aceitos}/${total})`);

  // ---------- 2) ataques ----------
  const contexto = async (n, k = 1) => {
    const p = await prepararPerfil(T, n);
    const w = T.gerarPlanoSemanal(p, {}).semana;
    const ctx = T.iaContextoDoMotor(p, {}, w);
    return { p, w, ctx, base: respostaIdentidade(T, w.muscPlan, ctx) };
  };
  const { w: w08, ctx: c08, base: b08 } = await contexto('08');
  const muda = (fn) => { const r = clone(b08); fn(r); return T.iaValidarProposta(c08, r); };

  reprova(muda(r => { r.dias[0].exercicios[0].id = 'zz999'; }), 'F1', 'F1: id inventado');
  reprova(muda(r => { r.dias[0].exercicios[0].id = '../x'; }), 'F9', 'F9: id em formato inválido');
  reprova(muda(r => { r.dias[0].exercicios[0].series = 10; }), 'F2', 'F2: 10 séries');
  reprova(muda(r => { r.dias[0].exercicios[0].reps = 30; }), 'F2', 'F2: 30 repetições');
  reprova(muda(r => { r.dias[0].exercicios[0].rpe = 10; }), 'F2', 'F2: RPE 10');
  reprova(muda(r => { r.dias[0].exercicios[0].descansoSeg = 10; }), 'F2', 'F2: descanso de 10 s');
  reprova(muda(r => { r.dias[0].exercicios.forEach(x => { x.papel = 'base'; }); }), 'F2', 'F2: vários exercícios base no dia');
  reprova(muda(r => { r.dias[0].exercicios[0].carga = 50; }), 'F0', 'F0/F8: campo carga (kg) não é aceito');
  reprova(muda(r => { r.explicacao = 'texto livre'; }), 'F0', 'F0/F9: campo de texto livre não previsto');
  reprova(muda(r => { r.motivos = ['<img src=x onerror=alert(1)>']; }), 'F0', 'F0/F9: motivo fora da lista (HTML injetado)');
  reprova(muda(r => { r.versao = '2'; }), 'F0', 'F0: versão de contrato errada');
  reprova(muda(r => { r.dias[0].exercicios[0].series = 3.5; }), 'F0', 'F0: série não inteira');
  reprova(T.iaValidarProposta(c08, '{"versao":"1",'), 'F0', 'F0: JSON quebrado');
  reprova(T.iaValidarProposta(c08, 'x'.repeat(30000)), 'F0', 'F0: resposta grande demais');
  reprova(T.iaValidarProposta(c08, null), 'F0', 'F0: resposta nula');
  reprova(T.iaValidarProposta(c08, JSON.stringify(b08).replace('"motivos":["manter_plano"]', '"motivos":["manter_plano"],"__proto__":{"x":1}')), 'F0', 'F0: chave __proto__');
  reprova(muda(r => { r.dias.pop(); }), 'D1', 'D1: dia de musculação removido');
  reprova(muda(r => { const livre = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].find(d => !r.dias.some(x => x.dia === d)); r.dias.push({ dia: livre, exercicios: clone(r.dias[0].exercicios) }); }), 'D1', 'D1: dia novo de musculação');
  reprova(muda(r => { r.dias[1] = { ...clone(r.dias[1]), dia: r.dias[0].dia }; }), 'D1', 'D1: dia repetido');
  reprova(muda(r => { r.dias[0].exercicios.push(clone(r.dias[0].exercicios[0])); }), 'F5', 'F5: exercício repetido no dia');

  // Exercício real, mas fora da lista autorizada: equipamento (casa com halteres) e dor (joelho).
  {
    const { ctx: c13, base: b13 } = await contexto('13');
    const r = clone(b13); r.dias[0].exercicios[0].id = chaveDe('Leg press 45 graus');
    reprova(T.iaValidarProposta(c13, r), 'F1', 'F1: leg press para quem treina em casa com halteres');
    const { ctx: c15, base: b15 } = await contexto('15');
    const r2 = clone(b15); const ag = chaveDe('Agachamento livre com barra');
    r2.dias[0].exercicios[0].id = ag;
    ok(!!ag && !c15.autorizados.porId.has(ag), 'agachamento livre fora da lista de quem tem dor no joelho');
    reprova(T.iaValidarProposta(c15, r2), 'F1', 'F1: agachamento livre com dor no joelho');
  }
  // Mais exercícios que o motor permite.
  {
    const r = clone(b08);
    const d = r.dias[0], usados = new Set(d.exercicios.map(x => x.id));
    for (const it of c08.autorizados.porId.values()) { if (d.exercicios.length > c08.dias[d.dia].qtdMax) break; if (!usados.has(it.id)) { usados.add(it.id); d.exercicios.push({ id: it.id, papel: 'isolado', series: 2, reps: 12, rpe: 6, descansoSeg: 60 }); } }
    reprova(T.iaValidarProposta(c08, r), 'F5', 'F5: mais exercícios que o máximo do dia');
  }
  // Volume total acima do motor (F6a): uma série a mais onde ainda cabe na faixa do exercício.
  {
    const r = clone(b08); let feito = false;
    for (const d of r.dias) for (const x of d.exercicios) {
      if (feito) break;
      const L = T.iaLimites(c08, x.papel, c08.dias[d.dia].foco);
      if (x.series < L.seriesMax) { x.series++; feito = true; }
    }
    if (feito) reprova(T.iaValidarProposta(c08, r), 'F6', 'F6: total de séries acima do plano do motor');
    else ok(true, 'F6: (todas as séries do 08 já no teto; coberto pelo F2)');
  }
  // Perna escondida num dia "superior" que tem corrida no mesmo dia (F3 recalcula o tipo; F7 barra a carga de perna).
  const pernasDe = (ctx) => { const fams = new Set(); return [...ctx.autorizados.porId.values()].filter(it => it.composto && (it.grupo === 'Pernas' || ['agachar', 'dobradica'].includes(it.padrao))).filter(it => !fams.has(it.familia) && fams.add(it.familia)); };
  {
    const diaUpper = Object.keys(c08.dias).find(d => c08.dias[d].tipoMotor === 'upper' && c08.dias[d].corrida);
    const pernas = pernasDe(c08);
    ok(!!diaUpper && pernas.length >= 2, '08 tem dia superior com corrida e pernas compostas autorizadas');
    const r = clone(b08); const d = r.dias.find(x => x.dia === diaUpper);
    d.exercicios.splice(0, 2, ...pernas.slice(0, 2).map((it, i) => ({ id: it.id, papel: i === 0 ? 'base' : 'auxiliar', series: 2, reps: 10, rpe: 7, descansoSeg: 60 })));
    reprova(T.iaValidarProposta(c08, r), 'F7', 'F3/F7: agachamento num dia superior com corrida');
    // Dia de perna perto de corrida dura: mais séries de perna que o motor.
    const diaPerna = Object.keys(c08.dias).find(dd => c08.dias[dd].tipoMotor === 'lower' && c08.dias[dd].perto);
    const r2 = clone(b08); const d2 = r2.dias.find(x => x.dia === diaPerna);
    // O motor já tirou um exercício desse dia por estar perto de corrida dura: a IA não pode devolvê-lo.
    const famDia = new Set(d2.exercicios.map(x => c08.autorizados.porId.get(x.id).familia));
    const extra = [...c08.autorizados.porId.values()].find(it => it.grupo === 'Pernas' && !famDia.has(it.familia));
    ok(!!diaPerna && c08.dias[diaPerna].qtdMotor < c08.dias[diaPerna].qtdMax && !!extra, '08: dia de perna perto de corrida dura com um exercício a menos que o máximo');
    if (extra) d2.exercicios.push({ id: extra.id, papel: extra.composto ? 'auxiliar' : 'isolado', series: 2, reps: 12, rpe: 6, descansoSeg: 60 });
    reprova(T.iaValidarProposta(c08, r2), 'F7', 'F7: exercício a mais no dia de perna perto de corrida dura');
  }
  // Tipo pelo conteúdo e iniciante sem dia de perna pesado.
  {
    const L = (n, s) => ({ nome: n, grupo: 'Pernas', series: String(s) });
    ok(T.iaTipoPeloConteudo([L('Agachamento livre', 4), L('Leg press 45 graus', 4)], 'upper', 7) === 'lower', 'F3: 8 séries de perna composta num dia "superior" vira dia de perna');
    ok(T.iaTipoPeloConteudo([L('Agachamento livre', 3)], 'upper', 7) === 'full', 'F3: pouca perna num dia superior vira corpo inteiro');
    ok(T.iaTipoPeloConteudo([L('Leg press 45 graus', 2)], 'lower', 7) === 'lower', 'F3: dia de perna do motor que mantém perna composta continua dia de perna');
    ok(T.iaTipoPeloConteudo([{ nome: 'Supino reto com barra', grupo: 'Peito', series: '4' }], 'lower', 7) === 'upper', 'F3: sem perna vira superior');
    const { ctx: c01, base: b01 } = await contexto('01');
    const pernas = pernasDe(c01);
    const r = clone(b01);
    r.dias[0].exercicios = pernas.slice(0, 2).map((it, i) => ({ id: it.id, papel: i === 0 ? 'base' : 'auxiliar', series: 3, reps: 10, rpe: 7, descansoSeg: 90 }));
    // Com o perfil 01 a lista autorizada não permite passar da carga de perna do corpo inteiro; com referência zerada, a regra aparece.
    reprova(T.iaValidarProposta({ ...c01, refFull: 0 }, r), 'F7', 'F7: iniciante com dia de perna pesado');
  }
  // Duração: descanso no máximo em tudo, em quem tem 40 min.
  {
    const { ctx: c14, base: b14 } = await contexto('14');
    const r = clone(b14); r.dias.forEach(d => d.exercicios.forEach(x => { x.descansoSeg = 180; }));
    reprova(T.iaValidarProposta(c14, r), 'F4', 'F4: sessão que não cabe no tempo do dia');
  }

  // ---------- 3) mudança válida ----------
  {
    const antesMotor = JSON.stringify(w08);
    let aceita = null;
    outer: for (const d of b08.dias) {
      for (let i = 0; i < d.exercicios.length; i++) {
        const x = d.exercicios[i];
        if (x.papel === 'base') continue;
        const atual = c08.autorizados.porId.get(x.id);
        for (const it of c08.autorizados.porId.values()) {
          if (it.id === x.id || it.grupo !== atual.grupo || d.exercicios.some(y => y.id === it.id)) continue;
          const r = clone(b08); r.dias.find(y => y.dia === d.dia).exercicios[i].id = it.id; r.motivos = ['variedade'];
          const v = T.iaValidarProposta(c08, r);
          if (v.ok) { aceita = { r, v, dia: d.dia, de: atual.nome, para: it.nome }; break outer; }
        }
      }
    }
    ok(!!aceita, 'troca de exercício por outro autorizado do mesmo grupo é aceita' + (aceita ? ` (${aceita.dia}: ${aceita.de} → ${aceita.para})` : ''));
    if (aceita) {
      const fim = T.iaMontarSemanaFinal(c08, w08, aceita.v);
      ok(fim.muscPlan[aceita.dia].some(e => e.nome === aceita.para), 'semana final tem o exercício novo');
      ok(Object.values(fim.muscPlan).flat().every(e => e.carga === ''), 'F8: nenhuma carga definida pela IA');
      ok(JSON.stringify(fim.corridaWeek) === JSON.stringify(w08.corridaWeek), 'corrida da semana idêntica à do motor');
      ok(JSON.stringify(w08) === antesMotor, 'plano do motor não foi alterado');
      ok(fim.iaRefino && fim.iaRefino.motivos.join() === 'variedade', 'semana marcada como refinada pela IA, com o motivo');
      ok(fim.weekNumber === w08.weekNumber, 'mesma estrutura de semana do motor');
    }
    // Menos volume (uma série a menos onde dá) é aceito.
    const r = clone(b08); r.dias.forEach(d => d.exercicios.forEach(x => { if (x.series > 2) x.series--; })); r.motivos = ['reduz_volume_recuperacao'];
    const v = T.iaValidarProposta(c08, r);
    ok(v.ok, 'redução de volume é aceita' + (v.ok ? '' : ' [' + cods(v).join(',') + ']'));
    ok(v.ok && v.volume.total < c08.totalSeriesMotor, 'volume total menor que o do motor');
  }
  semErro();
})();
