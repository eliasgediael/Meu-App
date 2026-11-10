// Parte 2: correções a-f do gerador de musculação (um teste por correção).
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { sessoesMusc } = require('./util');

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const LOCAIS = ['academia', 'condominio', 'casa_h', 'casa_s'];
let H;
test.before(async () => {
  H = await carregar();
});

async function todos(filtro) {
  const out = [];
  for (const nivel of NIVEIS) {
    for (const local of LOCAIS) {
      for (const nDias of [2, 3, 4, 5, 6]) {
        if (filtro && !filtro({ nivel, local, nDias })) continue;
        const r = await H.gerar(perfil({ nivel, local, nDias }));
        out.push({ nivel, local, nDias, r, sess: sessoesMusc(r) });
      }
    }
  }
  return out;
}
const ISO = /^(prancha|prancha lateral|cadeira \(wall sit\))$/i;

test('a) isometria em segundos: prancha, prancha lateral e wall sit', async () => {
  let achou = 0;
  for (const p of await todos()) {
    for (const { dia, lista } of p.sess) {
      for (const e of lista) {
        if (!ISO.test(e.nome)) continue;
        achou++;
        assert.match(String(e.reps), /^\d+ s$/, `${p.nivel}/${p.local}/${p.nDias} ${dia}: ${e.nome} com reps "${e.reps}"`);
        const seg = parseInt(e.reps, 10);
        assert.ok(seg >= 15 && seg <= 60, `${e.nome}: ${seg} s fora de 15-60`);
      }
    }
  }
  assert.ok(achou > 0, 'nenhuma isometria encontrada para testar');
});

test('a) tempo progride com o nível (iniciante <= intermediário <= avançado)', async () => {
  const seg = {};
  for (const nivel of NIVEIS) {
    const r = await H.gerar(perfil({ nivel, local: 'academia', nDias: 4 }));
    const todosEx = sessoesMusc(r).flatMap((s) => s.lista);
    const e = todosEx.find((x) => x.nome === 'Prancha');
    if (e) seg[nivel] = parseInt(e.reps, 10);
  }
  const v = NIVEIS.map((n) => seg[n]).filter((x) => x !== undefined);
  assert.ok(v.length >= 2, 'prancha em pelo menos 2 níveis');
  for (let i = 1; i < v.length; i++) assert.ok(v[i] >= v[i - 1], `tempos ${JSON.stringify(seg)}`);
});

test('b) dias seguidos não repetem exercício principal (base/auxiliar): alterna variações', async () => {
  for (const p of await todos((x) => x.nivel !== 'iniciante' && ['academia', 'condominio'].includes(x.local) && x.nDias >= 3)) {
    const por = {};
    p.sess.forEach((s) => { por[s.dia] = s.lista.filter((e) => e.papel !== 'isolado').map((e) => e.nome); });
    DIAS.forEach((d, i) => {
      const n = DIAS[i + 1];
      if (!n || !por[d] || !por[n]) return;
      const rep = por[d].filter((x) => por[n].includes(x));
      assert.equal(rep.length, 0, `${p.nivel}/${p.local}/${p.nDias}d ${d}->${n}: repetiu ${rep.join(', ')}`);
    });
  }
});

test('c) casa com halteres: base de pernas é agachamento com halteres, não sem peso', async () => {
  for (const p of await todos((x) => x.local === 'casa_h' && x.nivel !== 'iniciante' && x.nDias >= 3)) {
    for (const { dia, lista } of p.sess) {
      const base = lista.find((e) => e.papel === 'base' && e.grupo === 'Pernas');
      if (base) assert.match(base.nome, /halteres/i, `${p.nivel}/${p.nDias}d ${dia}: base = ${base.nome}`);
    }
  }
});

test('d) hiperextensão lombar só com banco', async () => {
  for (const p of await todos((x) => x.local === 'casa_h' || x.local === 'casa_s')) {
    for (const { dia, lista } of p.sess) {
      assert.ok(!lista.some((e) => /Hiperextensão/.test(e.nome)), `${p.nivel}/${p.local}/${p.nDias}d ${dia}: hiperextensão sem banco`);
    }
  }
  // sem banco o quadril usa ponte de glúteo (ou superman)
  const r = await H.gerar(perfil({ nivel: 'iniciante', local: 'casa_s', nDias: 3 }));
  const nomes = sessoesMusc(r).flatMap((s) => s.lista.map((e) => e.nome));
  assert.ok(nomes.some((n) => /Ponte de glúteo|Superman/.test(n)), nomes.join(' | '));
});

test('e) wall sit não repete na mesma semana', async () => {
  for (const p of await todos()) {
    const n = p.sess.flatMap((s) => s.lista).filter((e) => /wall sit/i.test(e.nome)).length;
    assert.ok(n <= 1, `${p.nivel}/${p.local}/${p.nDias}d: wall sit ${n}x`);
  }
});

test('f) barra fixa negativa não entra para avançado; Smith e tier 2+ não entram para iniciante', async () => {
  const tier = H.run('(n)=>exercicioTier({ nome:n, nivel:"intermediario" })');
  for (const p of await todos()) {
    const nomes = p.sess.flatMap((s) => s.lista.map((e) => e.nome));
    if (p.nivel === 'avancado') assert.ok(!nomes.some((n) => /Barra fixa negativa/.test(n)), `${p.local}/${p.nDias}d: negativa para avançado`);
    if (p.nivel === 'iniciante') {
      assert.ok(!nomes.some((n) => /Smith/i.test(n)), `${p.local}/${p.nDias}d: Smith para iniciante: ${nomes.join(' | ')}`);
      for (const e of p.sess.flatMap((s) => s.lista)) assert.ok(e.tier === 1, `${p.local}/${p.nDias}d: ${e.nome} é tier ${e.tier} para iniciante`);
    }
  }
  assert.equal(typeof tier, 'function');
});
