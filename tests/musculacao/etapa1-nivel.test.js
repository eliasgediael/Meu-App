// Etapa 1: o nível de musculação vem da experiência (tempo de treino consistente), não da frequência semanal.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');

let H;
test.before(async () => { H = await carregar(); });
const nivel = async (extra) => (await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 4, extra }))).capacidade.musc;

test('1-3 anos treinando 2x/semana é intermediário, não iniciante', async () => {
  assert.equal(await nivel({ mExp: '1-3a', mFreq: 2 }), 'intermediario');
});
test('mais de 3 anos treinando 1x/semana é avançado', async () => {
  assert.equal(await nivel({ mExp: 'mais3a', mFreq: 1 }), 'avancado');
});
test('6-12 meses a 2x/semana é intermediário', async () => {
  assert.equal(await nivel({ mExp: '6-12m', mFreq: 2 }), 'intermediario');
});
test('menos de 6 meses é iniciante mesmo treinando 5x/semana', async () => {
  assert.equal(await nivel({ mExp: '3-6m', mFreq: 5 }), 'iniciante');
  assert.equal(await nivel({ mExp: 'menos3m', mFreq: 6 }), 'iniciante');
});
test('frequência não muda o nível quando a experiência foi respondida', async () => {
  for (const f of [1, 2, 3, 4, 5, 6, 7]) assert.equal(await nivel({ mExp: '1-3a', mFreq: f }), 'intermediario', 'freq ' + f);
});
test('quem nunca treinou continua iniciante', async () => {
  const r = await H.gerar(perfil({ nivel: 'iniciante', local: 'academia', nDias: 3 }));
  assert.equal(r.capacidade.musc, 'iniciante');
});
