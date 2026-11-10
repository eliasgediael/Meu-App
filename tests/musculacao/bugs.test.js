// Um teste por bug de seleção do gerador de musculação (Parte 1, passo 2).
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { sessoesMusc, analisador } = require('./util');

let H;
let A;
test.before(async () => {
  H = await carregar();
  A = analisador(H.run);
});

test('B1 padraoMovimento agrupa flexoras e panturrilhas', () => {
  const p = H.run('(n)=>padraoMovimento(n)');
  assert.equal(p('Cadeira flexora (sentado)'), p('Mesa flexora (deitado)'), 'duas flexoras devem ser o mesmo padrão');
  assert.equal(p('Elevação de panturrilha sentado'), p('Panturrilha no leg press'), 'duas panturrilhas devem ser o mesmo padrão');
  assert.notEqual(p('Cadeira extensora'), p('Mesa flexora (deitado)'));
});

test('B1 nenhum dia de avançado/academia tem duas flexoras, extensoras ou panturrilhas', async () => {
  for (const nDias of [4, 5, 6]) {
    const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias }));
    for (const { dia, lista } of sessoesMusc(r)) {
      const f = lista.map((e) => A.fam(e.nome));
      for (const x of ['flexora', 'panturrilha', 'extensora']) {
        assert.ok(f.filter((y) => y === x).length <= 1, `${nDias}d ${dia}: ${x} repetida em ${lista.map((e) => e.nome).join(' | ')}`);
      }
    }
  }
});

test('B2 regex do slot unilateral não casa "Panturrilha no leg press"', () => {
  const pref = H.run('HB_SLOT.unilateral.pref');
  for (const k of Object.keys(pref)) assert.ok(!pref[k].some((re) => re.test('panturrilha no leg press')), `pref.${k} casa panturrilha`);
});

test('B2 regex do slot puxVert não casa "Pulldown reto (braço estendido)"', () => {
  const pref = H.run('HB_SLOT.puxVert.pref');
  for (const k of Object.keys(pref)) assert.ok(!pref[k].some((re) => re.test('pulldown reto (braco estendido)')), `pref.${k} casa o pulldown de braço estendido`);
});

test('B3 2º dia de pernas não usa agachamento sem peso como exercício base (academia/condomínio)', async () => {
  for (const local of ['academia', 'condominio']) {
    for (const nivel of ['intermediario', 'avancado']) {
      for (const nDias of [3, 4, 5, 6]) {
        const r = await H.gerar(perfil({ nivel, local, nDias }));
        for (const { dia, lista } of sessoesMusc(r)) {
          const base = lista.find((e) => e.papel === 'base' && e.grupo === 'Pernas');
          if (base) assert.notEqual(base.nome, 'Agachamento livre', `${nivel}/${local}/${nDias} ${dia}: base de pernas = agachamento sem peso`);
        }
      }
    }
  }
});

test('B4 full body de iniciante tem remada (puxar horizontal) e core', async () => {
  for (const local of ['academia', 'condominio', 'casa_h', 'casa_s']) {
    for (const nDias of [3, 4, 5]) {
      const r = await H.gerar(perfil({ nivel: 'iniciante', local, nDias }));
      for (const { dia, lista, info } of sessoesMusc(r)) {
        if (!info || info.tipo !== 'full') continue;
        const nomes = lista.map((e) => e.nome);
        assert.ok(nomes.some((n) => A.chave(n) === 'puxarH'), `${local}/${nDias} ${dia}: sem remada: ${nomes.join(' | ')}`);
        assert.ok(nomes.some(A.ehCore), `${local}/${nDias} ${dia}: sem core: ${nomes.join(' | ')}`);
      }
    }
  }
});

test('B5 iniciante sem equipamento tem pelo menos um exercício de puxar em cada sessão', async () => {
  for (const nDias of [2, 3, 4, 5]) {
    const r = await H.gerar(perfil({ nivel: 'iniciante', local: 'casa_s', nDias }));
    const s = sessoesMusc(r);
    assert.ok(s.length > 0, 'sem sessões de musculação');
    for (const { dia, lista } of s) assert.ok(lista.some((e) => A.ehPull(e.nome)), `${nDias}d ${dia}: sem puxar: ${lista.map((e) => e.nome).join(' | ')}`);
  }
});
