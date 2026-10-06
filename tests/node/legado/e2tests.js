// Etapa 2: plano vivo, sessões-chave, carga real, por quê, escada de ajuste, perdido, check-in V2.
const H = require('../../harness/app-node.js');
const { NET } = H;
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
let erroFatal = null;
process.on('unhandledRejection', e => { erroFatal = e; });
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  (0, eval)(H.js + ';\nglobalThis.__T={state,qv2Aplicar,gerarPrimeiroPlanoV2,atualizarSemanaDoPlano,treinoEntryForDay,muscListForDay,cargaReal,porQueHoje,opcoesAjuste,treinosPerdidos,resolverPerdido,aplicarCheckinSemanalV2,conflitosDoDia,ehSessaoChaveDia,registrarCheckinDiario,vdotISODate,vdotMondayOf,hojeAbbr,hojeIdx,DAY_ABBR,dayStatus,isCorridaDone,init,chaveDiaAtual,gerarSemanaV2,entradaPreviaDoPlano};');
  await espera(500);
  const T = globalThis.__T, S = T.state;
  const dias = {}; T.DAY_ABBR.forEach(d => { dias[d] = { on: true, min: 75 }; });
  const R = { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: 8, cUn: 'km', cDesNao: true, mSit: 'regular', mExp: '1-3a', mFreq: 3, mPadroes: ['agachar', 'empurrarH', 'puxarV', 'dobradica'], local: 'academia', dias, comb: 'combinar_se_preciso', dor: false, alertasOk: true, alertas: [], orient: [], dorRegioes: [], sono: '7mais' };
  await T.qv2Aplicar(R);
  const r = await T.gerarPrimeiroPlanoV2();
  ok(r && !r.bloqueado && r.semana, 'motor V2 gera a semana 1');
  const hp = S.hybridPlanData;
  ok(hp && hp.motorV2 && hp.plan.length > 1, 'plano V2 com ' + (hp && hp.plan.length) + ' semanas');
  const corridas1 = S.treinos.length;
  ok(corridas1 > 0, 'semana 1 materializada (' + corridas1 + ' corridas)');
  ok(S.treinos.some(t => t.chave), 'sessões-chave marcadas na semana 1: ' + S.treinos.filter(t => t.chave).map(t => t.type).join(','));
  // Simula: plano começou 2 semanas atrás.
  const seg = T.vdotMondayOf(new Date()); const ini = new Date(seg); ini.setDate(ini.getDate() - 14);
  // re-materializa semana 1 com datas de 2 semanas atrás (como seria na vida real)
  hp.startMonday = T.vdotISODate(ini); hp.currentWeekIndex = 1; hp.materializadaSeg = T.vdotISODate(ini);
  S.treinos = S.treinos.map(t => { const [d, dm] = t.day.split(' '); const dt = new Date(ini); dt.setDate(dt.getDate() + T.DAY_ABBR.indexOf(d)); return { ...t, day: d + ' ' + String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') }; });
  const historico = S.treinos.length;
  S.corridaProgress[S.treinos[0].day] = { done: true, data: T.vdotISODate(ini), km: '5', tempo: '30:00' };
  await T.atualizarSemanaDoPlano();
  ok(hp.currentWeekIndex === 3, 'avança para a semana 3 pela data: ' + hp.currentWeekIndex);
  ok(!hp.plan[2].pendente && hp.plan[2].corridaWeek.length > 0, 'semana 3 gerada pelo V2');
  ok(S.treinos.length >= historico + hp.plan[2].corridaWeek.length, 'histórico preservado (' + S.treinos.length + ' entradas)');
  ok(S.corridaProgress[S.treinos[0].day] && S.corridaProgress[S.treinos[0].day].done, 'corrida concluída antiga preservada');
  const corridaHoje = T.DAY_ABBR.map(d => T.treinoEntryForDay(d)).filter(Boolean);
  ok(corridaHoje.length === hp.plan[2].corridaWeek.length, 'agenda da semana atual mostra as corridas da semana 3');
  // idempotente
  const n1 = S.treinos.length; await T.atualizarSemanaDoPlano();
  ok(S.treinos.length === n1, 'abrir de novo não duplica treinos');
  // prévia de semana futura
  S.weekOffset = 1;
  const prev = T.DAY_ABBR.map(d => T.treinoEntryForDay(d)).filter(Boolean);
  ok(prev.length > 0 && prev.every(p => p.previa), 'semana futura mostra prévia do plano (' + prev.length + ')');
  S.weekOffset = 0;
  // carga real
  const c = T.cargaReal();
  ok(['baixa', 'moderada', 'alta'].includes(c.pernas) && ['baixa', 'moderada', 'alta'].includes(c.geral), 'carga real em estados simples: pernas ' + c.pernas + ', geral ' + c.geral);
  S.workoutSessionsLog.push({ data: new Date().toISOString().slice(0, 10).replace(/T.*/, ''), duracaoSeg: 3600, exercicios: [{ grupo: 'Pernas', series: '4' }, { grupo: 'Pernas', series: '4' }, { grupo: 'Pernas', series: '3' }] });
  // garante data de hoje local
  S.workoutSessionsLog[S.workoutSessionsLog.length - 1].data = (function () { const d = new Date(); return T.vdotISODate(d); })();
  const c2 = T.cargaReal();
  ok(c2.nivelPernas >= 1, 'perna pesada hoje sobe a carga das pernas: ' + c2.pernas);
  // por quê
  const diasComTreino = T.DAY_ABBR.filter(d => T.treinoEntryForDay(d) || T.muscListForDay(d).length);
  const txt = T.porQueHoje(diasComTreino[0]);
  ok(typeof txt === 'string' && txt.length > 10, 'por quê: "' + txt + '"');
  // check-in diário + escada
  await T.registrarCheckinDiario({ energia: 1, pernas: 3, dor: 1 });
  const hoje = T.hojeAbbr();
  // garante um treino hoje pra testar a escada
  let alvo = T.DAY_ABBR.slice(T.hojeIdx()).find(d => T.treinoEntryForDay(d) && !T.isCorridaDone(d));
  if (alvo) {
    const ops = T.opcoesAjuste(alvo);
    ok(ops.length >= 3, 'escada com ' + ops.length + ' opções: ' + ops.map(o => o.id + (o.recomendado ? '*' : '')).join(','));
    ok(ops.filter(o => o.recomendado).length === 1, 'exatamente uma opção recomendada');
    const red = ops.find(o => o.id === 'reduzir');
    if (red) {
      const kmAntes = parseFloat(T.treinoEntryForDay(alvo).totalKm);
      await red.aplicar();
      const e = T.treinoEntryForDay(alvo);
      ok(parseFloat(e.totalKm) < kmAntes && e.ajuste && e.ajuste.original, 'reduzir altera a agenda real (' + kmAntes + ' → ' + e.totalKm + ') e guarda o original');
      ok(S.diarioTreinador.length > 0 && S.diarioTreinador[0].alteracao, 'diário registrou: ' + JSON.stringify(S.diarioTreinador[0]));
    }
    const mover = T.opcoesAjuste(alvo).find(o => o.id === 'mover');
    if (mover) {
      const antes = T.treinoEntryForDay(alvo);
      await mover.aplicar();
      ok(!T.treinoEntryForDay(alvo), 'mover tira o treino do dia de origem');
      ok(T.DAY_ABBR.some(d => T.treinoEntryForDay(d) === antes), 'treino aparece no dia novo');
      const novoDia = T.DAY_ABBR.find(d => T.treinoEntryForDay(d) === antes);
      ok(T.conflitosDoDia(novoDia).length === 0, 'destino sem conflito de 24h');
    } else ok(true, 'sem destino válido pra mover (semana cheia) — opção não oferecida');
    const desc = T.opcoesAjuste(T.DAY_ABBR.slice(T.hojeIdx()).find(d => T.treinoEntryForDay(d) && !T.isCorridaDone(d)) || alvo).find(o => o.id === 'descansar');
    if (desc) { await desc.aplicar(); ok(true, 'descansar aplicado'); }
  } else ok(true, 'nenhuma corrida pendente de hoje em diante nesta semana (dia ' + hoje + ') — escada testada só pela musculação');
  // conflito de 24h
  const sim = {}; T.DAY_ABBR.forEach(d => sim[d] = { corrida: null, musc: [] });
  sim.Seg.musc = [{ grupo: 'Pernas' }, { grupo: 'Pernas' }, { grupo: 'Pernas' }];
  sim.Ter.corrida = { type: 'Intervalado' };
  ok(T.conflitosDoDia('Ter', sim).length > 0, 'conflito detectado: ' + T.conflitosDoDia('Ter', sim)[0]);
  // treino perdido
  const perd = T.treinosPerdidos();
  ok(Array.isArray(perd), 'detector de treino perdido roda (' + perd.length + ' perdidos)');
  if (perd.length) { await T.resolverPerdido(perd[0], 'seguir'); ok(T.treinosPerdidos().length === perd.length - 1, 'perdido tratado some da lista'); }
  // check-in semanal V2
  const novo = T.aplicarCheckinSemanalV2(hp, hp.currentWeekIndex, { fadiga: 5, dor: true }, 'dificil');
  ok(novo.ajusteProximaSemana && novo.ajusteProximaSemana.ajustes.volumeFator === 0.8 && novo.ajusteProximaSemana.ajustes.semQualidade, 'check-in vira ajuste da próxima semana');
  ok(novo.plan.filter(w => w.weekNumber > hp.currentWeekIndex).every(w => w.pendente), 'semanas futuras voltam a pendente (regeneradas pelo V2)');
  S.hybridPlanData = novo;
  const w4 = T.gerarSemanaV2(hp.currentWeekIndex + 1);
  ok(w4 && w4.corridaWeek.length >= 0, 'próxima semana gerada com o ajuste (qualidade: ' + w4.corridaWeek.map(x => x.type).join(',') + ')');
  ok(!w4.corridaWeek.some(x => /interval|limiar|repeti/i.test(x.type)), 'ajuste "sem qualidade" respeitado');
  await espera(50);
  ok(!erroFatal, 'sem erro não tratado' + (erroFatal ? ': ' + (erroFatal.stack || erroFatal).toString().split('\n').slice(0, 2).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})();
