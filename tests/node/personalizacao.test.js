// Personalização Motor V2 + IA (19/10/2026): nível de musculação por eixos, treino forte graduado, Leg Day da regra 2,
// variação por bloco e propostas de IA (simuladas, sem rede) que variam a semana e passam pela validação do motor.
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade, PERFIS } = require('../harness/ia.js');
const { BASE } = require('../harness/perfis.js');
const clone = x => JSON.parse(JSON.stringify(x));
const SEIS = ['01', '03', '04', '08', '10', '15'];
(async () => {
  const T = await carregarAppComIA(['lerEstado', 'motorQualidadeModo', 'MOTOR_PERSONALIZACAO']);
  const S = T.state;
  const zonas = (w) => (w.corridaWeek || []).flatMap(c => (c.gpsSteps || []).map(g => g.zona || ''));
  const semanas = async (n) => {
    const p = await prepararPerfil(T, n), hp = S.hybridPlanData;
    const ws = [hp.plan[0]]; for (let i = 2; i <= hp.plan.length; i++) ws.push(T.gerarSemanaV2(i));
    return { p, hp, ws };
  };

  // ---------- 1) nível de musculação por eixos ----------
  {
    const est = async (n, extra) => { S.athleteProfile = T.criarAthleteProfile(); await T.qv2Aplicar({ ...BASE, ...PERFIS.find(x => x[0].startsWith(n))[1], ...(extra || {}) }); return T.lerEstado(S.athleteProfile, {}); };
    const e07 = await est('07');
    ok(e07.capacidade.musc === 'intermediario' && e07.musc.eixos.experiencia === 'avancado' && e07.musc.eixos.tecnica === 'iniciante', '07: experiência alta e técnica baixa = estrutura intermediária (antes: iniciante pelo menor eixo)');
    const e14 = await est('14');
    ok(e14.capacidade.musc === 'iniciante', '14: treina às vezes, sem padrões dominados = iniciante');
    const e04 = await est('04');
    ok(e04.capacidade.musc === 'avancado' && e04.musc.eixos.volume === 'avancado', '04: avançado em todos os eixos');
    const e10 = await est('10', { mFreq: 1 });
    ok(e10.musc.eixos.volume === 'intermediario' && e10.musc.eixos.frequencia === 'iniciante', '10 com 1x/semana: frequência baixa limita o volume, não a estrutura');
    const e01 = await est('01');
    ok(e01.capacidade.musc === 'iniciante', '01: nunca treinou = iniciante');
  }

  // ---------- 2) treino forte graduado ----------
  {
    const modo = async (n, extra) => { S.athleteProfile = T.criarAthleteProfile(); await T.qv2Aplicar({ ...BASE, ...PERFIS.find(x => x[0].startsWith(n))[1], ...(extra || {}) }); return T.motorQualidadeModo(T.lerEstado(S.athleteProfile, {}), {}); };
    ok(await modo('08') === 'normal', '08: sem dúvidas nem dor = treino forte normal');
    ok(await modo('08', { cMaior: 'ns', cCont: '30-60' }) === 'conservadora', '08 com 1 "não sei": treino forte conservador (antes: sem treino forte)');
    ok(await modo('08', { cMaior: 'ns', cFreq: 'ns' }) === null, '08 com 2 "não sei": sem treino forte');
    ok(await modo('08', { dor: true, dorRegioes: ['ombro'], dorInt: 'moderada', dorRep: false }) === 'normal', '08 com dor no ombro: corrida não muda');
    ok(await modo('08', { dor: true, dorRegioes: ['joelho'], dorInt: 'leve', dorRep: false }) === 'conservadora', '08 com dor leve no joelho: só conservador');
    ok(await modo('08', { dor: true, dorRegioes: ['joelho'], dorInt: 'moderada', dorRep: false }) === null, '08 com dor moderada no joelho: sem treino forte');
    ok(await modo('08', { sono: 'menos6' }) === null, '08 com sono < 6 h: sem treino forte (regra de recuperação mantida)');
    ok(await modo('01') === null && await modo('06') === null, 'iniciantes seguem sem treino forte (fartlek leve aguarda decisão)');
    const { ws: w17 } = await semanas('17');
    const q17 = w17.filter(Boolean).flatMap(w => w.corridaWeek.filter(c => /Fartlek|Limiar|Intervalado/.test(c.type)));
    ok(q17.length > 0 && w17.filter(Boolean).every(w => !zonas(w).some(z => /Z5/.test(z))), '17 (dor leve no tornozelo): treino forte conservador, nunca Z5');
    const { ws: w15 } = await semanas('15');
    ok(w15.filter(Boolean).every(w => !w.corridaWeek.some(c => /Fartlek|Limiar|Intervalado/.test(c.type))), '15 (dor moderada no joelho): sem treino forte');
    ok(w15.filter(Boolean).every(w => !Object.values(w.muscPlan).some(l => l[0] && l[0].sessao === 'LEG_DAY_HEAVY')), '15: sem Leg Day pesado com dor moderada no joelho');
  }

  // ---------- 3) divisão (regra 2) e segurança em todos os perfis e semanas ----------
  for (const [nome] of PERFIS) {
    const n = nome.slice(0, 2);
    const p = await prepararPerfil(T, n), hp = S.hybridPlanData;
    if (!hp) continue;
    let todasOk = true, z5Indevido = false, legDays = true;
    for (let i = 1; i <= hp.plan.length; i++) {
      const r = T.gerarPlanoSemanal(p, { alvoSemana: hp.trajetoria[i - 1] });
      if (!r.validacao.ok) todasOk = false;
      const est = T.lerEstado(p, { alvoSemana: hp.trajetoria[i - 1] });
      const m = T.motorQualidadeModo(est, r.ajustes);
      if (m !== 'normal' && zonas(r.semana).some(z => /Z5/.test(z))) z5Indevido = true;
      const lower = Object.values(r.semana.muscPlan).filter(l => l[0] && l[0].sessao === 'LEG_DAY_HEAVY').length;
      const nm = Object.keys(r.semana.muscPlan).length;
      if ((nm <= 3 && lower > 1) || lower > 2 || (est.capacidade.musc === 'iniciante' && lower > 0)) legDays = false;
    }
    ok(todasOk, `${n}: todas as semanas passam no validarPlano (V1–V10)`);
    ok(!z5Indevido, `${n}: sem Z5 quando o treino forte é conservador`);
    ok(legDays, `${n}: Leg Day dentro da regra (1 com 2–3 dias, até 2 com 4; iniciante sem)`);
  }
  {
    const { ws } = await semanas('18');
    const f = Object.values(ws[0].muscPlan).map(l => l[0].sessao).sort();
    ok(JSON.stringify(f) === JSON.stringify(['LEG_DAY_HEAVY', 'UPPER_BODY']), '18 (intermediário, 2 dias): 1 Leg Day + superiores (antes: 2 corpo inteiro)');
  }

  // ---------- 4) variação justificada ----------
  {
    const { ws } = await semanas('04');
    const base = (w) => Object.fromEntries(Object.entries(w.muscPlan).map(([d, l]) => [d, l.filter(e => e.papel === 'base').map(e => e.nome).join()]));
    const acess = (w) => Object.values(w.muscPlan).flat().filter(e => e.papel !== 'base').map(e => e.nome).sort().join();
    ok(JSON.stringify(base(ws[0])) === JSON.stringify(base(ws[4])), '04: exercício base de cada dia igual entre blocos (progressão de carga)');
    ok(acess(ws[0]) === acess(ws[2]) && acess(ws[0]) !== acess(ws[4]), '04: acessórios iguais dentro do bloco e diferentes no bloco seguinte');
    const { ws: w08 } = await semanas('08');
    ok(!!w08[1].corridaWeek.find(c => c.variacao) && !w08[0].corridaWeek.find(c => c.variacao) && !w08[3].corridaWeek.find(c => c.variacao), '08: corrida varia a partir da semana 2 (sem variação na semana 1 e na descarga)');
    ok(new Set(w08.slice(0, 3).map(w => w.corridaWeek.map(c => c.variacao || c.type).join('|'))).size === 3, '08: as três primeiras semanas têm corridas diferentes');
  }

  // ---------- 5) IA (simulada): varia exercícios e corrida dentro dos menus e passa na validação ----------
  T.IA_CONFIG.ativa = true;
  for (const n of SEIS) {
    const p = await prepararPerfil(T, n), hp = S.hybridPlanData;
    for (const semanaN of [1, 2]) {
      const opcoes = semanaN === 1 ? {} : { alvoSemana: hp.trajetoria[1] };
      const semana = semanaN === 1 ? T.gerarPlanoSemanal(p, {}).semana : T.gerarSemanaV2(2);
      const ctx = T.iaContextoDoMotor(p, opcoes, semana);
      if (!ctx.ok) { ok(['cautela'].includes(ctx.motivo), `IA ${n} s${semanaN}: contexto (${ctx.motivo})`); continue; }
      const c = T.iaContextoCorridaV2(ctx);
      const resp = { ...respostaIdentidade(T, ctx.muscServido, ctx), versao: '2', corrida: Object.entries(c.dias).map(([dia, x]) => ({ dia, opcao: x.motorId, mobilidade: [], educativos: [], alongamentos: [], strides: 0, stridesFim: 0, progressao: 'manter' })) };
      resp.motivos = ['variedade'];
      const valida = (r) => T.iaValidarPropostaV2(ctx, c, r).ok;
      ok(valida(resp), `IA ${n} s${semanaN}: identidade aceita`);
      let trocasM = 0, trocasC = 0;
      // Musculação: troca o último acessório/isolado de cada dia por outro autorizado do mesmo grupo (como a IA faria).
      for (const d of resp.dias) {
        const i = d.exercicios.map(x => x.papel).lastIndexOf('isolado') >= 0 ? d.exercicios.map(x => x.papel).lastIndexOf('isolado') : d.exercicios.map(x => x.papel).lastIndexOf('auxiliar');
        if (i < 0) continue;
        const atual = ctx.autorizados.porId.get(d.exercicios[i].id);
        const cands = [...ctx.autorizados.porId.values()].filter(it => it.grupo === atual.grupo && it.id !== atual.id && it.composto === atual.composto && !d.exercicios.some(x => x.id === it.id));
        for (const it of cands) {
          const prova = clone(resp); prova.dias.find(x => x.dia === d.dia).exercicios[i].id = it.id;
          if (valida(prova)) { d.exercicios[i].id = it.id; trocasM++; break; }
        }
      }
      // Corrida: escolhe outra opção do menu quando ela passa em tudo.
      for (const it of resp.corrida) {
        const x = c.dias[it.dia];
        for (const id of x.menu.filter(o => o !== x.motorId)) {
          const prova = clone(resp); prova.corrida.find(y => y.dia === it.dia).opcao = id;
          if (valida(prova)) { it.opcao = id; trocasC++; break; }
        }
      }
      const temMusc = Object.keys(ctx.muscServido).length > 0;
      ok(!temMusc || trocasM > 0, `IA ${n} s${semanaN}: variação de exercícios aceita pela validação (${trocasM} troca(s))`);
      const r = await T.iaRefinarSemanaV2({ perfil: p, opcoes, semanaMotor: semana, online: true, usuario: { uid: 'ficticio' }, chamarFuncao: async () => ({ resposta: resp }), semanaAnterior: semanaN === 2 ? hp.plan[0] : null });
      ok(r.origem === 'ia' && (trocasM + trocasC === 0 || JSON.stringify(r.semana.muscPlan) !== JSON.stringify(semana.muscPlan) || JSON.stringify(r.semana.corridaWeek) !== JSON.stringify(semana.corridaWeek)),
        `IA ${n} s${semanaN}: semana final da IA validada e diferente da do motor (${r.motivo}; musc ${trocasM}, corrida ${trocasC})`);
      if (semanaN === 2) {
        const ped = T.iaMontarPedidoV2(ctx, c, { perfil: p, semanaAnterior: hp.plan[0] });
        ok(ped.semana.anterior && ped.semana.bloco === 1 && ped.semana.semanaNoBloco === 2 && ped.perfil.eixosMusculacao && typeof ped.regras.diasDePernaPesada === 'number', `IA ${n}: pedido leva semana anterior, bloco, eixos e Leg Days`);
        ok(!/"nome"\s*:/.test(JSON.stringify(ped.semana.anterior)), `IA ${n}: semana anterior sem nomes (só ids)`);
      }
      // Negativo: a IA não pode tirar o Leg Day (regra 2).
      const lower = Object.keys(ctx.dias).find(d => ctx.dias[d].tipoMotor === 'lower');
      if (lower) {
        const sem = clone(resp); const dia = sem.dias.find(x => x.dia === lower);
        dia.exercicios = dia.exercicios.filter(x => { const it = ctx.autorizados.porId.get(x.id); return !(it.grupo === 'Pernas' && it.composto); });
        if (!dia.exercicios.some(x => x.papel === 'base')) { const k = dia.exercicios.findIndex(x => ctx.autorizados.porId.get(x.id).composto); if (k >= 0) dia.exercicios[k].papel = 'base'; }
        const v = T.iaValidarPropostaV2(ctx, c, sem);
        ok(!v.ok, `IA ${n} s${semanaN}: tirar o Leg Day é reprovado (${(v.erros[0] || {}).cod})`);
      }
    }
  }
  // Negativo: com treino forte conservador, opção Z5 não está no menu e é reprovada.
  {
    const p = await prepararPerfil(T, '17');
    const semana = T.gerarPlanoSemanal(p, {}).semana;
    const ctx = T.iaContextoDoMotor(p, {}, semana);
    if (ctx.ok) {
      const c = T.iaContextoCorridaV2(ctx);
      const q = Object.entries(c.dias).find(([, x]) => x.cdia.tipoDia === 'qualidade');
      ok(!!q && !q[1].menu.some(id => /^I_|SUBIDAS|RITMO_PROVA/.test(id)), '17: menu do treino forte conservador sem tiros, subidas nem ritmo de prova');
      if (q) {
        const resp = { ...respostaIdentidade(T, ctx.muscServido, ctx), versao: '2', corrida: Object.entries(c.dias).map(([dia, x]) => ({ dia, opcao: dia === q[0] ? 'I_400' : x.motorId, mobilidade: [], educativos: [], alongamentos: [], strides: 0, stridesFim: 0, progressao: 'manter' })) };
        const v = T.iaValidarPropostaV2(ctx, c, resp);
        ok(!v.ok && v.erros.some(e => e.cod === 'R2'), '17: IA pedindo tiros de 400 m é reprovada (R2)');
      }
    }
  }
  T.IA_CONFIG.ativa = false;
  semErro();
})().catch(e => { console.log('FAIL ' + e.stack); process.exitCode = 1; });
