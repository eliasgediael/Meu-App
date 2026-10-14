// Carrega o app (harness do Node) e, por cima, o módulo de IA (src/ia/), empacotado com esbuild como o motor.
// O módulo de IA ainda não faz parte do motor.js: só os testes o carregam.
const path = require('path');
const esbuild = require('esbuild');
const { H, espera, AGORA_PADRAO } = require('./carregar.js');
const { PERFIS, BASE } = require('./perfis.js');

function codigoIA() {
  const r = esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', '..', 'src', 'ia', 'index.js')], bundle: true, format: 'iife', write: false, charset: 'utf8', legalComments: 'none' });
  return r.outputFiles[0].text;
}
const NOMES_IA = ['IA_CONFIG', 'IA_CONSENTIMENTO_VERSAO', 'iaConsentimentoEstado', 'iaConsentimentoIncluiSaude', 'iaRegistrarConsentimento', 'iaRevogarConsentimento',
  'iaContextoDoMotor', 'iaMontarPedido', 'iaLimites', 'iaValidarProposta', 'iaMontarSemanaFinal', 'iaRefinarSemana', 'iaAplicarFatorSeries', 'iaTipoPeloConteudo', 'IA_ESQUEMA_RESPOSTA'];

// O módulo de IA entra no MESMO trecho avaliado que o app (como um <script> a mais na página): assim enxerga as
// constantes do script principal (HYBRID_PAPEL_SCHEME, POOL...), igual ao navegador. Mesmo preparo do carregarApp.
async function carregarAppComIA(nomesApp = [], opts = {}) {
  H.NET.sdkOnline = false; navigator.onLine = false;
  H.congelarRelogio(opts.agora || AGORA_PADRAO);
  H.semearAleatorio(opts.seed || 42);
  const nomes = ['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'gerarPlanoSemanal', 'validarPlano', 'parseDescansoSec', ...nomesApp];
  (0, eval)(H.js + ';\nconfirmarApp=async()=>true;\nshowToast=()=>{};\n' + codigoIA() + ';\nglobalThis.__T={' + nomes.join(',') + '};');
  await espera(opts.espera || 700);
  const T = globalThis.__T;
  [...NOMES_IA, 'iaContextoCorridaV2', 'iaMontarPedidoV2', 'iaValidarPropostaV2', 'iaValidarCorridaV2', 'iaMontarSemanaFinalV2', 'iaRefinarSemanaV2', 'iaFotoDaSemana', 'iaPodeAplicar', 'iaCriarChamadaServidor', 'iaColetarHistoricoCorrida', 'iaResumoCorrida', 'IA_ESQUEMA_RESPOSTA_V2'].forEach(n => { T[n] = globalThis[n]; });
  return T;
}
const perfilQuiz = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
// Prepara o athleteProfile de um perfil sintético e gera o primeiro plano (como o app faz depois do questionário).
async function prepararPerfil(T, n) {
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar(perfilQuiz(n));
  await T.gerarPrimeiroPlanoV2();
  return S.athleteProfile;
}
// Resposta da IA que só repete o plano do motor (deve sempre passar: prova que os validadores aceitam o próprio motor).
function respostaIdentidade(T, muscPlan, ctx) {
  return {
    versao: '1',
    dias: Object.keys(muscPlan).map(d => ({ dia: d, exercicios: muscPlan[d].map(e => ({ id: ctx.autorizados.chavePorNome.get(e.nome), papel: e.papel, series: parseInt(e.series, 10), reps: parseInt(e.reps, 10), rpe: e.rpe, descansoSeg: T.parseDescansoSec(e.descanso) })) })),
    motivos: ['manter_plano'],
  };
}
module.exports = { carregarAppComIA, prepararPerfil, respostaIdentidade, PERFIS, codigoIA };
