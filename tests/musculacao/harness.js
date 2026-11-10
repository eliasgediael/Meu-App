// Carrega o JS do app (treino-app.html + scripts src/motor-*.js em ordem) num vm com DOM falso,
// sem tocar no app. Uso: const { run, gerar } = await require('./harness').carregar();
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const { codigoMotor } = require(path.join(RAIZ, 'scripts', 'motor-bundle.js'));

function stub() {
  const f = function () {};
  return new Proxy(f, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return stub();
    },
    apply: () => stub(),
    construct: () => stub(),
    set: () => true,
    has: () => true,
  });
}

function extrairScripts(html, baseDir) {
  const out = [];
  // motor do app (src/motor/, empacotado como no build) entra antes do script principal, como no navegador
  out.push({ nome: 'motor.js', codigo: codigoMotor() });
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = /src="([^"]+)"/.exec(m[1]);
    if (src) {
      if (/^src\/motor-/.test(src[1])) out.push({ nome: src[1], codigo: fs.readFileSync(path.join(baseDir, src[1]), 'utf8') });
    } else {
      out.push({ nome: 'inline', codigo: m[2] });
    }
  }
  return out;
}

async function carregar(htmlPath) {
  htmlPath = htmlPath || process.env.FORZA_HTML || path.join(RAIZ, 'treino-app.html');
  const baseDir = path.dirname(htmlPath);
  const catalogo = path.join(RAIZ, 'data', 'exercicios.json');
  const store = {};
  const win = {
    storage: { get: async (k) => (store[k] ? { value: store[k] } : null), set: async (k, v) => { store[k] = v; }, delete: async (k) => { delete store[k]; }, list: async () => ({ keys: [] }) },
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    location: { href: '', search: '', hash: '' }, innerWidth: 390, innerHeight: 800, devicePixelRatio: 2,
    setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    fetch: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(catalogo, 'utf8')) }),
  };
  const doc = { getElementById: () => stub(), querySelector: () => stub(), querySelectorAll: () => [], createElement: () => stub(), addEventListener() {}, body: stub(), documentElement: stub(), head: stub(), readyState: 'loading', fonts: { ready: Promise.resolve() } };
  const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const ctx = {
    window: win, document: doc, localStorage: ls, sessionStorage: ls,
    navigator: { userAgent: 'node', language: 'pt-BR', vibrate() {}, geolocation: {} },
    console: { log() {}, warn() {}, error: console.error, info() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    fetch: win.fetch, Date, Math, JSON, Intl, URL, Promise, Event: function () {}, CustomEvent: function () {}, Image: function () {}, Audio: function () {},
    alert() {}, confirm: () => true, prompt: () => null, performance: { now: () => Date.now() }, structuredClone: global.structuredClone,
    screen: {}, history: {}, location: win.location, AbortController, TextEncoder, TextDecoder, atob, btoa,
  };
  ctx.self = ctx; ctx.globalThis = ctx; win.window = win;
  Object.assign(win, { document: doc, localStorage: ls, navigator: ctx.navigator });
  vm.createContext(ctx);
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const s of extrairScripts(html, baseDir)) {
    try { vm.runInContext(s.codigo, ctx, { filename: s.nome }); }
    catch (e) { throw new Error('erro ao carregar ' + s.nome + ': ' + e.message); }
  }
  const run = (codigo) => vm.runInContext(codigo, ctx);
  await run('carregarCatalogoExercicios()');
  // Aplica as respostas do questionário (como a tela faz) e gera a semana 1.
  async function gerar(R, opcoes) {
    ctx.__R = R; ctx.__op = opcoes || undefined;
    run('state.athleteProfile = criarAthleteProfile()');
    await run('qv2Aplicar(__R)');
    return run('gerarPlanoSemanal(state.athleteProfile, __op)');
  }
  return { ctx, run, gerar };
}

module.exports = { carregar };
