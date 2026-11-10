// Passo 4: o validador reprova de verdade o conteúdo da musculação e o motor tenta outros seeds.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { analisador, problemas } = require('./util');

let H;
test.before(async () => {
  H = await carregar();
});

const ex = (nome, papel = 'auxiliar', grupo = 'Pernas') => ({ nome, papel, grupo });
const sess = (dia, tipo, lista, duracaoMin = 30) => ({ dia, tipo, lista, duracaoMin });
function montar(sessoes) {
  const muscPlan = {};
  sessoes.forEach((s) => { muscPlan[s.dia] = s.lista; });
  return { sessoes: sessoes.map((s) => ({ dia: s.dia, modalidade: 'musculacao', tipo: s.tipo, foco: 'hipertrofia', duracaoMin: s.duracaoMin })), muscPlan };
}
// Array.from: o resultado vem de outro realm do vm e o deepEqual estrito compara protótipos.
const valida = (sessoes, opts = {}) => Array.from(H.run('validarConteudoMusc')(montar(sessoes), { nivel: 'intermediario', minutosDia: {}, seed: 0, ...opts }));
const cods = (erros) => erros.map((e) => e.cod);

const FULL_OK = [ex('Agachamento livre com barra', 'base'), ex('Supino reto com barra', 'auxiliar', 'Peito'), ex('Remada curvada com barra', 'auxiliar', 'Costas'), ex('Stiff com barra'), ex('Prancha', 'isolado', 'Core')];
const UPPER_OK = [ex('Supino reto com barra', 'base', 'Peito'), ex('Remada curvada com barra', 'auxiliar', 'Costas'), ex('Desenvolvimento com halteres sentado', 'auxiliar', 'Ombro'), ex('Elevação lateral com halteres', 'isolado', 'Ombro'), ex('Tríceps testa com barra', 'isolado', 'Braço')];
const LOWER_OK = [ex('Agachamento livre com barra', 'base'), ex('Stiff com barra'), ex('Cadeira extensora', 'isolado'), ex('Mesa flexora (deitado)', 'isolado'), ex('Elevação de panturrilha em pé', 'isolado')];

test('V0 sessões corretas não geram erro', () => {
  assert.deepEqual(valida([sess('Seg', 'full', FULL_OK, 29), sess('Qui', 'upper', UPPER_OK, 29)]), []);
});

test('V11 exercício repetido ou duas flexoras no mesmo dia', () => {
  const rep = [...LOWER_OK, ex('Stiff com barra')];
  assert.ok(cods(valida([sess('Seg', 'lower', rep, 29)])).includes('V11'), 'nome repetido');
  const flex = [...LOWER_OK, ex('Cadeira flexora (sentado)', 'isolado')];
  assert.ok(cods(valida([sess('Seg', 'lower', flex, 29)])).includes('V11'), 'duas flexoras');
});

test('V12 falta de puxar ou de empurrar em upper/full', () => {
  const semPuxar = UPPER_OK.filter((e) => !/Remada/.test(e.nome));
  assert.ok(cods(valida([sess('Seg', 'upper', semPuxar, 24)])).includes('V12'), 'sem puxar');
  // o app classifica elevação lateral como empurrar vertical (motorPadraoChave), então sai junto
  const semEmpurrar = UPPER_OK.filter((e) => !/Supino|Desenvolvimento|Elevação lateral/.test(e.nome));
  assert.ok(cods(valida([sess('Seg', 'upper', semEmpurrar, 24)])).includes('V12'), 'sem empurrar');
  assert.ok(!cods(valida([sess('Seg', 'lower', LOWER_OK, 29)])).includes('V12'), 'lower não exige push/pull');
});

test('V13 full body sem core', () => {
  const semCore = FULL_OK.filter((e) => e.nome !== 'Prancha');
  assert.ok(cods(valida([sess('Seg', 'full', semCore, 24)])).includes('V13'));
});

