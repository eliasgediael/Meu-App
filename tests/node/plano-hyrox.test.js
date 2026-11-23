// Plano Hyrox: rotinas completas (8 exercícios por dia), atividades da semana e 8 semanas de corrida agendadas.
const { carregarApp, ok } = require('../harness/carregar.js');

(async () => {
  const T = await carregarApp(['state', 'HYROX_ROTINAS', 'HYROX_OUTROS', 'hyroxTirosSemana', 'hyroxLongaoSemana', 'hyroxAgendarCorrida', 'instalarPlanoHyrox', 'aplicarPlanoHyrox', 'treinoEntryForDay', 'renderOutrasAtividadesDoDia'], { agora: '2026-11-23T10:00:00-03:00' }); // segunda
  const S = T.state;
  S.treinos = S.treinos || []; S.outros = S.outros || {}; S.musculacao = S.musculacao || {}; S.muscTemplates = S.muscTemplates || [];

  ok(T.HYROX_ROTINAS.length === 3 && T.HYROX_ROTINAS.every(r => r.exercicios.length === 8 || r.exercicios.length === 7), 'rotinas A/B/C com 7–8 exercícios cada');
  ok(T.HYROX_ROTINAS[0].exercicios.length === 8 && T.HYROX_ROTINAS[1].exercicios.length === 8, 'A e B com 8 exercícios');

  for (let w = 1; w <= 8; w++) {
    const t = T.hyroxTirosSemana(w), l = T.hyroxLongaoSemana(w);
    ok(t.tipo && t.steps.length >= 2 && t.totalKm > 0, `tiros semana ${w}: ${t.tipo} (${t.totalKm} km)`);
    ok(l.steps.length === 1 && l.totalKm > 0, `longão semana ${w}: ${l.totalKm} km`);
  }

  T.aplicarPlanoHyrox();
  const dias = S.treinos.filter(t => t.hyrox).map(t => t.day);
  ok(dias.length === 16, 'agenda 8 sextas + 8 domingos (' + dias.length + ')');
  ok(dias.includes('Sex 27/11') && dias.includes('Dom 29/11') && dias.includes('Sex 15/01'), 'datas certas: ' + dias.slice(0, 3).join(', '));
  T.hyroxAgendarCorrida();
  ok(S.treinos.filter(t => t.hyrox).length === 16, 'reagendar não duplica');
  ok(S.treinos.filter(t => t.hyrox).every(t => t.type && t.steps && t.cor), 'entradas com tipo, passos e cor');
  ok(['Seg','Qua','Ter','Qui','Dom'].every(d => (S.outros[d] || []).length > 0) && !(S.outros.Sex || []).length, 'atividades nos dias: Seg Ter Qua Qui Dom');
  ok(S.musculacao.Seg.length === 8 && S.musculacao.Qua.length === 8 && S.musculacao.Sex.length === 7, 'musculação instalada: 8, 8 e 7 exercícios');
  S.weekOffset = 0;
  const sexta = T.treinoEntryForDay('Sex'), dom = T.treinoEntryForDay('Dom');
  ok(sexta && /Tiros 5 x 1 km/.test(sexta.type) && dom && /10 km/.test(dom.type), 'aba Corrida acha tiros na sexta e longão no domingo da semana atual');
  S.selectedDayMusc = 'Ter';
  const html = T.renderOutrasAtividadesDoDia('Ter');
  ok(/Aula de Hyrox/.test(html) && /data-oact-edit/.test(html), 'dia mostra a Aula de Hyrox com botão de editar');
})().catch(e => { console.log('FALHOU', e); process.exit(1); });
