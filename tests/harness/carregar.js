// Carrega o app no harness do Node com relógio congelado e devolve as funções pedidas.
const H = require('./app-node.js');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
// Segunda-feira 05/10/2026, 10:00 (horário de Brasília): a mesma data dos prints e dos testes de navegador.
const AGORA_PADRAO = '2026-10-05T10:00:00-03:00';
async function carregarApp(nomes, opts = {}) {
  H.NET.sdkOnline = false; navigator.onLine = false;
  H.congelarRelogio(opts.agora || AGORA_PADRAO);
  H.semearAleatorio(opts.seed || 42);
  if (opts.antes) opts.antes(H);
  (0, eval)(H.js + ';\nconfirmarApp=async()=>true;\nshowToast=()=>{};\nglobalThis.__T={' + nomes.join(',') + '};');
  await espera(opts.espera || 700);
  return globalThis.__T;
}
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
let erroNaoTratado = null;
process.on('unhandledRejection', e => { erroNaoTratado = e; });
function semErro() { ok(!erroNaoTratado, 'sem erro não tratado' + (erroNaoTratado ? ': ' + String(erroNaoTratado.stack || erroNaoTratado).split('\n').slice(0, 2).join(' | ') : '')); }
module.exports = { H, carregarApp, espera, ok, semErro, AGORA_PADRAO };
