// IA (Gemini) — lógica da Cloud Function refinarTreino com dublês (sem Firebase, sem rede, sem chave).
// Desligada por padrão, login obrigatório, consentimento, conferência do pedido, cotas, cache, tempo-limite e
// barreira de ids. Também confere que a chave nunca aparece no código do app.
const fs = require('fs'), path = require('path');
const { ok } = require('../harness/carregar.js');
const { criarRefinador, CONFIG_PADRAO } = require('../../functions/src/refinar.js');
const ESQUEMA = require('../../functions/src/esquema-resposta.json');

const RAIZ = path.resolve(__dirname, '..', '..');
const pedidoBase = () => ({
  versaoContrato: '1', tipo: 'inicial', semana: { numero: 1, fase: 'Base' },
  perfil: { faixaEtaria: '30-39', nivel: 'intermediario', objetivo: 'massa', padroesDominados: [] },
  dias: [{ dia: 'Seg', tipoMotor: 'upper' }], regras: { totalSeriesSemanaMax: 20, diasFixos: ['Seg'] },
  planoMotor: [{ dia: 'Seg', exercicios: [{ id: '0025', papel: 'base', series: 4, reps: 8, rpe: 8, descansoSeg: 75 }] }],
  exerciciosAutorizados: [{ id: '0025', nome: 'Supino reto com barra', grupo: 'Peito' }, { id: '0314', nome: 'Supino inclinado com halteres', grupo: 'Peito' }],
  historico: null,
});
const respostaOk = { versao: '1', dias: [{ dia: 'Seg', exercicios: [{ id: '0314', papel: 'base', series: 3, reps: 10, rpe: 7, descansoSeg: 75 }] }], motivos: ['variedade'] };
function armazemMemoria() {
  const uso = new Map(), cache = new Map();
  return {
    uso, cache,
    async consumirCota({ uid, dia, mes, limiteDia, limiteMes }) {
      const ku = uid + '_' + dia, kg = 'g_' + mes;
      if ((uso.get(ku) || 0) >= limiteDia) return { ok: false, motivo: 'limite diário do usuário' };
      if ((uso.get(kg) || 0) >= limiteMes) return { ok: false, motivo: 'limite mensal do app' };
      uso.set(ku, (uso.get(ku) || 0) + 1); uso.set(kg, (uso.get(kg) || 0) + 1);
      return { ok: true };
    },
    async lerCache(h) { return cache.get(h) || null; },
    async gravarCache(h, v) { cache.set(h, v); },
  };
}
const falhaCom = async (fn, codigo, msg) => {
  try { await fn(); ok(false, msg + ' (não falhou)'); } catch (e) { ok(e.codigo === codigo, msg + ` [${e.codigo}]`); }
};

