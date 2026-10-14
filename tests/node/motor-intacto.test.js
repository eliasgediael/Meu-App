// Motor V2 intacto (Etapa 1 do catálogo de corrida): retrato COMPLETO do que o motor gera hoje, gravado ANTES de
// criar src/motor/corrida-catalogo.js (tests/snapshots/motor-antes-catalogo.json). Depois do catálogo, a saída precisa
// continuar idêntica, byte a byte: 20 perfis × todas as semanas do bloco (corrida com todos os campos e etapas do GPS,
// musculação, trajetória, validação) e as semanas geradas depois de cada resultado do check-in semanal.
// Também confere que nenhuma função do catálogo é chamada pela geração normal do plano.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const copia = (x) => JSON.parse(JSON.stringify(x));
const FUNCOES_CATALOGO = ['corridaOpcoesDoDia', 'corridaMontarOpcao', 'corridaAquecimentoPadrao', 'corridaBlocosDetalhados', 'corridaContextoDoDia', 'corridaOpcaoElegivel', 'corridaCargaIntensa'];

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'gerarPlanoSemanal', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'aplicarCheckinSemanalV2']);
  const S = T.state;
  // Espiões: se o catálogo existir, nenhuma das suas funções pode rodar durante a geração normal.
  const chamadas = {};
  FUNCOES_CATALOGO.forEach(n => {
    if (typeof globalThis[n] !== 'function') return;
    const orig = globalThis[n];
    chamadas[n] = 0;
    globalThis[n] = function (...a) { chamadas[n]++; return orig.apply(this, a); };
  });
  const preparar = async (R) => { S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.corridaVdotData = null; S.treinos = []; S.musculacao = {}; await T.qv2Aplicar(R); };
  const semana = (w) => w ? { weekNumber: w.weekNumber, phaseLabel: w.phaseLabel, totalWeeks: w.totalWeeks, pendente: !!w.pendente,
    corridaWeek: w.corridaWeek || [], muscPlan: w.muscPlan || {}, legEasingNotes: w.legEasingNotes || [] } : null;

  const out = { perfis: {}, checkin: {} };
  for (const [nome, R0] of PERFIS) {
    await preparar({ ...BASE, ...R0 });
    const r = T.gerarPlanoSemanal(S.athleteProfile);
    const reg = { semana1: r.bloqueado ? { bloqueado: true, status: r.status } : { semana: semana(r.semana), validacao: r.validacao, trajetoria: r.trajetoria, sessoes: r.sessoes, decisoes: r.decisoes } };
    if (!r.bloqueado) {
      await T.gerarPrimeiroPlanoV2();
      const hp = S.hybridPlanData;
      reg.bloco = [semana(hp.plan[0])];
      for (let n = 2; n <= hp.plan.length; n++) reg.bloco.push(semana(T.gerarSemanaV2(n)));
    }
    out.perfis[nome.slice(0, 2)] = reg;
  }
  for (const n of ['03', '08', '09']) {
    await preparar({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
    await T.gerarPrimeiroPlanoV2();
    const hp0 = copia(S.hybridPlanData);
    out.checkin[n] = {};
    for (const fadiga of [1, 3, 5]) for (const dor of [false, true]) for (const resposta of ['facil', 'normal', 'dificil']) {
      S.hybridPlanData = T.aplicarCheckinSemanalV2(copia(hp0), 1, { fadiga, dor, motivos: [] }, resposta);
      out.checkin[n][`f${fadiga}-${dor ? 'dor' : 'semdor'}-${resposta}`] = { ajuste: S.hybridPlanData.ajusteProximaSemana, semana2: semana(T.gerarSemanaV2(2)) };
    }
  }
  conferir('motor-antes-catalogo', out);
  const usadas = Object.entries(chamadas).filter(([, n]) => n > 0);
  ok(usadas.length === 0, 'geração normal do plano não chama nenhuma função do catálogo' + (usadas.length ? ' — ' + usadas.map(([k, n]) => k + ' ' + n + 'x').join(', ') : ` (${Object.keys(chamadas).length} funções vigiadas)`));
  semErro();
  process.exit(process.exitCode || 0);
})();
