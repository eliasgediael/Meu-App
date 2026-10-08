// Encerrar plano e fim natural do plano (item 5 do relatório aprovado em 07/10/2026).
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const em = (iso) => H.congelarRelogio(iso + 'T10:00:00-03:00');

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'atualizarSemanaDoPlano', 'encerrarPlano', 'planoConcluido',
    'dispensarPlanoConcluido', 'resumoPlanoConcluido', 'versoesDoPlano', 'restaurarVersaoDoPlano', 'listarAtividades', 'registrarAtividadeLivre', 'chaveDiaAtual',
    'renderHojeV2Content', 'renderPerfilV2Content']);
  const S = T.state;
  const novo = async () => {
    S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.planoVersoes = [];
    S.diarioTreinador = []; S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = []; S.muscDayOrigin = {};
    await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  };
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

  em('2026-10-05'); await novo();
  const seg = S.treinos.find(t => t.day === T.chaveDiaAtual('Seg'));
  if (seg) S.corridaProgress[seg.day] = { done: true, km: '5', tempo: '30:00', data: '2026-10-05' };
  await T.registrarAtividadeLivre({ id: 'run:e', tipo: 'corrida', data: '2026-10-04', distKm: 4, tempoSeg: 1400 });
  const atividades = JSON.stringify(T.listarAtividades());
  em('2026-10-06');
  await T.encerrarPlano();
  ok(S.hybridPlanData === null && T.versoesDoPlano()[0].origem === 'encerrado', 'encerrar arquiva o plano como versão');
  ok(!dias.slice(1).some(d => S.treinos.some(t => t.day === T.chaveDiaAtual(d))) && (!seg || S.treinos.some(t => t.day === seg.day)), 'sai o planejado de hoje em diante; o passado fica');
  ok(!Object.keys(S.musculacao).some(d => !(S.muscDayOrigin || {})[d]), 'musculação do plano sai da agenda');
  ok(JSON.stringify(T.listarAtividades()) === atividades && S.diarioTreinador.some(x => x.alteracao === 'Plano encerrado'), 'atividades ficam; histórico registra');
  ok(/Você ainda não tem um plano/.test(T.renderHojeV2Content()), 'Início volta para "Você ainda não tem um plano"');
  ok(/data-pfacao="versoes"/.test(T.renderPerfilV2Content()), 'sem plano, o Perfil dá acesso às versões');
  await T.restaurarVersaoDoPlano(T.versoesDoPlano()[0].id);
  ok(S.hybridPlanData && S.hybridPlanData.plan.length > 0, 'plano encerrado pode ser restaurado');

  // fim natural
  em('2026-10-05'); await novo();
  const semanas = S.hybridPlanData.plan.length;
  const fim = new Date(2026, 9, 5 + semanas * 7);
  em(fim.toISOString().slice(0, 10));
  await T.atualizarSemanaDoPlano();
  ok(T.planoConcluido() && !Object.keys(S.musculacao).some(d => !(S.muscDayOrigin || {})[d]), 'depois da última semana: plano concluído, sem repetir a musculação');
  const h = T.renderHojeV2Content();
  ok(/Plano concluído/.test(h) && /data-proximoplano/.test(h) && /data-agoranao/.test(h), 'Início mostra Plano concluído, Criar próximo plano e Agora não');
  const r = T.resumoPlanoConcluido();
  ok(r.semanas === semanas && r.corridas === 0, 'resumo usa só o que foi registrado');
  await T.dispensarPlanoConcluido();
  ok(S.hybridPlanData === null && T.versoesDoPlano()[0].origem === 'concluido', '"Agora não" arquiva o plano concluído');
  semErro();
  process.exit(process.exitCode || 0);
})();
