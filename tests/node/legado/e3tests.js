const H = require('../../harness/app-node.js'); const { NET } = H;
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
let erro = null; process.on('unhandledRejection', e => { erro = e; });
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  (0, eval)(H.js + ';\nglobalThis.__T={state,qv2Aplicar,gerarPrimeiroPlanoV2,renderHojeV2Content,renderTreinoV2Content,DAY_ABBR,hojeAbbr,opcoesAjuste,registrarCheckinDiario,checkinDiarioPendente,treinoEntryForDay,muscListForDay,vdotFormatDDMM,chaveDiaAtual,porQueHoje};');
  await espera(500);
  const T = globalThis.__T, S = T.state;
  const dias = {}; T.DAY_ABBR.forEach(d => { dias[d] = { on: true, min: 75 }; });
  await T.qv2Aplicar({ obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: 8, cUn: 'km', cDesNao: true, mSit: 'regular', mExp: '1-3a', mFreq: 3, mPadroes: ['agachar', 'empurrarH', 'puxarV'], local: 'academia', dias, comb: 'combinar_se_preciso', dor: false, alertasOk: true, alertas: [], orient: [], dorRegioes: [], sono: '7mais' });
  await T.gerarPrimeiroPlanoV2();
  // garante uma corrida intensa hoje para exercitar Por quê/Ajustar
  const hoje = T.hojeAbbr();
  S.treinos = S.treinos.filter(t => !t.day.startsWith(hoje + ' '));
  S.treinos.push({ day: T.chaveDiaAtual(hoje), type: 'Intervalado', totalKm: 8, totalMin: 50, chave: true, steps: [{ name: 'Aquecimento', km: 2 }, { name: 'Tiro', km: 4 }, { name: 'Desaquecimento', km: 2 }] });
  S.selectedDayHoje = hoje; S.weekOffset = 0;
  let h = T.renderHojeV2Content();
  ok(/Como você está hoje\?/.test(h), 'Home mostra check-in diário pendente');
  ok(/fr-treinador/.test(h), 'Home mostra o Por quê (Treinador)');
  ok(!/data-ajustar/.test(h) && !/Adaptar treino/.test(h), 'Home sem Ajustar/Adaptar');
  ok(!/>Corpo</.test(h) && /Pernas/.test(h), 'Home sem a linha Corpo, com o check-in (Pernas)');
  ok(/Semana/.test(h) && /concluídos/.test(h), 'Home mostra semana com progresso');
  ok(/Treino-chave/.test(h), 'Home marca o treino-chave');
  ok(!/Atalhos/.test(h) && !/mrt-atalho|data-atalho/.test(h), 'Home sem atalhos');
  ok(!/Última corrida/.test(h), 'Home sem "última corrida"');
  await T.registrarCheckinDiario({ energia: 1, pernas: 3, dor: 1 });
  h = T.renderHojeV2Content();
  ok(!/Como você está hoje\?/.test(h), 'check-in some depois de respondido');
  const ops = T.opcoesAjuste(hoje);
  ok(ops.find(o => o.recomendado) && ['mover', 'reduzir', 'leve'].includes(ops.find(o => o.recomendado).id), 'cansado + treino-chave → recomenda proteger (' + ops.find(o => o.recomendado).id + ')');
  console.log('   por quê:', T.porQueHoje(hoje));
  S.selectedDayMusc = hoje; S.treinosSubTab = 'corrida';   // o teste usa a data real: em dia duplo, olha o card da corrida
  const t = T.renderTreinoV2Content();
  ok(!/data-ajustar/.test(t) && !/>Ajustar</.test(t), 'tela Treino sem Ajustar');
  // Arte 02: o card da corrida não tem a linha do check-in; o check-in do dia fica no Início.
  // (o check-in do Início já foi conferido acima, em "Home mostra check-in diário pendente")
  ok(!/data-abrircheckin/.test(t), 'card da corrida sem a linha de check-in (como a arte)');
  S.weekOffset = 1;
  const t2 = T.renderTreinoV2Content();
  ok(/prévia/.test(t2), 'semana futura marcada como prévia');
  S.weekOffset = 0;
  await espera(30);
  ok(!erro, 'sem erro não tratado' + (erro ? ': ' + String(erro.stack || erro).split('\n').slice(0, 2).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})();
