// Cloudflare Worker do Forza Run: liga o app (iPhone) ao Gemini sem Cloud Functions (Firebase continua no Spark).
//
//   POST /refinar   Authorization: Bearer <ID token do Firebase>   corpo: { consentimento:true, pedido }
//                   → 200 { resposta, modelo, cache }   ou   4xx/5xx { erro: { codigo, mensagem } }
//   GET  /saude     → { ok:true, ativa } (sem segredos)
//
// A regra de negócio é a mesma da Cloud Function: functions/src/refinar.js (login, consentimento, pedido sem dados
// pessoais, cache, cotas, tempo-limite, ids só da lista enviada). A validação completa (F0–F9 + validarPlano) continua
// no app; qualquer erro aqui faz o app ficar com o plano do Motor V2.
import refinarCjs from '../../functions/src/refinar.js';
import { criarVerificadorFirebase } from './auth-firebase.js';
import { criarArmazemCloudflare, cotasDoDurableObject } from './armazem-kv.js';
import { criarChamadaGemini } from './gemini.js';
import { CotaIA } from './cota-do.js';

const { criarRefinador, ErroFuncao } = refinarCjs;

const TAMANHO_MAX_CORPO = 100000;
const HTTP_POR_CODIGO = {
  'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'failed-precondition': 412,
  'resource-exhausted': 429, unavailable: 503, internal: 502,
};

const inteiro = (v, padrao, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const log = (o) => console.log(JSON.stringify(o));

function origensPermitidas(env) {
  return String(env.ORIGENS_PERMITIDAS || '').split(',').map(s => s.trim()).filter(Boolean);
}
// CORS só importa para o WebView (capacitor://localhost no iPhone). Não é a proteção: a proteção é o token.
function cabecalhosCors(origem, env) {
  const h = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origem && origensPermitidas(env).includes(origem)) {
    h['Access-Control-Allow-Origin'] = origem;
    h['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(corpo, status, cors) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
}
const erro = (codigo, mensagem, cors) => json({ erro: { codigo, mensagem } }, HTTP_POR_CODIGO[codigo] || 500, cors);

// dependencias (só para testes): { verificarToken, armazem, chamarGemini, fetchGemini, agora }
async function atender(request, env, dependencias) {
  const dep = dependencias || {};
  const inicio = Date.now();
  const url = new URL(request.url);
  const origem = request.headers.get('Origin');
  const cors = cabecalhosCors(origem, env);
  const registrar = (status, extra) => log({ rota: url.pathname, metodo: request.method, status, ms: Date.now() - inicio, ...(extra || {}) });

  // Navegador de outra origem: recusa cedo (o app nativo manda capacitor://localhost; ferramentas sem Origin passam).
  if (origem && !cors['Access-Control-Allow-Origin']) { registrar(403, { motivo: 'origem' }); return json({ erro: { codigo: 'permission-denied', mensagem: 'origem não permitida' } }, 403, cors); }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (url.pathname === '/saude' && request.method === 'GET') return json({ ok: true, ativa: env.IA_ATIVA === 'true' }, 200, cors);
  if (url.pathname !== '/refinar') return json({ erro: { codigo: 'not-found', mensagem: 'rota inexistente' } }, 404, cors);
  if (request.method !== 'POST') return json({ erro: { codigo: 'method-not-allowed', mensagem: 'use POST' } }, 405, cors);

  const ativa = env.IA_ATIVA === 'true';
  if (!ativa) { registrar(503, { codigo: 'unavailable', motivo: 'desligada' }); return erro('unavailable', 'personalização por IA desligada', cors); }
  if (!env.GEMINI_API_KEY && !dep.chamarGemini) { registrar(503, { codigo: 'unavailable', motivo: 'segredo ausente' }); return erro('unavailable', 'IA indisponível', cors); }

  // 1) Login
  let auth;
  try {
    const verificar = dep.verificarToken || criarVerificadorFirebase({ projectId: env.FIREBASE_PROJECT_ID });
    auth = await verificar(request.headers.get('Authorization'));
  } catch (e) {
    registrar(401, { codigo: 'unauthenticated', motivo: (e && e.motivo) || 'erro' });
    return erro('unauthenticated', 'login necessário', cors);
  }

  // 2) Corpo (tamanho antes de ler tudo)
  const declarado = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declarado > TAMANHO_MAX_CORPO) { registrar(413); return json({ erro: { codigo: 'invalid-argument', mensagem: 'pedido grande demais' } }, 413, cors); }
  let dados;
  try {
    const texto = await request.text();
    if (texto.length > TAMANHO_MAX_CORPO) { registrar(413); return json({ erro: { codigo: 'invalid-argument', mensagem: 'pedido grande demais' } }, 413, cors); }
    dados = JSON.parse(texto);
  } catch (e) {
    registrar(400, { codigo: 'invalid-argument', motivo: 'json' });
    return erro('invalid-argument', 'corpo inválido', cors);
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) { registrar(400); return erro('invalid-argument', 'corpo inválido', cors); }
  const extras = Object.keys(dados).filter(k => k !== 'consentimento' && k !== 'pedido');
  if (extras.length) { registrar(400, { motivo: 'campo extra' }); return erro('invalid-argument', 'campo não previsto', cors); }

  // 3) Consentimento, pedido, cache, cotas, Gemini: a mesma lógica da Cloud Function
  const timeoutMs = inteiro(env.IA_TIMEOUT_MS, 45000, 5000, 50000);
  const refinar = criarRefinador({
    chamarGemini: dep.chamarGemini || criarChamadaGemini({ apiKey: env.GEMINI_API_KEY, fetch: dep.fetchGemini, nivelPensamento: env.GEMINI_NIVEL_PENSAMENTO, formatoEsquema: env.GEMINI_FORMATO_ESQUEMA, timeoutMs: timeoutMs - 1000, esperaRetentativaMs: inteiro(env.GEMINI_ESPERA_RETENTATIVA_MS, 2500, 0, 10000), novaTentativa: env.GEMINI_NOVA_TENTATIVA !== 'false', log }),
    armazem: dep.armazem || criarArmazemCloudflare({
      kv: env.IA_CACHE,
      cotas: cotasDoDurableObject(env.COTAS),
      limites: { diaGlobal: inteiro(env.IA_LIMITE_DIA_GLOBAL, 15, 1, 100000), minuto: inteiro(env.IA_LIMITE_MINUTO_GLOBAL, 4, 1, 10000) },
    }),
    agora: dep.agora,
    config: {
      ativa,
      modelo: env.GEMINI_MODELO || 'gemini-3.5-flash-lite',
      limiteDiaUsuario: inteiro(env.IA_LIMITE_DIA_USUARIO, 3, 1, 100),
      limiteMesGlobal: inteiro(env.IA_LIMITE_MES_GLOBAL, 450, 1, 3000000),
      maxOutputTokens: inteiro(env.GEMINI_MAX_TOKENS, 8192, 1024, 65536),
      timeoutMs,
    },
  });
  try {
    const r = await refinar(dados, auth);
    registrar(200, { cache: !!r.cache, modelo: r.modelo });
    return json(r, 200, cors);
  } catch (e) {
    if (e instanceof ErroFuncao) { registrar(HTTP_POR_CODIGO[e.codigo] || 500, { codigo: e.codigo, motivo: e.message }); return erro(e.codigo, e.message, cors); }
    registrar(500, { codigo: 'internal', motivo: (e && e.name) || 'erro' });
    return erro('internal', 'falha ao personalizar', cors);
  }
}

export default {
  fetch(request, env) { return atender(request, env); },
};
export { atender, CotaIA };
