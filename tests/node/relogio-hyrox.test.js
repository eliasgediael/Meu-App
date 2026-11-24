// Treino Hyrox em blocos -> formato do app FORZA HYROX do relógio (contrato em src/relogio/garmin-contrato.js).
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const C = require('../../src/relogio/garmin-contrato.js');

const prova = C.provaHyrox();
ok(prova.b.length === 16, 'prova Hyrox tem 16 blocos (8 corridas + 8 estações)');
const h = C.hyroxCompacto(prova);
ok(h && h.y === 'h' && h.id === 'hx_prova' && h.b.length === 16, 'prova vira treino compacto');
ok(JSON.stringify(h.b[0]) === '["Corrida","d",1000]' && JSON.stringify(h.b[1]) === '["SkiErg","o"]', 'corrida 1 km e estação livre');

const msgs = C.mensagensHyrox([prova, { id: 'hx_2', n: 'Aula', b: [{ n: 'SkiErg', k: 't', v: 300 }, { n: 'Descanso', k: 't', v: 60 }] }], 3000, 'abc');
ok(msgs.length >= 1 && msgs.every((m) => m.t === 'w' && m.v === 3 && m.hv === 1 && m.pgs === msgs.length), 'mensagens em páginas com hv');
ok(msgs.every((m) => JSON.stringify(m).length <= 3000), 'cada página cabe em 3000 bytes');
ok([].concat(...msgs.map((m) => m.w)).length === 2, 'os dois treinos seguem');

ok(C.hyroxCompacto({ id: 'x', n: 'a', b: [{ n: 'SkiErg', k: 't' }] }) === null, 'tempo sem valor é inválido');
ok(C.hyroxCompacto({ id: 'x', n: 'a', b: [{ n: 'SkiErg', k: 'x', v: 5 }] }) === null, 'medida desconhecida é inválida');
ok(C.hyroxCompacto({ id: 'x', n: 'a', b: [] }) === null, 'sem blocos é inválido');
ok(C.hyroxCompacto({ id: 'x', n: 'a', b: Array.from({ length: 31 }, () => ({ n: 'SkiErg', k: 'o' })) }) === null, 'mais de 30 blocos é inválido');
const grande = { id: 'g', n: 'grande', b: Array.from({ length: 30 }, (_, i) => ({ n: 'Wall Balls ' + i, k: 't', v: 3600 + i })) };
const mg = C.mensagensHyrox([grande], 3000, 'z');
ok(mg.every((m) => JSON.stringify(m).length <= 3000) && [].concat(...mg.map((m) => m.w)).length === 1, '30 blocos cabem numa página de 3000 bytes');
