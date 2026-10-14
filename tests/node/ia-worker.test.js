// IA (Gemini) — Cloudflare Worker (worker/) com dublês: sem rede, sem Cloudflare, sem Gemini real, sem chave real.
// Login (token do Firebase assinado por uma chave RSA de teste), consentimento, proteção da chave, cotas (inclusive
// chamadas simultâneas), cache, CORS, erros, compatibilidade com F0–F9 e volta ao plano do Motor V2.
// Perfis fictícios do harness. Rodar: node tests/node/ia-worker.test.js
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url'), { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const WORKER = path.join(RAIZ, 'worker');
const importar = (p) => import(pathToFileURL(p).href);
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

// Globais reais do Node: o harness do app troca URL, fetch e Blob por dublês de navegador.
const NATIVOS = { URL: globalThis.URL, fetch: globalThis.fetch, Blob: globalThis.Blob };
async function comNativos(fn) {
  const antes = { URL: globalThis.URL, fetch: globalThis.fetch, Blob: globalThis.Blob };
  Object.assign(globalThis, NATIVOS);
  try { return await fn(); } finally { Object.assign(globalThis, antes); }
}

// Tudo que o Worker escreve no console fica guardado para conferir que nenhum segredo vaza.
const LOGS = [];
const logOriginal = console.log;
function capturarLogs(on) { console.log = on ? (...a) => { LOGS.push(a.join(' ')); } : logOriginal; }

const PROJETO = 'treino-app-5a07f';
const CHAVE_FALSA = 'AQ.chave-ficticia-de-teste-0123456789abcdefghijklmnopqrstuvwxyz';
const ORIGEM_APP = 'capacitor://localhost';

// ---------- dublês da Cloudflare ----------
function kvFalso() {
  const m = new Map(); const ttl = new Map(); let escritas = 0;
  return {
    m, ttl, escritas: () => escritas,
    async get(k, o) { const v = m.get(k); if (v == null) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
    async put(k, v, o) { escritas++; m.set(k, v); ttl.set(k, o && o.expirationTtl); },
  };
}
function storageFalso() {
  const m = new Map(); let alarme = null;
  return {
    m,
    async get(ks) { await null; return new Map(ks.filter(k => m.has(k)).map(k => [k, m.get(k)])); },
    async put(o) { await null; Object.entries(o).forEach(([k, v]) => m.set(k, v)); },
    async list({ prefix }) { return new Map([...m].filter(([k]) => k.startsWith(prefix)).sort()); },
    async delete(ks) { ks.forEach(k => m.delete(k)); return ks.length; },
    async getAlarm() { return alarme; }, async setAlarm(t) { alarme = t; },
  };
}
function namespaceDO(CotaIA) {
  const inst = new CotaIA({ storage: storageFalso() }, {});
  return { inst, idFromName: (n) => n, get: () => ({ fetch: (u, init) => inst.fetch(new Request(u, init)) }) };
}

// ---------- Gemini falso (formato REST do generateContent) ----------
function geminiFalso(gerar) {
  const g = { chamadas: 0, ultimo: null };
  g.fetch = async (url, init) => {
    g.chamadas++; g.ultimo = { url: String(url), headers: init.headers, corpo: JSON.parse(init.body) };
    const r = await gerar(g.ultimo, g.chamadas);
    if (r instanceof Response) return r;
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'pensando...', thought: true }, { text: JSON.stringify(r) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 100, thoughtsTokenCount: 50, candidatesTokenCount: 80, totalTokenCount: 230 },
    });
  };
  return g;
}
const identidade = (ultimo) => { const p = JSON.parse(ultimo.corpo.contents[0].parts[0].text); return { versao: '1', dias: p.planoMotor, motivos: ['manter_plano'] }; };

const pedidoBase = (n = 0) => ({
  versaoContrato: '1', tipo: 'inicial', semana: { numero: 1 + n, fase: 'Base' },
  perfil: { faixaEtaria: '30-39', nivel: 'intermediario', objetivo: 'massa', padroesDominados: [] },
  dias: [{ dia: 'Seg', tipoMotor: 'upper' }], regras: { totalSeriesSemanaMax: 20, diasFixos: ['Seg'] },
  planoMotor: [{ dia: 'Seg', exercicios: [{ id: '0025', papel: 'base', series: 4, reps: 8, rpe: 8, descansoSeg: 75 }] }],
  exerciciosAutorizados: [{ id: '0025', nome: 'Supino reto com barra', grupo: 'Peito' }, { id: '0314', nome: 'Supino inclinado com halteres', grupo: 'Peito' }],
  historico: { tendencia: 'estavel' },
});

