const H = require('../../harness/app-node.js'); const { NET } = H; const fs = require('fs');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
let erro = null; process.on('unhandledRejection', e => { erro = e; });
global.fetch = async (u) => /exercicios\.json/.test(u) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(H.ROOT + '/data/exercicios.json', 'utf8')) } : { ok: false, json: async () => ({}) };
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  (0, eval)(H.js + ';\nglobalThis.__T={state,buscarExercicios,exerciciosCompletos,repdbImg,repdbId,migrarMidiasExercicios,exThumbHtml,cargaHistFor};');
  await espera(600);
  const T = globalThis.__T, S = T.state;
  const ids = new Set(T.exerciciosCompletos().map(e => e.id));
  ok(['1461', '1462', '1463', '1464', '0603'].every(i => !ids.has(i)), 'ângulos duplicados e 0603 fora da lista/busca');
  ok(['0043', '0739', '0587', '0198'].every(i => ids.has(i)), 'principais continuam na lista');
  ok(T.buscarExercicios('desenvolvimento').every(e => e.id !== '0603'), 'busca não mostra o 0603');
  ok(T.repdbImg('0603') === 'gifs/0587.webp' && T.repdbImg('1461') === 'gifs/0043.webp', 'id antigo oculto mostra a animação certa');
  ok(T.repdbImg('0041') === null, '0041 sem animação (mídia não confere)');
  ok(T.repdbImg('plank') === null && T.repdbImg('incline-db-press') === 'gifs/0314.webp', 'ids legados corrigidos');
  let html = ''; try { html = T.exThumbHtml({ nome: 'Prancha', grupo: 'Core', repdbId: null }); } catch (e) { html = 'ERRO ' + e.message; }
  ok(!/ERRO/.test(html) && html.length > 0, 'sem animação: mostra ícone do grupo sem erro');
  // migração de treino salvo
  S.musculacao = { Seg: [{ nome: 'Desenvolvimento na máquina', repdbId: '0603', grupo: 'Ombro' }] };
  S.historicoCarga = { '0603': [{ data: '2026-09-01', carga: 20 }] };
  T.migrarMidiasExercicios();
  ok(S.musculacao.Seg[0].repdbId === '0587', 'treino salvo migra 0603 → 0587');
  ok(S.historicoCarga['0587'] && S.historicoCarga['0587'].length === 1 && !S.historicoCarga['0603'], 'histórico de carga acompanha (nada perdido)');
  T.migrarMidiasExercicios();
  ok(S.historicoCarga['0587'].length === 1, 'migração não duplica ao rodar de novo');
  await espera(30);
  ok(!erro, 'sem erro não tratado' + (erro ? ': ' + String(erro.stack || erro).split('\n').slice(0, 2).join(' | ') : ''));
  process.exit(process.exitCode || 0);
})();
