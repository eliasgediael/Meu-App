// Chamada ao Gemini pela REST API (models.generateContent), sem SDK: só fetch, que é o que o Worker tem.
// A chave vai no cabeçalho x-goog-api-key (nunca na URL) e nunca aparece em log.
// Saída JSON forçada pelo esquema (functions/src/esquema-resposta.json), como responseSchema ou responseJsonSchema.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const NIVEIS_PENSAMENTO = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];

class ErroGemini extends Error {
  constructor(motivo, http) { super(motivo); this.motivo = motivo; this.http = http || 0; }
}

import esquemas from '../../functions/src/esquema-gemini.js';
const { paraEsquemaGemini, paraJsonSchemaGemini, semLimitesRecusados, esquemaParaGoogle, LIMITES_RECUSADOS } = esquemas;

// Tira de qualquer texto de erro algo que pareça chave ou token antes de ir para o log.
function limparTexto(texto, segredos) {
  let t = String(texto || '');
  for (const s of segredos || []) if (s && s.length >= 8) t = t.split(s).join('***');
  return t
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '***')
    .replace(/AQ\.[0-9A-Za-z._-]{20,}/g, '***')
    .replace(/eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}/g, '***')
    .slice(0, 300);
}

// Erros temporários do lado do Google: só estes ganham UMA nova tentativa. Nunca repete autenticação (401/403),
// pedido inválido (400), modelo inexistente (404), cota esgotada (429) nem tempo esgotado (o prazo já foi gasto).
const HTTP_TEMPORARIO = [500, 503, 504];
const PRAZO_MINIMO_RETENTATIVA_MS = 10000;   // só tenta de novo se ainda sobra tempo útil

