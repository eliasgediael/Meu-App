// Pausar e retomar o plano (decisões 1A e 2 do relatório aprovado em 07/10/2026).
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const em = (iso) => H.congelarRelogio(iso + 'T10:00:00-03:00');

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'atualizarSemanaDoPlano', 'pausarPlano', 'retomarPlano',
    'propostaRetomada', 'planoPausado', 'checkinDiarioPendente', 'treinosPerdidos', 'chaveDiaAtual', 'versoesDoPlano', 'retornoParaDias', 'registrarAtividadeLivre',
    'listarAtividades', 'renderHojeV2Content', 'renderTreinoV2Content', 'diaPausado', 'mrtCheckinRow']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.planoVersoes = [];
  S.diarioTreinador = []; S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = []; S.checkinDiario = {};
  await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  const hp = () => S.hybridPlanData;
  const corridasDaSemana = () => S.treinos.filter(t => ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map(d => T.chaveDiaAtual(d)).includes(t.day));
  const totalSemana1 = (hp().plan[0].corridaWeek || []).length;

  // segunda: corrida feita; quarta: pausa
  const corridaSeg = S.treinos.find(t => t.day === T.chaveDiaAtual('Seg'));
  if (corridaSeg) S.corridaProgress[corridaSeg.day] = { done: true, km: '5', tempo: '30:00', data: '2026-10-05' };
  await T.registrarAtividadeLivre({ id: 'run:livre', tipo: 'corrida', data: '2026-10-06', distKm: 3, tempoSeg: 1100 });
  const atividades = JSON.stringify(T.listarAtividades());
  em('2026-10-07');
  const nVers = T.versoesDoPlano().length;
  await T.pausarPlano('viagem');
  ok(T.planoPausado() && hp().pausa.inicio === '2026-10-07' && hp().pausa.semana === 1, 'pausar grava início e semana');
  ok(T.versoesDoPlano().length === nVers + 1 && T.versoesDoPlano()[0].origem === 'pausa', 'pausar guarda versão antes');
  ok(!corridasDaSemana().some(t => ['Qua', 'Qui', 'Sex', 'Sab', 'Dom'].some(d => t.day === T.chaveDiaAtual(d))), 'sessões planejadas de hoje em diante saem da agenda');
  ok(!corridaSeg || S.treinos.some(t => t.day === corridaSeg.day), 'corrida já feita antes da pausa continua');
  ok(!T.checkinDiarioPendente() && T.treinosPerdidos().length === 0 && T.mrtCheckinRow() === '', 'pausa suspende check-ins e treino perdido');
  ok(/Plano pausado/.test(T.renderHojeV2Content()) && /data-retomarplano/.test(T.renderHojeV2Content()), 'Início mostra o plano pausado com Retomar');
  ok(T.diaPausado('Qui') && !T.diaPausado('Seg'), 'dias da pausa aparecem como pausados');

  // semana seguinte: não avança
  em('2026-10-12'); await T.atualizarSemanaDoPlano();
  ok(hp().currentWeekIndex === 1 && !Object.keys(S.musculacao).some(d => !(S.muscDayOrigin || {})[d]), 'durante a pausa a semana não avança e o plano não entra na agenda');

  // retomar com 8 dias (quinta 15/10): volta na semana 1, só nos dias que restam
  em('2026-10-15');
  const p = T.propostaRetomada();
  ok(p.dias === 8 && !p.retorno && !p.leve, 'até 14 dias: sem semana de retorno');
  await T.retomarPlano(false, p);
  ok(!T.planoPausado() && hp().startMonday === '2026-10-12' && hp().currentWeekIndex === 1, 'retoma na mesma semana; a data de início anda junto');
  const novas = corridasDaSemana();
  ok(novas.every(t => ['Qui', 'Sex', 'Sab', 'Dom'].some(d => t.day === T.chaveDiaAtual(d))), 'sessões só nos dias que restam');
  ok(novas.length <= totalSemana1 - (corridaSeg ? 1 : 0), `corrida feita antes da pausa não volta (${novas.length} de ${totalSemana1})`);
  ok(hp().pausas.length === 1 && hp().pausas[0].dias === 8, 'pausa vai para o histórico de pausas');
  ok(S.diarioTreinador.some(r => r.alteracao === 'Plano pausado') && S.diarioTreinador.some(r => r.alteracao === 'Plano retomado'), 'histórico de mudanças registra pausa e retomada');
  ok(JSON.stringify(T.listarAtividades()) === atividades, 'pausa não mexe em atividades');
  em('2026-10-19'); await T.atualizarSemanaDoPlano();
  ok(hp().currentWeekIndex === 2, 'na segunda seguinte começa a semana 2');

  // pausa longa (21 dias): propõe semana de retorno mais leve
  await T.pausarPlano(null);
  em('2026-11-09');
  const q = T.propostaRetomada();
  const km = (w) => (w.corridaWeek || []).reduce((t, c) => t + (c.totalKm || 0), 0);
  const series = (w) => Object.values(w.muscPlan || {}).flat().reduce((t, e) => t + (parseInt(e.series, 10) || 0), 0);
  ok(q.dias === 21 && q.retorno && q.retorno.volumeFator === 0.8 && q.leve, 'mais de 14 dias: propõe semana de retorno (80%)');
  ok(km(q.leve) <= km(q.normal) && (series(q.normal) === 0 || series(q.leve) < series(q.normal)), `retorno mais leve: ${km(q.leve).toFixed(1)} × ${km(q.normal).toFixed(1)} km, ${series(q.leve)} × ${series(q.normal)} séries`);
  ok(!(q.leve.corridaWeek || []).some(c => /interval|repeti|limiar|tempo|prova/i.test(c.type)), 'retorno sem treino de qualidade (' + (q.leve.corridaWeek || []).map(c => c.type).join(', ') + ')');
  await T.retomarPlano(true, q);
  ok(hp().currentWeekIndex === 2 && hp().pausas[1].retorno === 'leve', 'retomada com a semana mais leve confirmada');
  const r30 = T.retornoParaDias(30);
  ok(r30.volumeFator === 0.7 && r30.sugerirQuestionario && T.retornoParaDias(14) === null, 'mais de 28 dias: 70% e sugestão de revisar o questionário');
  semErro();
  process.exit(process.exitCode || 0);
})();