test('V14 sessão muito abaixo do tempo esperado', () => {
  assert.ok(cods(valida([sess('Seg', 'upper', UPPER_OK, 8)], { minutosDia: { Seg: 60 } })).includes('V14'));
  assert.ok(!cods(valida([sess('Seg', 'upper', UPPER_OK, 30)], { minutosDia: { Seg: 60 } })).includes('V14'));
});

test('V15 reprova só pernas pesadas em dias seguidos (upper+upper é penalidade de distribuição, não erro)', () => {
  assert.ok(cods(valida([sess('Ter', 'lower', LOWER_OK, 29), sess('Qua', 'lower', LOWER_OK, 29)])).includes('V15'), 'lower + lower');
  assert.ok(cods(valida([sess('Dom', 'lower', LOWER_OK, 29), sess('Seg', 'lower', LOWER_OK, 29)])).includes('V15'), 'virada da semana');
  assert.ok(!cods(valida([sess('Ter', 'upper', UPPER_OK, 29), sess('Qua', 'upper', UPPER_OK, 29)])).includes('V15'), 'upper + upper não reprova');
  assert.ok(!cods(valida([sess('Seg', 'lower', LOWER_OK, 29), sess('Ter', 'upper', UPPER_OK, 29)])).includes('V15'), 'lower + upper é ok');
});

test('distribuição: custo maior para o mesmo grupo em dias seguidos', () => {
  const c = H.run('motorSobreposicaoSeguida');
  assert.ok(c('upper', 'upper') > 0);
  assert.ok(c('lower', 'full') > 0);
  assert.equal(c('lower', 'upper'), 0);
  assert.equal(c('upper', 'lower'), 0);
});

test('seed: reprovou, tenta outro seed e para no primeiro que passa', async () => {
  H.run(`globalThis.__orig = validarConteudoMusc; validarConteudoMusc = (s, o) => (o && o.seed < 3 ? [{ cod: 'V11', detalhe: 'forçado' }] : __orig(s, o));`);
  try {
    const r = await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 3 }));
    assert.equal(r.validacao.conteudo.seed, 3, 'deve parar no seed 3');
    assert.equal(r.validacao.conteudo.tentativas, 3);
    assert.equal(r.validacao.conteudo.fallback, false);
    assert.ok(r.validacao.ok);
  } finally {
    H.run('validarConteudoMusc = __orig');
  }
});

test('seed: sem alternativa em 10 tentativas usa fallback com aviso e entrega o plano', async () => {
  H.run(`globalThis.__orig = validarConteudoMusc; validarConteudoMusc = () => [{ cod: 'V11', detalhe: 'forçado' }];`);
  try {
    const r = await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 3 }));
    assert.equal(r.validacao.conteudo.tentativas, 10);
    assert.equal(r.validacao.conteudo.fallback, true);
    assert.ok(r.validacao.avisos.some((a) => a.cod === 'V11'), 'aviso do fallback');
    assert.ok(r.alertas.some((a) => /^V11/.test(a)), 'alerta no plano');
    assert.ok(Object.keys(r.semana.muscPlan).length >= 1, 'plano entregue mesmo assim');
    assert.equal(r.status, 'ok');
  } finally {
    H.run('validarConteudoMusc = __orig');
  }
});

test('integração: plano com problema de conteúdo nunca sai sem aviso', async () => {
  const A = analisador(H.run);
  for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
    for (const local of ['academia', 'casa_s']) {
      for (const nDias of [2, 3, 4, 5, 6]) {
        const r = await H.gerar(perfil({ nivel, local, nDias }));
        const p = problemas(r, A);
        if (p.length) assert.ok(r.validacao.avisos.length > 0, `${nivel}/${local}/${nDias}: ${p[0]} sem aviso`);
        assert.ok(r.validacao.conteudo, 'campo validacao.conteudo');
      }
    }
  }
});