(async () => {
  const jose = await importar(require.resolve('jose', { paths: [WORKER] }));
  const W = await importar(path.join(WORKER, 'src', 'index.js'));
  const A = await importar(path.join(WORKER, 'src', 'auth-firebase.js'));
  const G = await importar(path.join(WORKER, 'src', 'gemini.js'));
  const C = await importar(path.join(WORKER, 'src', 'cota-do.js'));

  // Chaves RSA de teste: a "do Google" (aceita) e uma intrusa.
  const kid = 'kid-teste-1';
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', { extractable: true });
  const intrusa = await jose.generateKeyPair('RS256');
  const jwkPub = { ...(await jose.exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const chaves = jose.createLocalJWKSet({ keys: [jwkPub] });
  const agoraSeg = () => Math.floor(Date.now() / 1000);
  async function token(o = {}) {
    const c = { firebase: { sign_in_provider: o.provedor || 'password' }, auth_time: o.auth_time ?? agoraSeg() - 60, ...(o.extra || {}) };
    let j = new jose.SignJWT(c).setProtectedHeader({ alg: 'RS256', kid: o.kid || kid })
      .setIssuer(o.iss || `https://securetoken.google.com/${PROJETO}`).setAudience(o.aud || PROJETO)
      .setSubject(o.sub ?? 'usuario-ficticio-1').setIssuedAt(o.iat ?? agoraSeg() - 60).setExpirationTime(o.exp ?? agoraSeg() + 3000);
    return j.sign(o.chave || privateKey);
  }
  const verificarToken = A.criarVerificadorFirebase({ projectId: PROJETO, chaves });

  function ambiente(extra = {}) {
    const kv = kvFalso(), ns = namespaceDO(W.CotaIA);
    const env = {
      IA_ATIVA: 'true', GEMINI_API_KEY: CHAVE_FALSA, GEMINI_MODELO: 'gemini-3.8-flash', GEMINI_NIVEL_PENSAMENTO: 'LOW',
      FIREBASE_PROJECT_ID: PROJETO, ORIGENS_PERMITIDAS: 'capacitor://localhost,ionic://localhost,http://localhost',
      IA_LIMITE_DIA_USUARIO: '3', IA_LIMITE_DIA_GLOBAL: '15', IA_LIMITE_MINUTO_GLOBAL: '4', IA_LIMITE_MES_GLOBAL: '450',
      GEMINI_ESPERA_RETENTATIVA_MS: '0', GEMINI_FORMATO_ESQUEMA: 'json', IA_CACHE: kv, COTAS: ns, ...extra,
    };
    return { env, kv, ns };
  }
  async function chamar(amb, { tk, corpo, origem = ORIGEM_APP, metodo = 'POST', rota = '/refinar', gemini, headers = {} } = {}) {
    const h = { 'Content-Type': 'application/json', ...headers };
    if (tk !== null) h.Authorization = 'Bearer ' + (tk || await token());
    if (origem) h.Origin = origem;
    const req = new Request('https://forza-ia.teste' + rota, { method: metodo, headers: h, body: metodo === 'POST' ? (typeof corpo === 'string' ? corpo : JSON.stringify(corpo || { consentimento: true, pedido: pedidoBase() })) : undefined });
    const r = await W.atender(req, amb.env, { verificarToken, fetchGemini: gemini ? gemini.fetch : undefined });
    const texto = await r.text();
    let j = null; try { j = JSON.parse(texto); } catch (e) { /* vazio */ }
    return { status: r.status, j, texto, h: r.headers };
  }

  capturarLogs(true);
  const R = [];  // resultados guardados para conferir depois com os logs liberados
  const t = (cond, msg) => R.push([!!cond, msg]);

  // ================= 1. Autenticação =================
  {
    const amb = ambiente(); const g = geminiFalso(identidade);
    const r = await chamar(amb, { gemini: g });
    t(r.status === 200 && r.j.resposta && r.j.modelo === 'gemini-3.8-flash' && r.j.cache === false, `auth: token válido aceito (${r.status})`);
    const casos = [
      ['sem cabeçalho Authorization', { tk: null }],
      ['token lixo', { tk: 'abc.def.ghi' }],
      ['token vencido', { tk: await token({ exp: agoraSeg() - 3600, iat: agoraSeg() - 7200, auth_time: agoraSeg() - 7200 }) }],
      ['outro projeto (aud)', { tk: await token({ aud: 'outro-projeto' }) }],
      ['emissor errado (iss)', { tk: await token({ iss: 'https://securetoken.google.com/outro-projeto' }) }],
      ['assinado por chave intrusa', { tk: await token({ chave: intrusa.privateKey }) }],
      ['kid desconhecido', { tk: await token({ kid: 'kid-falso' }) }],
      ['login anônimo', { tk: await token({ provedor: 'anonymous' }) }],
      ['iat no futuro', { tk: await token({ iat: agoraSeg() + 3600 }) }],
      ['auth_time no futuro', { tk: await token({ auth_time: agoraSeg() + 3600 }) }],
      ['sub vazio', { tk: await token({ sub: '' }) }],
    ];
    const semAssinatura = (await token()).split('.'); semAssinatura[0] = Buffer.from(JSON.stringify({ alg: 'none', kid })).toString('base64url');
    casos.push(['alg none (sem assinatura)', { tk: semAssinatura[0] + '.' + semAssinatura[1] + '.' }]);
    const hs = await new jose.SignJWT({ firebase: { sign_in_provider: 'password' }, auth_time: agoraSeg() }).setProtectedHeader({ alg: 'HS256', kid })
      .setIssuer(`https://securetoken.google.com/${PROJETO}`).setAudience(PROJETO).setSubject('x').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('segredo-qualquer-32-bytes-0123456789'));
    casos.push(['alg HS256 (troca de algoritmo)', { tk: hs }]);
    for (const [nome, o] of casos) {
      const g2 = geminiFalso(identidade);
      const x = await chamar(amb, { ...o, gemini: g2 });
      t(x.status === 401 && x.j.erro.codigo === 'unauthenticated' && g2.chamadas === 0, `auth: ${nome} → 401, Gemini não chamado`);
    }
    t(A.JWKS_FIREBASE === 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', 'auth: chaves públicas oficiais do Firebase (securetoken)');
    let erroProjeto = false; try { A.criarVerificadorFirebase({ projectId: '' }); } catch (e) { erroProjeto = true; }
    t(erroProjeto, 'auth: sem FIREBASE_PROJECT_ID o verificador não é criado');
  }

  // ================= 2. Consentimento e pedido =================
  {
    const amb = ambiente(); const g = geminiFalso(identidade);
    let r = await chamar(amb, { corpo: { consentimento: false, pedido: pedidoBase() }, gemini: g });
    t(r.status === 412 && r.j.erro.codigo === 'failed-precondition', `consentimento: false → 412 (${r.status})`);
    r = await chamar(amb, { corpo: { pedido: pedidoBase() }, gemini: g });
    t(r.status === 412, 'consentimento: ausente → 412');
    r = await chamar(amb, { corpo: { consentimento: 'true', pedido: pedidoBase() }, gemini: g });
    t(r.status === 412, 'consentimento: só true booleano vale ("true" texto → 412)');
    r = await chamar(amb, { corpo: { consentimento: true, pedido: { ...pedidoBase(), perfil: { ...pedidoBase().perfil, nome: 'Fulana' } } }, gemini: g });
    t(r.status === 400 && r.j.erro.codigo === 'invalid-argument', 'pedido: nome no perfil → 400');
    r = await chamar(amb, { corpo: { consentimento: true, pedido: { ...pedidoBase(), email: 'a@b.c' } }, gemini: g });
    t(r.status === 400, 'pedido: campo fora do contrato → 400');
    r = await chamar(amb, { corpo: { consentimento: true, pedido: pedidoBase(), uid: 'x' }, gemini: g });
    t(r.status === 400, 'corpo: campo extra além de consentimento e pedido → 400');
    t(g.chamadas === 0, 'consentimento/pedido inválidos: Gemini nunca chamado');
  }

  // ================= 3. Proteção da chave =================
  {
    const amb = ambiente(); const g = geminiFalso(identidade);
    const r = await chamar(amb, { gemini: g });
    t(r.status === 200, 'chave: chamada normal');
    t(g.ultimo.headers['x-goog-api-key'] === CHAVE_FALSA && !g.ultimo.url.includes(CHAVE_FALSA) && !g.ultimo.url.includes('key='), 'chave: vai só no cabeçalho x-goog-api-key, nunca na URL');
    t(g.ultimo.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', 'chave: endpoint oficial generateContent');
    t(!r.texto.includes(CHAVE_FALSA), 'chave: nunca volta na resposta ao app');
    const vazamento = geminiFalso(() => Response.json({ error: { code: 400, status: 'INVALID_ARGUMENT', message: `API key ${CHAVE_FALSA} not valid. Please pass a valid API key.` } }, { status: 400 }));
    const r2 = await chamar(ambiente(), { gemini: vazamento });
    t(r2.status === 503 && !r2.texto.includes(CHAVE_FALSA), 'chave: erro do Gemini com a chave no texto não chega ao app');
    t(G.limparTexto('x AIzaSyA1234567890abcdefghijklmnop y', []) === 'x *** y' && G.limparTexto('t eyJhbGciOiJSUzI1.eyJzdWIiOiIxMjM0NTY3.c2lnbmF0dXJlMTIzNA z', []) === 't *** z', 'chave: limpeza de log troca chaves e tokens por ***');
    const semChave = await chamar(ambiente({ GEMINI_API_KEY: undefined }), { gemini: g });
    t(semChave.status === 503 && semChave.j.erro.codigo === 'unavailable', 'chave: segredo ausente → 503, sem chamar o Gemini');
    // Arquivos: nenhuma chave real em código versionável; arquivos de segredo ignorados pelo git.
    const arquivos = ['worker/wrangler.toml', 'worker/src/index.js', 'worker/src/gemini.js', 'worker/src/auth-firebase.js', 'worker/src/armazem-kv.js', 'worker/src/cota-do.js',
      'worker/.dev.vars.exemplo', 'src/ia/config.js', 'src/ia/servidor.js', 'src/ia/aplicar.js', 'treino-app.html', 'functions/index.js'];
    // A apiKey da configuração web do Firebase (firebaseConfig) é pública por desenho e fica de fora.
    const padraoChave = /AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z._-]{30,}/;
    const semConfigFirebase = (txt) => txt.replace(/apiKey:\s*["']AIza[0-9A-Za-z_-]{30,}["']/g, '');
    const comChave = arquivos.filter(f => padraoChave.test(semConfigFirebase(fs.readFileSync(path.join(RAIZ, f), 'utf8'))));
    t(comChave.length === 0, 'chave: nenhum arquivo do app/worker contém chave (fora a apiKey pública do Firebase)' + (comChave.length ? ' — ' + comChave.join(', ') : ''));
    // Se existir uma chave real local (functions/.secret.local ou worker/.dev.vars), ela não pode estar em nenhum arquivo versionável.
    const reais = ['functions/.secret.local', 'worker/.dev.vars'].map(f => path.join(RAIZ, f)).filter(f => fs.existsSync(f))
      .map(f => ((/^GEMINI_API_KEY=(.+)$/m.exec(fs.readFileSync(f, 'utf8')) || [])[1] || '').trim()).filter(v => v && v !== 'COLE_SUA_CHAVE_AQUI');
    const versionaveis = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter(f => f && /\.(js|json|html|toml|md|txt|yml|yaml|env|exemplo)$/.test(f) && !f.includes('node_modules/'));
    const vazados = reais.length ? versionaveis.filter(f => { try { const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8'); return reais.some(k => txt.includes(k)); } catch (e) { return false; } }) : [];
    t(vazados.length === 0, `chave: a chave real local (${reais.length ? 'presente, conferida' : 'ausente'}) não está em nenhum dos ${versionaveis.length} arquivos versionáveis` + (vazados.length ? ' — ' + vazados.length + ' arquivo(s)' : ''));
    const html = fs.readFileSync(path.join(RAIZ, 'treino-app.html'), 'utf8');
    t(!/GEMINI_API_KEY|generativelanguage\.googleapis/.test(html), 'chave: o app não referencia a chave nem chama o Gemini direto');
    const ignorados = ['worker/.dev.vars', 'worker/.dev.vars.local', 'functions/.secret.local', 'functions/.env.local', 'worker/.wrangler/x', 'worker/node_modules/x'].map(f => {
      try { execFileSync('git', ['check-ignore', '-q', f], { cwd: RAIZ }); return true; } catch (e) { return false; }
    });
    t(ignorados.every(Boolean), 'chave: .dev.vars, .secret.local, .env.local, .wrangler e node_modules ignorados pelo git');
    let exemploVersionavel = false; try { execFileSync('git', ['check-ignore', '-q', 'worker/.dev.vars.exemplo'], { cwd: RAIZ }); } catch (e) { exemploVersionavel = true; }
    t(exemploVersionavel, 'chave: só o arquivo de exemplo (sem chave) pode ir para o git');
    const toml = fs.readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8');
    t(!/GEMINI_API_KEY\s*=/.test(toml), 'chave: wrangler.toml não tem GEMINI_API_KEY (vai como segredo)');
  }

  // ================= 4. Cotas =================
  {
    const amb = ambiente(); const g = geminiFalso(identidade);
    const st = [];
    for (let i = 0; i < 4; i++) st.push((await chamar(amb, { corpo: { consentimento: true, pedido: pedidoBase(i) }, gemini: g })).status);
    t(st.join(',') === '200,200,200,429', `cota: 3 por usuário por dia, a 4ª → 429 (${st.join(',')})`);
    t(g.chamadas === 3, 'cota: a chamada barrada não chega ao Gemini');
    const outro = await chamar(amb, { tk: await token({ sub: 'usuario-ficticio-2' }), corpo: { consentimento: true, pedido: pedidoBase(10) }, gemini: g });
    t(outro.status === 200, 'cota: outro usuário continua podendo');

    // Simultâneas: 25 usuários ao mesmo tempo, limite global por minuto 4 → exatamente 4 passam.
    const amb2 = ambiente({ IA_LIMITE_MINUTO_GLOBAL: '4', IA_LIMITE_DIA_GLOBAL: '100' });
    const g2 = geminiFalso(async (u) => { await new Promise(r => setTimeout(r, 5)); return identidade(u); });
    const tks = await Promise.all(Array.from({ length: 25 }, (_, i) => token({ sub: 'simultaneo-' + i })));
    const res = await Promise.all(tks.map((tk, i) => chamar(amb2, { tk, corpo: { consentimento: true, pedido: pedidoBase(100 + i) }, gemini: g2 })));
    const n200 = res.filter(r => r.status === 200).length, n429 = res.filter(r => r.status === 429).length;
    t(n200 === 4 && n429 === 21 && g2.chamadas === 4, `cota: 25 chamadas simultâneas, limite por minuto 4 → ${n200} passaram, ${n429} barradas, Gemini chamado ${g2.chamadas}x`);
    const amb3 = ambiente({ IA_LIMITE_MINUTO_GLOBAL: '100', IA_LIMITE_DIA_GLOBAL: '7' });
    const g3 = geminiFalso(identidade);
    const tks3 = await Promise.all(Array.from({ length: 20 }, (_, i) => token({ sub: 'dia-' + i })));
    const res3 = await Promise.all(tks3.map((tk, i) => chamar(amb3, { tk, corpo: { consentimento: true, pedido: pedidoBase(200 + i) }, gemini: g3 })));
    t(res3.filter(r => r.status === 200).length === 7 && g3.chamadas === 7, 'cota: 20 simultâneas, limite diário global 7 → exatamente 7');
    const amb4 = ambiente({ IA_LIMITE_MES_GLOBAL: '2', IA_LIMITE_DIA_USUARIO: '50' });
    const st4 = [];
    for (let i = 0; i < 3; i++) st4.push((await chamar(amb4, { corpo: { consentimento: true, pedido: pedidoBase(300 + i) }, gemini: geminiFalso(identidade) })).status);
    t(st4.join(',') === '200,200,429', 'cota: limite mensal global respeitado');
    // Limpeza dos contadores antigos
    const s = storageFalso();
    await s.put({ 'u|a|2026-01-01': 1, 'gd|2026-01-01': 3, 'mi|2026-01-01T10:00': 1, 'gm|2026-01': 9, ['u|b|' + new Date().toISOString().slice(0, 10)]: 1 });
    const apagados = await C.limparAntigos(s, Date.now());
    t(apagados === 3 && s.m.has('gm|2026-01') && s.m.size === 2, 'cota: contadores diários antigos apagados, mensal e de hoje mantidos');
    t(C.diaPacifico(Date.UTC(2026, 9, 15, 6, 30)) === '2026-10-14', 'cota: dia global no fuso do Pacífico (o Google zera a cota à meia-noite de lá)');
  }

  // ================= 5. Cache =================
  {
    const amb = ambiente(); const g = geminiFalso(identidade);
    const a = await chamar(amb, { gemini: g });
    const b = await chamar(amb, { gemini: g });
    t(a.j.cache === false && b.j.cache === true && g.chamadas === 1, 'cache: pedido igual servido do KV, Gemini chamado 1x');
    t(JSON.stringify(a.j.resposta) === JSON.stringify(b.j.resposta), 'cache: mesma resposta');
    const chave = [...amb.kv.m.keys()][0];
    t(/^cache:[0-9a-f]{64}$/.test(chave) && amb.kv.ttl.get(chave) >= 86000 && amb.kv.ttl.get(chave) <= 86400, 'cache: chave = hash do pedido, expira em 24 h');
    t(!/usuario-ficticio|Bearer/.test(amb.kv.m.get(chave)), 'cache: nada do usuário guardado');
    const usos = [...amb.ns.inst.ctx.storage.m.keys()].filter(k => k.startsWith('u|'));
    t(usos.length === 1 && amb.ns.inst.ctx.storage.m.get(usos[0]) === 1, 'cache: resposta do cache não consome cota');
    const outroModelo = ambiente({ GEMINI_MODELO: 'gemini-3.5-flash-lite' });
    outroModelo.env.IA_CACHE = amb.kv;
    const c = await chamar(outroModelo, { gemini: g });
    t(c.j.cache === false && g.chamadas === 2, 'cache: trocar o modelo não reaproveita resposta de outro modelo');
    const falha = geminiFalso(() => Response.json({ error: { code: 500, status: 'INTERNAL', message: 'x' } }, { status: 500 }));
    const amb2 = ambiente();
    await chamar(amb2, { gemini: falha });
    t(amb2.kv.escritas() === 0, 'cache: erro do Gemini não é guardado');
  }

  // ================= 6. CORS =================
  {
    const amb = ambiente();
    const pre = await W.atender(new Request('https://forza-ia.teste/refinar', { method: 'OPTIONS', headers: { Origin: ORIGEM_APP, 'Access-Control-Request-Method': 'POST' } }), amb.env, {});
    t(pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === ORIGEM_APP && /Authorization/.test(pre.headers.get('Access-Control-Allow-Headers')), 'CORS: preflight do app no iPhone (capacitor://localhost) liberado');
    const r = await chamar(amb, { gemini: geminiFalso(identidade) });
    t(r.h.get('Access-Control-Allow-Origin') === ORIGEM_APP && r.h.get('Vary') === 'Origin' && r.h.get('Cache-Control') === 'no-store', 'CORS: resposta com a origem do app, Vary e no-store');
    const g = geminiFalso(identidade);
    const mal = await chamar(amb, { origem: 'https://site-malicioso.example', gemini: g });
    t(mal.status === 403 && !mal.h.get('Access-Control-Allow-Origin') && g.chamadas === 0, 'CORS: site de outra origem → 403, sem chamar o Gemini');
    const preMal = await W.atender(new Request('https://forza-ia.teste/refinar', { method: 'OPTIONS', headers: { Origin: 'https://site-malicioso.example' } }), amb.env, {});
    t(preMal.status === 403, 'CORS: preflight de outra origem → 403');
    const semOrigem = await chamar(amb, { origem: null, corpo: { consentimento: true, pedido: pedidoBase(1) }, gemini: geminiFalso(identidade) });
    t(semOrigem.status === 200 && !semOrigem.h.get('Access-Control-Allow-Origin'), 'CORS: sem Origin (ferramenta) segue exigindo token, sem cabeçalho CORS');
  }

  // ================= 7. Erros =================
  {
    const g = geminiFalso(identidade);
    let r = await chamar(ambiente({ IA_ATIVA: 'false' }), { gemini: g });
    t(r.status === 503 && g.chamadas === 0, 'erro: IA_ATIVA=false → 503 sem chamar nada');
    const amb = ambiente();
    r = await chamar(amb, { corpo: '{isto não é json', gemini: g });
    t(r.status === 400, 'erro: corpo inválido → 400');
    r = await chamar(amb, { corpo: { consentimento: true, pedido: { ...pedidoBase(), historico: { x: 'a'.repeat(120000) } } }, gemini: g });
    t(r.status === 413, 'erro: corpo grande demais → 413');
    r = await chamar(amb, { rota: '/outra', gemini: g });
    t(r.status === 404, 'erro: rota inexistente → 404');
    r = await chamar(amb, { metodo: 'GET', gemini: g });
    t(r.status === 405, 'erro: GET /refinar → 405');
    r = await chamar(amb, { metodo: 'GET', rota: '/saude' });
    t(r.status === 200 && r.j.ok === true && !r.texto.includes(CHAVE_FALSA), 'erro: /saude responde sem segredos');
    const cenarios = [
      ['Gemini 500', () => Response.json({ error: { code: 500, status: 'INTERNAL', message: 'falha' } }, { status: 500 }), 503],
      ['Gemini 429 (cota do Google)', () => Response.json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, { status: 429 }), 503],
      ['Gemini 404 (modelo indisponível)', () => Response.json({ error: { code: 404, status: 'NOT_FOUND', message: 'model not found' } }, { status: 404 }), 503],
      ['finishReason MAX_TOKENS', () => Response.json({ candidates: [{ content: { parts: [{ text: '{"versao":"1","di' }] }, finishReason: 'MAX_TOKENS' }] }), 503],
      ['bloqueio de segurança', () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 503],
      ['sem candidatos', () => Response.json({ candidates: [] }), 503],
      ['texto que não é JSON', () => Response.json({ candidates: [{ content: { parts: [{ text: 'olá' }] }, finishReason: 'STOP' }] }), 502],
      ['exercício fora da lista', (u) => { const x = identidade(u); x.dias[0].exercicios[0].id = '9999'; return x; }, 502],
      ['falha de rede', () => { throw new TypeError('fetch failed'); }, 503],
    ];
    for (const [nome, gerar, esperado] of cenarios) {
      const x = await chamar(ambiente(), { gemini: geminiFalso(gerar) });
      t(x.status === esperado && x.j && x.j.erro && !x.texto.includes(CHAVE_FALSA), `erro: ${nome} → ${esperado} (${x.status} ${x.j && x.j.erro && x.j.erro.codigo})`);
    }
    // Uma única nova tentativa, só para erro temporário do Google (500/503/504 ou rede)
    const seq = (lista) => geminiFalso((u, n) => { const x = lista[Math.min(n, lista.length) - 1]; return typeof x === 'function' ? x(u) : Response.json({ error: { code: x, status: 'X', message: 'x' } }, { status: x }); });
    const casosRetentativa = [
      ['503 e depois sucesso', [503, identidade], 200, 2],
      ['503 duas vezes', [503, 503, identidade], 503, 2],
      ['500 e depois sucesso', [500, identidade], 200, 2],
      ['504 e depois sucesso', [504, identidade], 200, 2],
      ['429 cota esgotada (não repete)', [429, identidade], 503, 1],
      ['400 pedido inválido (não repete)', [400, identidade], 503, 1],
      ['401 chave inválida (não repete)', [401, identidade], 503, 1],
      ['403 sem permissão (não repete)', [403, identidade], 503, 1],
      ['404 modelo inexistente (não repete)', [404, identidade], 503, 1],
    ];
    for (const [nome, lista, esperado, chamadas] of casosRetentativa) {
      const gm = seq(lista);
      const x = await chamar(ambiente(), { gemini: gm });
      t(x.status === esperado && gm.chamadas === chamadas, `nova tentativa: ${nome} → ${x.status}, ${gm.chamadas} chamada(s) ao Gemini`);
    }
    const rede = geminiFalso((u, n) => { if (n === 1) throw new TypeError('fetch failed'); return identidade(u); });
    const xr = await chamar(ambiente(), { gemini: rede });
    t(xr.status === 200 && rede.chamadas === 2, 'nova tentativa: falha de rede e depois sucesso → 200, 2 chamadas');
    const ambCota = ambiente(); const gC = seq([503, 503]);
    await chamar(ambCota, { gemini: gC });
    const usosC = [...ambCota.ns.inst.ctx.storage.m.entries()].filter(([k]) => k.startsWith('u|'));
    t(usosC.length === 1 && usosC[0][1] === 1, 'nova tentativa: conta 1 uso na cota do app (o Google pode contar 2 no limite por minuto)');
    let esperou = null, inicioR = 0;
    const comEspera = G.criarChamadaGemini({ apiKey: CHAVE_FALSA, timeoutMs: 44000, esperaRetentativaMs: 2500, dormir: async (ms) => { esperou = ms; },
      fetch: async () => { inicioR++; return inicioR === 1 ? Response.json({ error: { code: 503 } }, { status: 503 }) : Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }] }); } });
    await comEspera({ modelo: 'gemini-3.5-flash-lite', instrucao: 'x', texto: '{}', esquema: {}, maxOutputTokens: 10, temperatura: 0 });
    t(esperou === 2500 && inicioR === 2, 'nova tentativa: pausa de 2,5 s antes de repetir');
    let semTempo = 0;
    const apertado = G.criarChamadaGemini({ apiKey: CHAVE_FALSA, timeoutMs: 8000, esperaRetentativaMs: 0, fetch: async () => { semTempo++; return Response.json({ error: { code: 503 } }, { status: 503 }); } });
    try { await apertado({ modelo: 'gemini-3.5-flash-lite', instrucao: 'x', texto: '{}', esquema: {}, maxOutputTokens: 10, temperatura: 0 }); } catch (e) { /* esperado */ }
    t(semTempo === 1, 'nova tentativa: sem tempo útil sobrando (prazo < 10 s), não repete');
    const ambPrazo = ambiente();
    const req = new Request('https://forza-ia.teste/refinar', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), Origin: ORIGEM_APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ consentimento: true, pedido: pedidoBase(7) }) });
    let prazoVisto = 0;
    await W.atender(req, { ...ambPrazo.env, IA_TIMEOUT_MS: undefined }, { verificarToken, fetchGemini: async (u, init) => { prazoVisto = 1; return geminiFalso(identidade).fetch(u, init); } });
    t(prazoVisto === 1, 'prazo padrão do Worker: 45 s (IA_TIMEOUT_MS no wrangler.toml)');
    t(/IA_TIMEOUT_MS = "45000"/.test(fs.readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8')) && /GEMINI_MODELO = "gemini-3\.5-flash-lite"/.test(fs.readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8')), 'wrangler.toml: modelo gemini-3.5-flash-lite e prazo de 45 s');
    // Tempo-limite do Gemini (direto no módulo, com prazo curto)
    const lento = G.criarChamadaGemini({ apiKey: CHAVE_FALSA, timeoutMs: 50, fetch: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' })))) });
    let motivo = ''; try { await lento({ modelo: 'gemini-3.8-flash', instrucao: 'x', texto: '{}', esquema: {}, maxOutputTokens: 10, temperatura: 0 }); } catch (e) { motivo = e.motivo; }
    t(motivo === 'tempo esgotado', 'erro: Gemini lento → tempo esgotado (requisição abortada)');
    const esq = G.paraEsquemaGemini(require(path.join(RAIZ, 'functions', 'src', 'esquema-resposta.json')));
    t(esq.type === 'OBJECT' && esq.properties.dias.type === 'ARRAY' && esq.properties.dias.items.properties.exercicios.items.properties.series.type === 'INTEGER' && esq.properties.dias.items.properties.exercicios.items.properties.series.maximum === 10, 'erro: esquema convertido para o formato do Gemini (tipos OBJECT/ARRAY/INTEGER, limites mantidos)');
    const amb2 = ambiente(); const g2 = geminiFalso(identidade);
    await chamar(amb2, { gemini: g2 });
    const gc = g2.ultimo.corpo.generationConfig;
    const js = gc.responseJsonSchema;
    t(!('responseSchema' in gc) && js && js.type === 'object' && js.additionalProperties === false && js.properties.dias.items.properties.exercicios.items.properties.series.type === 'integer' && js.properties.dias.items.properties.exercicios.items.additionalProperties === false, 'esquema enviado como responseJsonSchema (tipos JSON Schema, sem campos extras)');
    const ambSem = ambiente({ GEMINI_NIVEL_PENSAMENTO: '' }); const gSem = geminiFalso(identidade);
    await chamar(ambSem, { gemini: gSem });
    t(!('thinkingConfig' in gSem.ultimo.corpo.generationConfig), 'GEMINI_NIVEL_PENSAMENTO vazio: pedido vai sem thinkingConfig');
    const toml = fs.readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8');
    t(/GEMINI_NIVEL_PENSAMENTO = ""/.test(toml) && /GEMINI_FORMATO_ESQUEMA = "openapi"/.test(toml) && /GEMINI_NOVA_TENTATIVA = "true"/.test(toml), 'wrangler.toml: sem thinkingConfig, esquema responseSchema, nova tentativa ligada');
    const ambOa = ambiente({ GEMINI_FORMATO_ESQUEMA: 'openapi' }); const gOa = geminiFalso(identidade);
    await chamar(ambOa, { gemini: gOa });
    const gcOa = gOa.ultimo.corpo.generationConfig;
    t(gcOa.responseSchema && gcOa.responseSchema.type === 'OBJECT' && !('responseJsonSchema' in gcOa) && !/"(minimum|maximum|minItems|maxItems|maxLength)"/.test(JSON.stringify(gcOa.responseSchema)), 'formato openapi: responseSchema com tipos OBJECT/ARRAY e SEM os limites que o Google recusa');
    // Esquema para o Google x esquema local
    const ESQ_LOCAL = require(path.join(RAIZ, 'functions', 'src', 'esquema-resposta.json'));
    const enviado = gcOa.responseSchema, ex = enviado.properties.dias.items.properties.exercicios.items;
    t(JSON.stringify(enviado.required) === '["versao","dias","motivos"]' && JSON.stringify(ex.required) === '["id","papel","series","reps","rpe","descansoSeg"]' && JSON.stringify(ex.propertyOrdering) === '["id","papel","series","reps","rpe","descansoSeg"]'
      && JSON.stringify(ex.properties.papel.enum) === '["base","auxiliar","isolado"]' && enviado.properties.dias.items.properties.dia.enum.length === 7 && enviado.properties.motivos.items.enum.length === 10 && JSON.stringify(enviado.properties.versao.enum) === '["1"]',
      'esquema para o Google: tipos, obrigatórios, ordem e todas as opções fixas mantidos (igual ao Teste 4)');
    const exL = ESQ_LOCAL.properties.dias.items.properties.exercicios.items.properties;
    t(exL.series.minimum === 1 && exL.series.maximum === 10 && exL.reps.maximum === 30 && exL.rpe.maximum === 10 && exL.descansoSeg.maximum === 600 && exL.id.maxLength === 12
      && ESQ_LOCAL.properties.dias.minItems === 1 && ESQ_LOCAL.properties.dias.maxItems === 7 && ESQ_LOCAL.properties.dias.items.properties.exercicios.maxItems === 8 && ESQ_LOCAL.properties.motivos.maxItems === 6,
      'esquema local (functions/src/esquema-resposta.json) continua com TODOS os limites');
    const naoMexe = JSON.stringify(ESQ_LOCAL); G.esquemaParaGoogle(ESQ_LOCAL, 'openapi'); G.esquemaParaGoogle(ESQ_LOCAL, 'json');
    t(JSON.stringify(ESQ_LOCAL) === naoMexe, 'gerar o esquema do Google não altera o esquema local');
    const gUma = seq([503, identidade]);
    const xUma = await chamar(ambiente({ GEMINI_NOVA_TENTATIVA: 'false' }), { gemini: gUma });
    t(xUma.status === 503 && gUma.chamadas === 1, 'GEMINI_NOVA_TENTATIVA=false: 503 sem repetir (1 chamada)');
    const ambDet = ambiente();
    await chamar(ambDet, { gemini: geminiFalso(() => Response.json({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Request contains an invalid argument.', details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'generation_config.thinking_config.thinking_level', description: 'not supported ' + CHAVE_FALSA }] }] } }, { status: 400 })) });
    const linhaDet = LOGS.filter(l => l.includes('thinking_level')).pop() || '';
    t(linhaDet.includes('"campo":"generation_config.thinking_config.thinking_level"') && !linhaDet.includes(CHAVE_FALSA), 'erro 400: campo recusado pelo Google aparece no log (sem a chave)');
    t(!JSON.stringify(js).includes('maxLength') && JSON.stringify(js.propertyOrdering) === '["versao","dias","motivos"]', 'responseJsonSchema: só palavras aceitas pela API (sem maxLength), ordem dos campos mantida');
    const instr = g2.ultimo.corpo.systemInstruction.parts[0].text;
    t(['Seleção de exercícios', 'Equilíbrio entre grupos', 'Distribuição do volume semanal', 'Recuperação entre sessões', 'corrida', 'unilaterais', 'Posterior de coxa', 'repetições', 'RPE por papel', 'Descanso', 'tempo disponível', 'Histórico'].every(c => instr.includes(c)), 'instrução v2: avalia os 12 critérios antes de decidir');
    t(instr.includes('Não mude por mudar') && instr.includes('"manter_plano"') && instr.includes('sem mensagens para o usuário') && instr.includes('Use somente ids de "exerciciosAutorizados"'), 'instrução v2: mudança só com justificativa, manter_plano permitido, só JSON, regras de segurança mantidas');
    t(gc.responseMimeType === 'application/json' && gc.thinkingConfig.thinkingLevel === 'LOW' && gc.maxOutputTokens === 8192 && g2.ultimo.corpo.systemInstruction.parts[0].text.length > 50, 'erro: pedido ao Gemini com JSON forçado, pensamento LOW, 8192 tokens e instrução de sistema');
  }

  // ================= 8 e 9. App (perfis fictícios): F0–F9 e volta ao Motor V2 =================
  capturarLogs(false);
  const { carregarAppComIA, prepararPerfil } = require('../harness/ia.js');
  const esbuild = require('esbuild');
  const T = await carregarAppComIA();
  const cod = esbuild.buildSync({ stdin: { contents: "import { iaCriarChamadaServidor } from './servidor.js'; import { iaFotoDaSemana, iaPodeAplicar } from './aplicar.js'; Object.assign(globalThis, { iaCriarChamadaServidor, iaFotoDaSemana, iaPodeAplicar });", resolveDir: path.join(RAIZ, 'src', 'ia') }, bundle: true, format: 'iife', write: false, charset: 'utf8' }).outputFiles[0].text;
  (0, eval)(cod);
  capturarLogs(true);
  for (const nPerfil of ['08', '10']) {
    const p = await prepararPerfil(T, nPerfil);
    const semanaMotor = T.gerarPlanoSemanal(p, {}).semana;
    T.IA_CONFIG.ativa = true;
    T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });
    // Ambiente novo a cada chamada: sem isso o cache do primeiro cenário responderia os seguintes.
    const novoAmb = () => ambiente({ IA_LIMITE_DIA_USUARIO: '50', IA_LIMITE_MINUTO_GLOBAL: '100', IA_LIMITE_DIA_GLOBAL: '100' });
    const tk = await comNativos(() => token({ sub: 'perfil-ficticio-' + nPerfil }));
    const servidor = (gemini, amb = novoAmb()) => globalThis.iaCriarChamadaServidor({
      url: 'https://forza-ia.teste', obterToken: async () => tk,
      fetch: (u, init) => comNativos(async () => W.atender(new Request(u, { ...init, headers: { ...init.headers, Origin: ORIGEM_APP } }), amb.env, { verificarToken, fetchGemini: gemini.fetch })),
    });
    const refinar = (gemini, extra) => T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'x' }, tipo: 'inicial', chamarFuncao: servidor(gemini), ...(extra || {}) });

    // Resposta que repete o motor: passa em F0–F9 + validarPlano
    let r = await refinar(geminiFalso(identidade));
    t(r.origem === 'ia' && r.motivo === 'ok', `F0–F9 perfil ${nPerfil}: resposta válida passa pela validação do app (${r.origem}/${r.motivo})`);
    // Personalização: troca um exercício por outro autorizado do mesmo grupo e papel
    const personalizada = (u) => {
      const ped = JSON.parse(u.corpo.contents[0].parts[0].text); const x = identidade(u);
      const usados = new Set(x.dias.flatMap(d => d.exercicios.map(e => e.id)));
      const idx = ped.exerciciosAutorizados.reduce((m, e) => (m[e.id] = e, m), {});
      for (const d of x.dias) for (const e of d.exercicios) {
        if (e.papel !== 'isolado') continue;
        const alt = ped.exerciciosAutorizados.find(a => !usados.has(a.id) && a.grupo === (idx[e.id] || {}).grupo && a.composto === (idx[e.id] || {}).composto && a.tier <= (idx[e.id] || {}).tier && a.padrao === (idx[e.id] || {}).padrao);
        if (alt) { usados.add(alt.id); e.id = alt.id; x.motivos = ['variedade']; return x; }
      }
      return x;
    };
    r = await refinar(geminiFalso(personalizada));
    t(r.origem === 'ia' || (r.origem === 'motor' && r.motivo === 'validacao_reprovada'), `F0–F9 perfil ${nPerfil}: troca de exercício decidida pelos validadores (${r.origem}/${r.motivo}${r.erros ? ' ' + JSON.stringify(r.erros).slice(0, 120) : ''})`);
    // Violações que o servidor deixa passar (ids válidos) mas o app reprova: mais séries, RPE alto, dia novo
    const violacoes = [
      ['séries acima do motor (F2/F6)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].series = 10; return x; }],
      ['RPE 10 (F2)', (u) => { const x = identidade(u); x.dias.forEach(d => d.exercicios.forEach(e => { e.rpe = 10; })); return x; }],
      ['dia que o motor não deu (D1)', (u) => { const x = identidade(u); const livre = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].find(d => !x.dias.some(y => y.dia === d)); x.dias.push({ dia: livre, exercicios: x.dias[0].exercicios }); return x; }],
      ['exercício repetido no dia (F5)', (u) => { const x = identidade(u); x.dias[0].exercicios.push({ ...x.dias[0].exercicios[0] }); return x; }],
      ['repetições 2 (abaixo da faixa, F2)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].reps = 2; return x; }],
      ['repetições 25 (acima da faixa, F2)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].reps = 25; return x; }],
      ['séries 1 (abaixo do mínimo, F2)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].series = 1; return x; }],
      ['séries 11 (fora do esquema local, F0)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].series = 11; return x; }],
      ['RPE 3 (abaixo do mínimo, F2)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].rpe = 3; return x; }],
      ['descanso 20 s (abaixo da faixa, F2)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].descansoSeg = 20; return x; }],
      ['descanso 900 s (fora do esquema local, F0)', (u) => { const x = identidade(u); x.dias[0].exercicios[0].descansoSeg = 900; return x; }],
      ['volume semanal acima do motor (F6)', (u) => { const x = identidade(u); x.dias.forEach(d => d.exercicios.forEach(e => { e.series += 1; })); return x; }],
      ['9 exercícios no dia (fora do esquema local, F0/F5)', (u) => { const x = identidade(u); const ped = JSON.parse(u.corpo.contents[0].parts[0].text); const usados = new Set(x.dias[0].exercicios.map(e => e.id)); for (const a of ped.exerciciosAutorizados) { if (x.dias[0].exercicios.length >= 9) break; if (!usados.has(a.id)) { x.dias[0].exercicios.push({ id: a.id, papel: 'isolado', series: 2, reps: 12, rpe: 7, descansoSeg: 60 }); usados.add(a.id); } } return x; }],
    ];
    for (const [nome, gerar] of violacoes) {
      const v = await refinar(geminiFalso(gerar));
      const codigos = [...new Set((v.erros || []).map(e => String(typeof e === 'string' ? e : (e.cod || e.codigo || JSON.stringify(e))).split(/[:\s]/)[0]))].slice(0, 4).join(',');
      t(v.origem === 'motor' && v.semana === semanaMotor && (v.motivo === 'validacao_reprovada' || v.motivo === 'falha_chamada'), `F0–F9 perfil ${nPerfil}: ${nome} → plano do Motor V2 (${v.motivo}${codigos ? ' · ' + codigos : ''})`);
    }
    // Exercício fora da lista chegando ao app sem passar pelo servidor: F1 reprova sozinho
    const ctxApp = T.iaContextoDoMotor(p, {}, semanaMotor);
    const pedApp = T.iaMontarPedido(ctxApp, { perfil: p, tipo: 'inicial' });
    const fora = { versao: '1', dias: pedApp.planoMotor.map(d => ({ dia: d.dia, exercicios: d.exercicios.map(e => ({ ...e })) })), motivos: ['variedade'] };
    fora.dias[0].exercicios[0].id = '9999';
    const vF1 = await T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'x' }, tipo: 'inicial', chamarFuncao: async () => ({ resposta: fora }) });
    t(vF1.origem === 'motor' && vF1.motivo === 'validacao_reprovada' && JSON.stringify(vF1.erros || '').includes('F1'), `F0–F9 perfil ${nPerfil}: exercício não autorizado direto no app → reprovado pelo F1, plano do Motor V2 (${JSON.stringify(vF1.erros || '').slice(0, 80)})`);
    // Volta ao Motor V2 em toda falha do servidor
    const falhas = [
      ['Gemini fora do ar', geminiFalso(() => Response.json({ error: { code: 503, status: 'UNAVAILABLE', message: 'x' } }, { status: 503 }))],
      ['resposta truncada', geminiFalso(() => Response.json({ candidates: [{ content: { parts: [{ text: '{' }] }, finishReason: 'MAX_TOKENS' }] }))],
    ];
    for (const [nome, gm] of falhas) {
      const v = await refinar(gm);
      t(v.origem === 'motor' && v.semana === semanaMotor && v.motivo === 'falha_chamada', `Motor V2 perfil ${nPerfil}: ${nome} → plano do motor`);
    }
    const semToken = await T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'x' }, chamarFuncao: globalThis.iaCriarChamadaServidor({ url: 'https://forza-ia.teste', obterToken: async () => null }) });
    t(semToken.origem === 'motor' && semToken.motivo === 'falha_chamada', `Motor V2 perfil ${nPerfil}: sem token de login → plano do motor`);
    const semUrl = await T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'x' }, chamarFuncao: globalThis.iaCriarChamadaServidor({ url: '', obterToken: async () => tk }) });
    t(semUrl.origem === 'motor', `Motor V2 perfil ${nPerfil}: servidor não configurado → plano do motor`);
    const lento = await T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'x' }, chamarFuncao: () => new Promise(() => {}) });
    t(lento.origem === 'motor' && lento.motivo === 'falha_chamada', `Motor V2 perfil ${nPerfil}: servidor que não responde → plano do motor após o tempo-limite`);
    T.iaRevogarConsentimento(p);
    const g = geminiFalso(identidade);
    const rev = await refinar(g);
    t(rev.origem === 'motor' && rev.motivo === 'sem_consentimento' && g.chamadas === 0, `Motor V2 perfil ${nPerfil}: consentimento revogado → nem chama o servidor`);
    T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });

    // Atualização automática sem sobrescrever o usuário
    const foto = globalThis.iaFotoDaSemana(semanaMotor);
    const res = await refinar(geminiFalso(identidade));
    t(globalThis.iaPodeAplicar(foto, res, { semanaAtual: semanaMotor, treinoIniciado: false, mesmaSemana: true }).ok, `aplicar perfil ${nPerfil}: treino intacto e não iniciado → atualiza`);
    t(globalThis.iaPodeAplicar(foto, res, { semanaAtual: semanaMotor, treinoIniciado: true, mesmaSemana: true }).motivo === 'treino_iniciado', `aplicar perfil ${nPerfil}: treino já iniciado → não mexe`);
    const alterada = JSON.parse(JSON.stringify(semanaMotor)); const d0 = Object.keys(alterada.muscPlan)[0]; alterada.muscPlan[d0][0].reps = '15';
    t(globalThis.iaPodeAplicar(foto, res, { semanaAtual: alterada, treinoIniciado: false, mesmaSemana: true }).motivo === 'usuario_alterou', `aplicar perfil ${nPerfil}: usuário alterou o treino → não sobrescreve`);
    t(globalThis.iaPodeAplicar(foto, res, { semanaAtual: semanaMotor, treinoIniciado: false, mesmaSemana: false }).motivo === 'semana_mudou', `aplicar perfil ${nPerfil}: semana virou → descarta`);
    t(globalThis.iaPodeAplicar(foto, { origem: 'motor', semana: semanaMotor }, { semanaAtual: semanaMotor, treinoIniciado: false, mesmaSemana: true }).ok === false, `aplicar perfil ${nPerfil}: resultado do motor nunca "atualiza"`);
  }

  // ================= logs =================
  capturarLogs(false);
  const tudo = LOGS.join('\n');
  t(LOGS.length > 20, `logs: Worker registrou ${LOGS.length} linhas`);
  t(!tudo.includes(CHAVE_FALSA) && !/AQ\.chave/.test(tudo), 'logs: chave nunca aparece');
  t(!/eyJ[0-9A-Za-z_-]{10,}\./.test(tudo) && !/Bearer/.test(tudo), 'logs: token de login nunca aparece');
  t(!/usuario-ficticio|perfil-ficticio|simultaneo-/.test(tudo), 'logs: uid do usuário não é registrado');
  t(!/Supino|exerciciosAutorizados|planoMotor|faixaEtaria/.test(tudo), 'logs: conteúdo do pedido não é registrado');
  t(/"evento":"gemini_erro"/.test(tudo) && /"mensagem":"API key \*\*\* not valid/.test(tudo), 'logs: erro do Gemini registrado com o motivo e a chave mascarada');

  for (const [c, m] of R) ok(c, m);
  const falhas = R.filter(x => !x[0]).length;
  console.log(`\n${R.length - falhas}/${R.length} verificações do Worker ok`);
})().catch(e => { capturarLogs(false); console.log('FAIL erro inesperado: ' + (e && e.stack)); process.exitCode = 1; });
