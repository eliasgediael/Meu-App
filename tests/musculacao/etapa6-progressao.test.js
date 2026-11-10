// Etapa 6: dupla progressão. Bateu o topo da faixa de reps na última série, no RPE alvo ou abaixo: sobe a carga.
// Senão mantém ou ajusta. Sempre com o motivo em português.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');

let H;
test.before(async () => { H = await carregar(); });
const prog = (ex, sets) => { H.ctx.__ex = ex; H.ctx.__sets = sets; return JSON.parse(JSON.stringify(H.run('motorProgressaoDupla(__ex, __sets)'))); };
const EX = { nome: 'Supino reto com barra', reps: '8-12', rpe: 8, grupo: 'Peito', series: '3' };
const S = (peso, reps, pse) => ({ peso, reps, ...(pse != null ? { pse } : {}) });

test('topo das reps na última série, RPE no alvo: sobe a carga e explica', () => {
  const r = prog(EX, [S(60, 10, 7), S(60, 11, 8), S(60, 12, 8)]);
  assert.equal(r.direction, 'subir');
  assert.ok(r.peso > 60, 'peso ' + r.peso);
  assert.match(r.motivo, /12/);
  assert.match(r.motivo, /RPE/);
});

test('topo das reps com RPE abaixo do alvo também sobe', () => {
  const r = prog(EX, [S(60, 12, 6), S(60, 12, 7), S(60, 12, 7)]);
  assert.equal(r.direction, 'subir');
});

test('só a ÚLTIMA série conta: topo na última sobe mesmo com séries anteriores abaixo', () => {
  const r = prog(EX, [S(60, 9, 7), S(60, 10, 7), S(60, 12, 8)]);
  assert.equal(r.direction, 'subir');
});

test('não bateu o topo na última série: mantém a carga e diz quantas reps faltam', () => {
  const r = prog(EX, [S(60, 12, 7), S(60, 11, 8), S(60, 10, 8)]);
  assert.equal(r.direction, 'manter');
  assert.equal(r.peso, 60);
  assert.match(r.motivo, /10/);
  assert.match(r.motivo, /12/);
});

test('topo das reps mas RPE acima do alvo: não sobe, mantém e explica o RPE', () => {
  const r = prog(EX, [S(60, 12, 9), S(60, 12, 9), S(60, 12, 9)]);
  assert.notEqual(r.direction, 'subir');
  assert.match(r.motivo, /RPE/);
});

test('abaixo do mínimo da faixa na última série: reduz cerca de 10%', () => {
  const r = prog(EX, [S(60, 8, 8), S(60, 6, 9), S(60, 5, 10)]);
  assert.equal(r.direction, 'reduzir');
  assert.ok(r.peso < 60 && r.peso >= 52, 'peso ' + r.peso);
  assert.match(r.motivo, /8/);
});

test('sem RPE registrado: decide pelas reps e diz que o RPE não foi registrado', () => {
  const r = prog(EX, [S(60, 12), S(60, 12), S(60, 12)]);
  assert.equal(r.direction, 'subir');
  assert.match(r.motivo, /RPE/);
});

test('sem RPE alvo no exercício (manual): topo das reps sobe, sem exigir RPE', () => {
  const r = prog({ nome: 'X', reps: '10', grupo: 'Peito' }, [S(40, 10, 9)]);
  assert.equal(r.direction, 'subir');
});

test('repetição única fixa (ex.: "10"): o topo é 10', () => {
  assert.equal(prog({ nome: 'X', reps: '10', rpe: 8 }, [S(40, 10, 8)]).direction, 'subir');
  assert.equal(prog({ nome: 'X', reps: '10', rpe: 8 }, [S(40, 9, 8)]).direction, 'manter');
});

test('exercício em semana de deload: mantém a carga e diz o motivo', () => {
  const r = prog({ ...EX, deload: true }, [S(60, 12, 7)]);
  assert.equal(r.direction, 'manter');
  assert.equal(r.peso, 60);
  assert.match(r.motivo, /deload/i);
});

test('todo motivo é uma frase em português, não vazia', () => {
  const casos = [[S(60, 12, 8)], [S(60, 9, 8)], [S(60, 5, 10)], [S(60, 12, 9)], [S(60, 12)]];
  for (const sets of casos) { const r = prog(EX, sets); assert.ok(typeof r.motivo === 'string' && r.motivo.length > 15, JSON.stringify(r)); assert.match(r.motivo, /[a-zçãé]/); }
});

test('suggestedForExercise usa a dupla progressão com o histórico do app (data anterior)', () => {
  H.run(`state.historicoCarga = { 'supino-x': [ { data:'2020-01-01', sets:[ {peso:60,reps:10,pse:8}, {peso:60,reps:11,pse:8}, {peso:60,reps:12,pse:8} ] } ] }`);
  H.ctx.__ex = { ...EX, repdbId: 'supino-x' };
  const r = JSON.parse(JSON.stringify(H.run('suggestedForExercise(__ex)')));
  assert.equal(r.direction, 'subir');
  assert.ok(r.peso > 60);
  assert.match(r.motivo, /12/);
});

test('suggestedForExercise: primeira vez no exercício não tem direção nem motivo', () => {
  H.run('state.historicoCarga = {}');
  H.ctx.__ex = { ...EX, repdbId: 'nunca-feito', carga: 20 };
  const r = JSON.parse(JSON.stringify(H.run('suggestedForExercise(__ex)')));
  assert.equal(r.direction, null);
});
