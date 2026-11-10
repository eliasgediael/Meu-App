// Ressalva da Remada invertida na tela do exercício (execução e biblioteca).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { carregar } = require('./harness');

test('exercicioAviso devolve a ressalva só para a Remada invertida', async () => {
  const H = await carregar();
  const f = H.run('exercicioAviso');
  assert.equal(f('Remada invertida'), 'Precisa de mesa firme ou barra baixa.');
  assert.equal(f('Remada curvada com barra'), null);
  assert.equal(f('Supino reto com barra'), null);
});

test('a ressalva aparece na tela de execução e no detalhe da biblioteca', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'treino-app.html'), 'utf8');
  const usos = html.match(/exercicioAviso\(/g) || [];
  assert.ok(usos.length >= 3, 'definição + execução + biblioteca (achei ' + usos.length + ')');
  assert.ok(/\.mrt-aviso\{/.test(html), 'estilo .mrt-aviso');
});
