// Bloco 4: contratos versionados (Assessment, sessões planejadas com id estável, vínculo atividade ↔ sessão,
// estados por modalidade). Nada aqui pode mudar o plano gerado.
const { H, carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarPlanoSemanal', 'montarAssessment', 'sessoesPlanejadasDaSemana',
    'vinculoDaAtividade', 'sugerirVinculo', 'estadoModalidade', 'atualizarSemanaDoPlano', 'isoDaChaveDia', 'listarAtividades', 'corridaProgressKey', 'registrarAtividadeLivre']);
  const S = T.state;
  const preparar = async (n) => { S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.treinos = []; S.musculacao = {}; S.corridaProgress = {};
    S.workoutSessionsLog = []; S.atividadesLivres = []; await T.qv2Aplicar(perfil(n)); };

  // Assessment
  const ass = {};
  for (const n of ['01', '03', '15']) { await preparar(n); ass[n] = T.montarAssessment(T.gerarPlanoSemanal(S.athleteProfile)); }
  conferir('contrato-assessment', ass);
  ok(ass['03'].runLevel !== ass['03'].strengthLevel, 'Assessment mantém níveis separados (perfil 03: corrida ' + ass['03'].runLevel + ', força ' + ass['03'].strengthLevel + ')');
  ok(ass['15'].currentPain.includes('joelho'), 'Assessment registra a dor atual (joelho)');

  // plano salvo com Assessment, versão e estados
  await preparar('08');
  await T.gerarPrimeiroPlanoV2();
  const hp = S.hybridPlanData;
  ok(hp.assessment && hp.assessment.engineVersion === hp.engineVersion && hp.assessment.measuredAt === '2026-10-05', 'plano guarda o Assessment com a versão do motor e a data');
  ok(T.estadoModalidade('corrida').semana === 1 && T.estadoModalidade('musculacao').semana === 1, 'estados de força e corrida começam na semana 1');

  // sessões planejadas com id estável
  const s1 = T.sessoesPlanejadasDaSemana(), s2 = T.sessoesPlanejadasDaSemana();
  ok(s1.length > 0 && JSON.stringify(s1.map(x => x.id)) === JSON.stringify(s2.map(x => x.id)), 'ids das sessões planejadas são estáveis (' + s1.length + ' sessões)');
  ok(new Set(s1.map(x => x.id)).size === s1.length, 'ids das sessões planejadas não se repetem');
  conferir('contrato-sessoes-planejadas', s1);

  // vínculo atividade ↔ sessão
  const corrida = s1.find(x => x.modalidade === 'corrida');
  S.corridaProgress[corrida.chave] = { done: true, data: corrida.data, km: '6', tempo: '36:00', gpsRunId: 'run_v' };
  const aPlano = T.listarAtividades().find(a => a.gpsRunId === 'run_v');
  const v = T.vinculoDaAtividade(aPlano);
  ok(v && v.sessaoId === corrida.id && v.confianca === 'alta', 'atividade gravada da sessão fica vinculada a ela (confiança alta)');
  ok(T.isoDaChaveDia('Qui 02/01', '2026-12-30') === '2027-01-02', 'data da chave do dia vira o ano corretamente');
  // atividade livre: só sugestão, e só se a sessão estiver pendente
  const outra = s1.find(x => x.modalidade === 'corrida' && x.id !== corrida.id);
  await T.registrarAtividadeLivre({ id: 'run:livre1', tipo: 'corrida', data: outra.data, distKm: 5, tempoSeg: 1800 });
  const sug = T.sugerirVinculo(T.listarAtividades().find(a => a.id === 'run:livre1'));
  ok(sug && sug.sessaoId === outra.id && sug.confianca === 'media', 'atividade livre recebe sugestão de vínculo com a sessão pendente do dia');
  ok(!S.corridaProgress[outra.chave], 'a sugestão não conclui a sessão sozinha');
  await T.registrarAtividadeLivre({ id: 'run:livre2', tipo: 'corrida', data: corrida.data, distKm: 3, tempoSeg: 1000 });
  ok(T.sugerirVinculo(T.listarAtividades().find(a => a.id === 'run:livre2')) === null, 'sessão já concluída não recebe sugestão');

  // virada da semana: estados avançam junto com a semana do plano
  H.congelarRelogio('2026-10-12T10:00:00-03:00');
  await T.atualizarSemanaDoPlano();
  ok(T.estadoModalidade('corrida').semana === 2 && T.estadoModalidade('musculacao').semana === 2 && S.hybridPlanData.estados, 'na semana seguinte força e corrida passam para a semana 2');
  H.congelarRelogio('2026-10-05T10:00:00-03:00');

  semErro();
  process.exit(process.exitCode || 0);
})();