// opcoes: { apiKey, fetch?, nivelPensamento?, formatoEsquema? ('openapi' | 'json'), timeoutMs? (prazo total, somando as tentativas), esperaRetentativaMs?,
//           log?(objeto), dormir?(ms) }
// Devolve a função chamarGemini({ modelo, instrucao, texto, esquema, maxOutputTokens, temperatura }) → texto JSON,
// no formato que functions/src/refinar.js espera.
function criarChamadaGemini(opcoes) {
  const apiKey = opcoes.apiKey;
  const fetchFn = opcoes.fetch || ((...a) => fetch(...a));
  // Vazio (ou fora da lista): o pedido vai SEM thinkingConfig e o modelo usa o padrão dele.
  const nivel = NIVEIS_PENSAMENTO.includes(String(opcoes.nivelPensamento || '').toUpperCase()) ? String(opcoes.nivelPensamento).toUpperCase() : null;
  const timeoutMs = opcoes.timeoutMs || 20000;
  // 'openapi' → responseSchema (aceito pelo gemini-3.8-flash na etapa B); 'json' → responseJsonSchema.
  const formatoEsquema = opcoes.formatoEsquema === 'json' ? 'json' : 'openapi';
  const espera = opcoes.esperaRetentativaMs == null ? 2500 : opcoes.esperaRetentativaMs;
  const novaTentativa = opcoes.novaTentativa !== false;   // false: no máximo UMA chamada ao Google por pedido
  const dormir = opcoes.dormir || ((ms) => new Promise(r => setTimeout(r, ms)));
  const log = opcoes.log || (() => {});

  // Uma tentativa. Lança ErroGemini com .temporario = true quando vale tentar de novo.
  async function tentar(url, corpoJson, prazoMs, tentativa) {
    const inicio = Date.now();
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), prazoMs);
    let r;
    try {
      r = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: corpoJson,
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(relogio);
      const esgotou = e && e.name === 'AbortError';
      const motivo = esgotou ? 'tempo esgotado' : 'falha de rede';
      log({ evento: 'gemini_erro', tentativa, motivo, ms: Date.now() - inicio });
      throw Object.assign(new ErroGemini(motivo), { temporario: !esgotou });
    }
    clearTimeout(relogio);
    if (!r.ok) {
      let status = '', mensagem = '';
      let detalhes = [];
      try {
        const j = await r.json();
        status = (j && j.error && j.error.status) || ''; mensagem = (j && j.error && j.error.message) || '';
        // Google manda o campo recusado em details[].fieldViolations (BadRequest) ou details[].reason (ErrorInfo)
        detalhes = ((j && j.error && j.error.details) || []).slice(0, 5).map(d => ({
          tipo: String(d['@type'] || '').split('.').pop(),
          ...(d.reason ? { reason: d.reason } : {}),
          ...(Array.isArray(d.fieldViolations) ? { campos: d.fieldViolations.slice(0, 5).map(v => ({ campo: v.field, descricao: limparTexto(v.description, [apiKey]) })) } : {}),
        }));
      } catch (e) { /* corpo não é JSON */ }
      log({ evento: 'gemini_erro', tentativa, http: r.status, status, mensagem: limparTexto(mensagem, [apiKey]), ...(detalhes.length ? { detalhes } : {}), ms: Date.now() - inicio });
      throw Object.assign(new ErroGemini(r.status === 429 ? 'cota do Gemini esgotada' : 'erro ' + r.status, r.status), { temporario: HTTP_TEMPORARIO.includes(r.status) });
    }
    let j;
    try { j = await r.json(); } catch (e) { log({ evento: 'gemini_erro', tentativa, motivo: 'resposta não é JSON' }); throw new ErroGemini('resposta não é JSON'); }
    const bloqueio = j && j.promptFeedback && j.promptFeedback.blockReason;
    if (bloqueio) { log({ evento: 'gemini_erro', tentativa, motivo: 'bloqueado', bloqueio }); throw new ErroGemini('bloqueado: ' + bloqueio); }
    const cand = j && Array.isArray(j.candidates) ? j.candidates[0] : null;
    const fim = cand && cand.finishReason;
    if (!cand || fim !== 'STOP') { log({ evento: 'gemini_erro', tentativa, motivo: 'fim inesperado', finishReason: fim || 'sem candidato' }); throw new ErroGemini('fim inesperado: ' + (fim || 'sem candidato')); }
    const partes = (cand.content && Array.isArray(cand.content.parts)) ? cand.content.parts : [];
    const saida = partes.filter(p => p && !p.thought && typeof p.text === 'string').map(p => p.text).join('');
    const u = j.usageMetadata || {};
    log({ evento: 'gemini_ok', tentativa, modelo: modeloDe(url), ms: Date.now() - inicio, tokens: { entrada: u.promptTokenCount || 0, pensamento: u.thoughtsTokenCount || 0, saida: u.candidatesTokenCount || 0 } });
    return saida;
  }
  const modeloDe = (url) => url.slice(BASE.length).split(':')[0];

  return async function chamarGemini({ modelo, instrucao, texto, esquema, maxOutputTokens, temperatura }) {
    if (!apiKey) throw new ErroGemini('chave ausente');
    if (!/^[a-z0-9][a-z0-9.-]{2,60}$/.test(modelo || '')) throw new ErroGemini('modelo inválido');
    const corpoJson = JSON.stringify({
      systemInstruction: { parts: [{ text: instrucao }] },
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(formatoEsquema === 'json' ? { responseJsonSchema: esquemaParaGoogle(esquema, 'json') } : { responseSchema: esquemaParaGoogle(esquema, 'openapi') }),
        maxOutputTokens,
        temperature: temperatura,
        ...(nivel ? { thinkingConfig: { thinkingLevel: nivel } } : {}),
      },
    });
    const url = BASE + modelo + ':generateContent';
    const limite = Date.now() + timeoutMs;
    try {
      return await tentar(url, corpoJson, timeoutMs, 1);
    } catch (e) {
      const sobra = limite - Date.now() - espera;
      if (!novaTentativa || !e || !e.temporario || sobra < PRAZO_MINIMO_RETENTATIVA_MS) throw e;
      await dormir(espera);
      return tentar(url, corpoJson, sobra, 2);
    }
  };
}

export { criarChamadaGemini, paraEsquemaGemini, paraJsonSchemaGemini, semLimitesRecusados, esquemaParaGoogle, LIMITES_RECUSADOS, limparTexto, ErroGemini };
