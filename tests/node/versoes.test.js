// Versões do plano: guardar antes de cada mudança relevante, listar e restaurar só o planejamento.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'versoesDoPlano', 'carregarVersoesPlano',
    'lerVersaoDoPlano', 'restaurarVersaoDoPlano', 'aplicarCheckinSemanalV2', 'registrarAtividadeLivre', 'listarAtividades', 'chaveDiaAtual']);
  const S = T.state;
  const tipos = (hp) => (hp.plan[0].corridaWeek || []).map(c => c.day + ':' + c.type).join(',');
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.planoVersoes = [];
  S.diarioTreinador = []; S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = [];

  await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  ok(T.versoesDoPlano().length === 0, 'primeiro plano não cria versão (não havia plano antes)');
  const planoA = tipos(S.hybridPlanData), semanasA = S.hybridPlanData.plan.length;
  S.athleteProfile.identidade.nome = { valor: 'Ana', origem: 'informado', confianca: 'alta', atualizadoEm: null };

  await T.qv2Aplicar(perfil('03')); await T.gerarPrimeiroPlanoV2();
  const planoB = tipos(S.hybridPlanData);
  ok(T.versoesDoPlano().length === 1 && T.versoesDoPlano()[0].motivo === 'Plano refeito' && T.versoesDoPlano()[0].origem === 'refazer', 'refazer o plano guarda a versão anterior');
  const m = T.versoesDoPlano()[0];
  ok(m.data && m.hora && m.engineVersion && m.resumo && /semanas/.test(m.resumo), 'versão tem data, hora, versão do motor e resumo');
  const snap = await T.lerVersaoDoPlano(m.id);
  ok(snap && tipos(snap.hp) === planoA && !snap.perfil.identidade, 'versão guarda o plano anterior, sem dados pessoais');

  // histórico e atividades feitos depois da versão
  await T.registrarAtividadeLivre({ id: 'run:x', tipo: 'corrida', data: '2026-10-05', distKm: 5, tempoSeg: 1500 });
  S.hybridPlanData = { ...T.aplicarCheckinSemanalV2(S.hybridPlanData, 1, { fadiga: 2 }, 'normal') };
  ok(T.versoesDoPlano().length === 2 && /Check-in da semana 1/.test(T.versoesDoPlano()[0].motivo), 'check-in guarda versão antes do ajuste');
  const checkinsAntes = JSON.stringify(S.hybridPlanData.checkinsSemanais);
  const atividadesAntes = JSON.stringify(T.listarAtividades());
  S.athleteProfile.identidade.nome = { valor: 'Ana Paula', origem: 'informado', confianca: 'alta', atualizadoEm: null };

  const restaurou = await T.restaurarVersaoDoPlano(m.id);
  ok(restaurou && tipos(S.hybridPlanData) === planoA && S.hybridPlanData.plan.length === semanasA, 'restaurar volta o planejamento da versão');
  ok(planoA !== planoB, 'os dois planos do teste são diferentes (o teste compara algo real)');
  ok(JSON.stringify(S.hybridPlanData.checkinsSemanais) === checkinsAntes && JSON.stringify(T.listarAtividades()) === atividadesAntes, 'restaurar não mexe em check-ins nem atividades');
  ok(S.athleteProfile.identidade.nome.valor === 'Ana Paula', 'restaurar mantém os dados pessoais atuais');
  ok(T.versoesDoPlano().length === 3 && T.versoesDoPlano()[0].origem === 'restauracao', 'o plano em uso vira versão antes de restaurar (dá para desfazer)');
  ok(S.diarioTreinador.some(r => r.alteracao === 'Versão anterior restaurada'), 'histórico registra "Versão anterior restaurada"');
  ok(S.hybridPlanData.startMonday === snap.hp.startMonday, 'contagem de semanas segue a data de início da versão');
  const hoje = T.chaveDiaAtual('Seg');
  const corridaHoje = (S.treinos || []).find(t => t.day === hoje), planejadaHoje = (snap.hp.plan[0].corridaWeek || []).find(c => c.day === 'Seg');
  ok(!planejadaHoje || (corridaHoje && corridaHoje.type === planejadaHoje.type), 'agenda de hoje em diante vem da versão restaurada');

  // desfazer: restaura a versão "antes de restaurar"; a corrida de hoje já feita fica como foi
  if (corridaHoje) S.corridaProgress[hoje] = { done: true, km: '5', tempo: '25:00', data: '2026-10-05' };
  await T.restaurarVersaoDoPlano(T.versoesDoPlano()[0].id);
  if (corridaHoje) ok((S.treinos.find(t => t.day === hoje) || {}).type === corridaHoje.type && S.corridaProgress[hoje].done, 'sessão já feita hoje não muda ao restaurar');
  ok(tipos(S.hybridPlanData) === tipos((await T.lerVersaoDoPlano(T.versoesDoPlano()[1].id)).hp), 'desfazer volta ao plano que estava em uso');

  // índice persiste
  const n = T.versoesDoPlano().length; S.planoVersoes = null; await T.carregarVersoesPlano();
  ok(T.versoesDoPlano().length === n, 'índice de versões é salvo e recarregado');
  semErro();
  process.exit(process.exitCode || 0);
})();
