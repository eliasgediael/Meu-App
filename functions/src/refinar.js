// Lógica da Cloud Function refinarTreino, sem dependências do Firebase (testável no Node com dublês).
// Recebe o pedido minimizado do app, confere login, consentimento, tamanho e cotas, chama o Gemini com saída JSON
// forçada ao esquema e devolve a resposta. A validação completa do plano acontece no app (determinística);
// aqui só barra o que é barato e evidente (JSON inválido, id fora da lista enviada).
const crypto = require('crypto');
const ESQUEMA = require('./esquema-resposta.json');
const ESQUEMA_V2 = require('./esquema-resposta-v2.json');
const { conferirEsquema } = require('./validacao-esquema.js');
const { INSTRUCAO_SISTEMA, INSTRUCAO_SISTEMA_V2 } = require('./prompt.js');

const CONFIG_PADRAO = {
  ativa: false,                 // chave geral no servidor: desligada, a função recusa tudo
  modelo: 'gemini-2.5-flash',
  limiteDiaUsuario: 6,          // chamadas por usuário por dia (fuso de Brasília)
  limiteMesGlobal: 3000,        // chamadas por mês somando todos os usuários
  maxBytesPedido: 90000,
  maxOutputTokens: 4096,
  temperatura: 0.3,
  timeoutMs: 25000,
  cacheHoras: 24,
};

class ErroFuncao extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo; }
}
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function hashPedido(pedido, modelo) {
  return crypto.createHash('sha256').update(String(modelo) + '\n' + JSON.stringify(pedido)).digest('hex');
}
function diaEMesBrasil(agora) {
  const d = new Date(agora - 3 * 3600000);
  const iso = d.toISOString();
  return { dia: iso.slice(0, 10), mes: iso.slice(0, 7) };
}
// Conferência mínima do pedido: formato e tamanho. Não aceita campos pessoais (nome, e-mail, uid...).
function conferirPedido(pedido, maxBytes) {
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) throw new ErroFuncao('invalid-argument', 'pedido inválido');
  const txt = JSON.stringify(pedido);
  if (Buffer.byteLength(txt, 'utf8') > maxBytes) throw new ErroFuncao('invalid-argument', 'pedido grande demais');
  const permitidos = ['versaoContrato', 'tipo', 'semana', 'perfil', 'dias', 'regras', 'planoMotor', 'exerciciosAutorizados', 'historico'];
  const v2 = pedido.versaoContrato === '2';
  if (v2) permitidos.push('corrida', 'catalogo');
  Object.keys(pedido).forEach(k => { if (!permitidos.includes(k)) throw new ErroFuncao('invalid-argument', 'campo não previsto: ' + k); });
  if (!v2 && pedido.versaoContrato !== '1') throw new ErroFuncao('failed-precondition', 'versão de contrato não suportada');
  if (!Array.isArray(pedido.exerciciosAutorizados) || (!v2 && !pedido.exerciciosAutorizados.length) || pedido.exerciciosAutorizados.length > 400) throw new ErroFuncao('invalid-argument', 'lista de exercícios inválida');
  if (!Array.isArray(pedido.dias) || (!v2 && !pedido.dias.length) || pedido.dias.length > 7 || pedido.dias.some(d => !d || !DIAS.includes(d.dia))) throw new ErroFuncao('invalid-argument', 'dias inválidos');
  if (/"(nome|email|e-mail|uid|nascimento|foto|peso|altura|telefone|gps|latitude|longitude|pontos|rota)"\s*:/i.test(JSON.stringify({ perfil: pedido.perfil, historico: pedido.historico, corrida: pedido.corrida }))) {
    throw new ErroFuncao('invalid-argument', 'dado pessoal não permitido no pedido');
  }
  if (v2) {
    if (/"(regioesDeDor|dor|dorForte|frequenciaCardiaca)"\s*:/i.test(txt)) throw new ErroFuncao('invalid-argument', 'saúde não permitida no contrato v2');
    const c = pedido.corrida;
    if (!c || !Array.isArray(c.dias) || c.dias.length > 7 || (!c.dias.length && !pedido.dias.length) || new Set(c.dias.map(d=>d && d.dia)).size !== c.dias.length || !pedido.catalogo || !pedido.catalogo.opcoes || !pedido.catalogo.itens || !c.permitidos) throw new ErroFuncao('invalid-argument', 'corrida inválida');
    if (c.dias.some(d=>!d || !DIAS.includes(d.dia) || !Array.isArray(d.opcoes) || !d.opcoes.length || d.opcoes.length > 40 || d.opcoes.some(o=>!o || !Object.prototype.hasOwnProperty.call(pedido.catalogo.opcoes,o.id)))) throw new ErroFuncao('invalid-argument', 'menu de corrida inválido');
  }
}
// Barreira barata no servidor: JSON válido, objeto, e ids só da lista enviada. O resto é validado no app.
function conferirResposta(texto, pedido) {
  if (typeof texto !== 'string' || Buffer.byteLength(texto, 'utf8') > 30000) throw new ErroFuncao('internal', 'resposta grande demais');
  let r;
  try { r = JSON.parse(texto); } catch (e) { throw new ErroFuncao('internal', 'resposta da IA não é JSON'); }
  if (!r || typeof r !== 'object' || !Array.isArray(r.dias)) throw new ErroFuncao('internal', 'resposta da IA fora do esquema');
  if (pedido.versaoContrato === '2' && !conferirEsquema(r, ESQUEMA_V2)) throw new ErroFuncao('internal', 'resposta da IA fora do esquema v2');
  const ids = new Set(pedido.exerciciosAutorizados.map(e => e.id));
  for (const d of r.dias) for (const x of (d && d.exercicios) || []) {
    if (!x || !ids.has(x.id)) throw new ErroFuncao('internal', 'resposta da IA com exercício não autorizado');
  }
  if (pedido.versaoContrato === '2') {
    const dias = pedido.corrida.dias;
    if (r.corrida.length !== dias.length || new Set(r.corrida.map(d=>d.dia)).size !== r.corrida.length) throw new ErroFuncao('internal', 'dias de corrida inválidos');
    for (const d of r.corrida) {
      const menu = dias.find(x=>x.dia===d.dia);
      if (!menu || !menu.opcoes.some(o=>o.id===d.opcao)) throw new ErroFuncao('internal', 'opção fora do menu');
      for (const k of ['mobilidade','educativos','alongamentos']) if (d[k].some(id=>!(pedido.corrida.permitidos[k] || []).includes(id))) throw new ErroFuncao('internal', 'item de corrida não autorizado');
      if (d.progressao === 'pedir_progressao' && !pedido.corrida.progressaoPermitida) throw new ErroFuncao('internal', 'progressão não permitida');
    }
  }
  return r;
}

