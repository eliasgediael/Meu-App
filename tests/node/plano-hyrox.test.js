// Plano Hyrox: rotinas completas (8 exercícios por dia), atividades da semana e 8 semanas de corrida agendadas.
const { carregarApp, ok } = require('../harness/carregar.js');

(async () => {
  const T = await carregarApp(['state', 'HYROX_ROTINAS', 'HYROX_OUTROS', 'hyroxTirosSemana', 'hyroxLongaoSemana', 'hyroxAgendarCorrida', 'instalarPlanoHyrox'], { agora: '2026-11-23T10:00:00-03:00' }); // segunda
  const S = T.state;
  S.treinos = S.treinos || []; S.outros = S.outros || {}; S.musculacao = S.musculacao || {}; S.muscTemplates = S.muscTemplates || [];

  ok(T.HYROX_ROTINAS.length === 3 && T.HYROX_ROTINAS.every(r => r.exercicios.length === 8 || r.exercicios.length === 7), 'rotinas A/B/C com 7–8 exercícios cada');
  ok(T.HYROX_ROTINAS[0].exercicios.length === 8 && T.HYROX_ROTINAS[1].exercicios.length === 8, 'A e B com 8 exercícios');

  for (let w = 1; w <= 8; w++) {
    const t = T.hyroxTirosSemana(w), l = T.hyroxLongaoSemana(w);
    ok(t.tipo && t.steps.length >= 2 && t.totalKm > 0, `tiros semana ${w}: ${t.tipo} (${t.totalKm} km)`);
    ok(l.steps.length === 1 && l.totalKm > 0, `longão semana ${w}: ${l.totalKm} km`);
  }

  T.hyroxAgendarCorrida();
  const dias = S.treinos.filter(t => t.hyrox).map(t => t.day);
  ok(dias.length === 16, 'agenda 8 sextas + 8 domingos (' + dias.length + ')');
  ok(dias.includes('Sex 27/11') && dias.includes('Dom 29/11') && dias.includes('Sex 15/01'), 'datas certas: ' + dias.slice(0, 3).join(', '));
  T.hyroxAgendarCorrida();
  ok(S.treinos.filter(t => t.hyrox).length === 16, 'reagendar não duplica');
  ok(S.treinos.filter(t => t.hyrox).every(t => t.type && t.steps && t.cor), 'entradas com tipo, passos e cor');
})().catch(e => { console.log('FALHOU', e); process.exit(1); });
