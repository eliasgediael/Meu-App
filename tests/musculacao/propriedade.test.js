// Teste de propriedade: dias por semana x nível x equipamento x seeds.
// Invariantes que valem para qualquer plano de musculação gerado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { analisador, problemas, sessoesMusc } = require('./util');

const SEEDS = [0, 1, 2];
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const LOCAIS = ['academia', 'condominio', 'casa_h', 'casa_s'];
const DIAS = [2, 3, 4, 5, 6];

test('propriedade: sem repetição no dia, push+pull em upper/full, core em full', async () => {
  const H = await carregar();
  const A = analisador(H.run);
  let n = 0;
  const falhas = [];
  for (const nivel of NIVEIS) {
    for (const local of LOCAIS) {
      for (const nDias of DIAS) {
        for (const seed of SEEDS) {
          const r = await H.gerar(perfil({ nivel, local, nDias }), { ajustesIniciais: { seed } });
          n++;
          for (const p of problemas(r, A)) falhas.push(`${nivel}/${local}/${nDias}d/seed${seed}: ${p}`);
        }
      }
    }
  }
  assert.equal(n, NIVEIS.length * LOCAIS.length * DIAS.length * SEEDS.length);
  assert.deepEqual(falhas.slice(0, 15), [], `${falhas.length} violações em ${n} planos (primeiras 15 acima)`);
});

test('propriedade: todo plano tem pelo menos uma sessão de musculação quando há dia com tempo', async () => {
  const H = await carregar();
  for (const nivel of NIVEIS) {
    for (const local of LOCAIS) {
      for (const nDias of DIAS) {
        const r = await H.gerar(perfil({ nivel, local, nDias }));
        assert.equal(r.status, 'ok');
        assert.ok(sessoesMusc(r).length >= 1, `${nivel}/${local}/${nDias}: sem musculação`);
      }
    }
  }
});