// dependencias: { chamarGemini({ modelo, instrucao, texto, esquema, maxOutputTokens, temperatura }) → Promise<string>,
//                 armazem: { consumirCota({ uid, dia, mes, limiteDia, limiteMes }) → Promise<{ ok, motivo }>,
//                            lerCache(hash) → Promise<obj|null>, gravarCache(hash, valor, expiraEm) → Promise },
//                 agora() → ms, config }
function criarRefinador(dependencias) {
  const cfg = { ...CONFIG_PADRAO, ...(dependencias.config || {}) };
  const agora = dependencias.agora || (() => Date.now());
  const { chamarGemini, armazem } = dependencias;
  return async function refinar(dados, auth) {
    if (!cfg.ativa) throw new ErroFuncao('unavailable', 'personalização por IA desligada');
    if (!auth || !auth.uid) throw new ErroFuncao('unauthenticated', 'login necessário');
    if (auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider === 'anonymous') throw new ErroFuncao('unauthenticated', 'login necessário');
    if (!dados || dados.consentimento !== true) throw new ErroFuncao('failed-precondition', 'consentimento necessário');
    const pedido = dados.pedido;
    conferirPedido(pedido, cfg.maxBytesPedido);
    const hash = hashPedido(pedido, cfg.modelo);
    const cache = await armazem.lerCache(hash);
    if (cache && cache.resposta && cache.expiraEm > agora()) {
      try { const resposta = conferirResposta(JSON.stringify(cache.resposta), pedido); return { resposta, modelo:cache.modelo, cache:true }; } catch(e) { /* cache inválido: não servir */ }
    }
    const { dia, mes } = diaEMesBrasil(agora());
    const cota = await armazem.consumirCota({ uid: auth.uid, dia, mes, limiteDia: cfg.limiteDiaUsuario, limiteMes: cfg.limiteMesGlobal });
    if (!cota || !cota.ok) throw new ErroFuncao('resource-exhausted', (cota && cota.motivo) || 'limite de uso atingido');
    let texto;
    let timer;
    try {
      texto = await Promise.race([
        chamarGemini({ modelo: cfg.modelo, instrucao: pedido.versaoContrato === '2' ? INSTRUCAO_SISTEMA_V2 : INSTRUCAO_SISTEMA, texto: JSON.stringify(pedido), esquema: pedido.versaoContrato === '2' ? ESQUEMA_V2 : ESQUEMA, maxOutputTokens: cfg.maxOutputTokens, temperatura: cfg.temperatura }),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), cfg.timeoutMs); }),
      ]);
    } catch (e) {
      throw new ErroFuncao('unavailable', 'IA indisponível');
    } finally { clearTimeout(timer); }
    if (typeof texto !== 'string' || !texto.length) throw new ErroFuncao('internal', 'resposta vazia da IA');
    const resposta = conferirResposta(texto, pedido);
    await armazem.gravarCache(hash, { resposta, modelo: cfg.modelo, expiraEm: agora() + cfg.cacheHoras * 3600000 });
    return { resposta, modelo: cfg.modelo, cache: false };
  };
}

module.exports = { criarRefinador, ErroFuncao, CONFIG_PADRAO, hashPedido, diaEMesBrasil, conferirPedido, conferirResposta };