(async () => {
  let chamadasGemini = 0, ultimaChamada = null;
  const gemini = (texto) => async (args) => { chamadasGemini++; ultimaChamada = args; return typeof texto === 'function' ? texto(args) : texto; };
  const auth = { uid: 'u1', token: { firebase: { sign_in_provider: 'google.com' } } };
  const dados = (extra) => ({ consentimento: true, pedido: pedidoBase(), ...extra });

  ok(CONFIG_PADRAO.ativa === false, 'função desligada por padrão');
  await falhaCom(() => criarRefinador({ chamarGemini: gemini(''), armazem: armazemMemoria() })(dados(), auth), 'unavailable', 'desligada: recusa');

  const arm = armazemMemoria();
  const ref = (extra = {}) => criarRefinador({ chamarGemini: extra.gemini || gemini(JSON.stringify(respostaOk)), armazem: extra.armazem || arm, agora: extra.agora, config: { ativa: true, ...(extra.config || {}) } });
  await falhaCom(() => ref()(dados(), null), 'unauthenticated', 'sem login: recusa');
  await falhaCom(() => ref()(dados(), { uid: 'a', token: { firebase: { sign_in_provider: 'anonymous' } } }), 'unauthenticated', 'login anônimo: recusa');
  await falhaCom(() => ref()(dados({ consentimento: false }), auth), 'failed-precondition', 'sem consentimento: recusa');
  await falhaCom(() => ref()(dados({ pedido: { ...pedidoBase(), extra: 1 } }), auth), 'invalid-argument', 'campo não previsto no pedido: recusa');
  await falhaCom(() => ref()(dados({ pedido: { ...pedidoBase(), perfil: { nome: 'Maria' } } }), auth), 'invalid-argument', 'dado pessoal no pedido: recusa');
  await falhaCom(() => ref()(dados({ pedido: { ...pedidoBase(), versaoContrato: '9' } }), auth), 'failed-precondition', 'versão de contrato desconhecida: recusa');
  const grande = pedidoBase(); grande.exerciciosAutorizados = Array.from({ length: 390 }, (_, i) => ({ id: 'x' + i, nome: 'n'.repeat(300) }));
  await falhaCom(() => ref()(dados({ pedido: grande }), auth), 'invalid-argument', 'pedido grande demais: recusa');
  ok(chamadasGemini === 0, 'nenhuma recusa chegou ao Gemini');

  const r1 = await ref()(dados(), auth);
  ok(r1.resposta.dias[0].exercicios[0].id === '0314' && r1.cache === false, 'pedido válido: resposta do Gemini');
  ok(ultimaChamada.esquema === ESQUEMA && /exerciciosAutorizados/.test(ultimaChamada.instrucao), 'Gemini recebe o esquema estruturado e a instrução');
  ok(!/"uid"|u1/.test(ultimaChamada.texto), 'Gemini não recebe o uid');
  const r2 = await ref()(dados(), auth);
  ok(r2.cache === true && chamadasGemini === 1, 'mesmo pedido: devolve do cache sem nova chamada');

  // cotas
  const arm2 = armazemMemoria();
  const varia = (i) => { const p = pedidoBase(); p.semana.numero = i; return { consentimento: true, pedido: p }; };
  for (let i = 0; i < 2; i++) await ref({ armazem: arm2, config: { limiteDiaUsuario: 2 } })(varia(i), auth);
  await falhaCom(() => ref({ armazem: arm2, config: { limiteDiaUsuario: 2 } })(varia(9), auth), 'resource-exhausted', 'cota diária do usuário');
  const arm3 = armazemMemoria();
  await ref({ armazem: arm3, config: { limiteMesGlobal: 1 } })(varia(1), auth);
  await falhaCom(() => ref({ armazem: arm3, config: { limiteMesGlobal: 1 } })(varia(2), { uid: 'outra' }), 'resource-exhausted', 'teto mensal do app');

  // respostas ruins do Gemini
  await falhaCom(() => ref({ armazem: armazemMemoria(), gemini: gemini('isto não é json') })(dados(), auth), 'internal', 'Gemini devolve texto: erro');
  const inventado = JSON.parse(JSON.stringify(respostaOk)); inventado.dias[0].exercicios[0].id = '9999';
  await falhaCom(() => ref({ armazem: armazemMemoria(), gemini: gemini(JSON.stringify(inventado)) })(dados(), auth), 'internal', 'Gemini inventa exercício: erro');
  await falhaCom(() => ref({ armazem: armazemMemoria(), gemini: async () => { throw new Error('quota'); } })(dados(), auth), 'unavailable', 'Gemini fora do ar: erro');
  await falhaCom(() => ref({ armazem: armazemMemoria(), gemini: () => new Promise(() => {}), config: { timeoutMs: 30 } })(dados(), auth), 'unavailable', 'Gemini sem resposta: tempo-limite');
  const armVazio = armazemMemoria();
  await falhaCom(() => ref({ armazem: armVazio, gemini: gemini('nada') })(dados(), auth), 'internal', 'resposta ruim não vai para o cache');
  ok(armVazio.cache.size === 0, 'cache vazio depois de resposta ruim');

  // A chave nunca está no app nem no código da função.
  const app = fs.readFileSync(path.join(RAIZ, 'treino-app.html'), 'utf8');
  const arquivos = ['src/ia/config.js', 'src/ia/contrato.js', 'src/ia/validador.js', 'src/ia/refino.js', 'src/ia/consentimento.js', 'functions/index.js', 'functions/src/refinar.js'].map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  ok(![app, ...arquivos].some(t => /GEMINI_API_KEY\s*[:=]\s*['"][A-Za-z0-9_-]{20,}/.test(t) || /generativelanguage\.googleapis\.com/.test(t)), 'nenhuma chave do Gemini no código');
  ok(/defineSecret\('GEMINI_API_KEY'\)/.test(arquivos[5]), 'função lê a chave do Secret Manager');
  ok(!/gemini|refinarTreino|src\/ia/i.test(app), 'app ainda não chama a IA (integração desligada)');
})();
