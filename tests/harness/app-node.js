// Harness de testes no Node: roda o script inteiro do treino-app.html com DOM mínimo, localStorage em memória,
// IndexedDB simulado (fake-indexeddb) e um Firebase falso controlável (online/offline/falhas).
// Fuso do Brasil em todos os testes (datas "de hoje" e virada de dia dependem dele).
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
const path = require('path');
require('fake-indexeddb/auto');
const fs = require('fs');
// Raiz do projeto: argumento opcional (compatível com os scripts antigos) ou a pasta acima de tests/.
const ROOT = (process.argv[2] && fs.existsSync(path.join(process.argv[2], 'treino-app.html'))) ? process.argv[2] : path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'treino-app.html'), 'utf8');
const js = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
const el = () => new Proxy(function(){}, { get:(t,k)=> k==='style'?{}:k==='classList'?{add:noop,remove:noop,toggle:noop,contains:()=>false}:k==='querySelectorAll'?()=>[]:k==='getAttribute'?()=>null:k==='children'?[]:k==='dataset'?{}:typeof k==='symbol'?undefined:el(), set:()=>true, apply:()=>el() });

const NET = { sdkOnline: false, cloudDown: false, writes: [], reads: 0 };
const cloud = new Map(); // caminho -> dados
function fakeFirebase(){
  const docRef = (p) => ({
    _p: p,
    collection: (c) => colRef(p + '/' + c),
    get: async () => { NET.reads++; if (NET.cloudDown) throw new Error('offline'); const d = cloud.get(p); return { exists: d !== undefined, data: () => JSON.parse(JSON.stringify(d)) }; },
    set: async (v, o) => {
      if (NET.cloudDown) throw new Error('offline');
      NET.writes.push(p);
      if (o && o.merge) {
        const cur = cloud.get(p) || {};
        for (const k of Object.keys(v)) {
          const val = v[k];
          if (val && val.__op === 'union') cur[k] = [...new Set([...(cur[k] || []), ...val.items])];
          else if (val && val.__op === 'remove') cur[k] = (cur[k] || []).filter(x => !val.items.includes(x));
          else cur[k] = val;
        }
        cloud.set(p, cur);
      } else cloud.set(p, JSON.parse(JSON.stringify(v)));
    },
    delete: async () => { if (NET.cloudDown) throw new Error('offline'); cloud.delete(p); },
  });
  const colRef = (p) => ({ doc: (id) => docRef(p + '/' + id), where: () => ({ get: async () => ({ docs: [] }), limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) });
  let authCb = null;
  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); },
    auth() { return fakeAuth; },
    firestore: Object.assign(() => ({ collection: (c) => colRef(c) }), { FieldValue: { arrayUnion: (...items) => ({ __op: 'union', items }), arrayRemove: (...items) => ({ __op: 'remove', items }) } }),
  };
  const fakeAuth = { currentUser: null, onAuthStateChanged(cb) { authCb = cb; setTimeout(() => cb(NET.user || null), 0); return noop; }, signOut: async () => { authCb && authCb(null); } };
  fb.__fire = (u) => authCb && authCb(u);
  return fb;
}
const store = new Map();
global.window = global;
global.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
global.navigator = { userAgent: 'node', geolocation: {}, onLine: true };
const listeners = {};
global.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f); };
global.document = {
  getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
  createElement: (t) => t === 'script' ? { tag: 'script', remove: noop } : el(),
  addEventListener: (t, f) => { (listeners['doc:' + t] = listeners['doc:' + t] || []).push(f); },
  head: { appendChild: (s) => { if (s.tag !== 'script') return; setTimeout(() => { if (NET.sdkOnline) { global.firebase = global.firebase || fakeFirebase(); s.onload && s.onload(); } else { s.onerror && s.onerror(); } }, 5); } },
  body: el(), documentElement: el(), visibilityState: 'visible',
};
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.matchMedia = () => ({ matches: false, addEventListener: noop });
global.requestAnimationFrame = noop; global.alert = noop; global.confirm = () => true;
// Catálogo de exercícios servido do próprio projeto; o resto da rede responde 'offline'.
global.fetch = async (u) => /exercicios.json/.test(String(u)) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'exercicios.json'), 'utf8')) } : { ok: false, json: async () => ({}) };
global.location = { reload: noop };
global.Blob = class { constructor(parts) { global.__ultimoBlob = parts.join(''); } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: noop };

// Relógio controlável: congela o "agora" num instante fixo (o tempo continua andando a partir dele).
const RealDate = Date;
let relogioOff = 0;
class DataFixa extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + relogioOff); }
  static now() { return RealDate.now() + relogioOff; }
}
DataFixa.UTC = RealDate.UTC; DataFixa.parse = RealDate.parse;
function congelarRelogio(isoOuMs) { const alvo = typeof isoOuMs === 'number' ? isoOuMs : new RealDate(isoOuMs).getTime(); relogioOff = alvo - RealDate.now(); global.Date = DataFixa; }
function avancarRelogio(ms) { relogioOff += ms; }
// Aleatório determinístico (só usado para ids); os snapshots ignoram ids, mas assim a ordem fica estável.
function semearAleatorio(seed) { let t = seed >>> 0; Math.random = () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
module.exports = { js, NET, cloud, store, listeners, fakeFirebase, ROOT, congelarRelogio, avancarRelogio, semearAleatorio };
