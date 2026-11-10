// Etapa 3: âncora (★) por bloco. O exercício principal (base) de cada sessão fica travado nas 4 semanas do bloco;
// os acessórios podem rodar. A semana 4 (deload) mantém a âncora.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { gerarSemana, resumoMusc } = require('./semanas');

let H;
test.before(async () => { H = await carregar(); });
const COM_CORRIDA = { cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', cUn: 'km' };
const CASOS = [
  ['iniciante', 'academia', 3, {}], ['iniciante', 'casa_s', 3, {}], ['intermediario', 'academia', 4, {}], ['intermediario', 'casa_h', 5, {}],
  ['avancado', 'academia', 6, {}], ['avancado', 'academia', 4, {}], ['intermediario', 'condominio', 3, {}],
  ['intermediario', 'academia', 4, COM_CORRIDA], ['avancado', 'academia', 5, COM_CORRIDA],
];
// âncora por sessão = item marcado `ancora` (chave: tipo + ordem do tipo na semana)
const ancoras = (r) => {
  const out = {}, cont = {};
  r.sessoes.filter((s) => s.modalidade === 'musculacao').forEach((s) => {
    const k = s.tipo + '#' + (cont[s.tipo] = (cont[s.tipo] || 0) + 1);
    const b = (r.semana.muscPlan[s.dia] || []).find((e) => e.ancora);
    if (b) out[k] = b.nome;
  });
  return out;
};

for (const [nivel, local, nDias, extra] of CASOS) {
  const nome = `${nivel}/${local}/${nDias}d${extra.cSit ? ' +corrida' : ''}`;
  test(`âncora: o exercício base de cada sessão é o mesmo nas semanas 1 a 4 (${nome})`, async () => {
    const R = perfil({ nivel, local, nDias, extra });
    const a1 = ancoras(await gerarSemana(H, R, 1));
    assert.ok(Object.keys(a1).length > 0);
    for (const w of [2, 3, 4]) assert.deepEqual(ancoras(await gerarSemana(H, R, w)), a1, `semana ${w}`);
  });
}

test('âncora: a semana 4 (deload) mantém a âncora e os mesmos exercícios da semana 3', async () => {
  const R = perfil({ nivel: 'avancado', local: 'academia', nDias: 4 });
  const s3 = resumoMusc(await gerarSemana(H, R, 3)), s4 = resumoMusc(await gerarSemana(H, R, 4));
  for (const d of Object.keys(s3)) assert.deepEqual(s4[d].map((e) => e.nome), s3[d].map((e) => e.nome));
});

test('âncora: os acessórios rodam entre as semanas 1, 2 e 3 (avançado, academia)', async () => {
  const R = perfil({ nivel: 'avancado', local: 'academia', nDias: 4 });
  const acess = async (w) => Object.values(resumoMusc(await gerarSemana(H, R, w))).flat().filter((e) => e.papel !== 'base').map((e) => e.nome);
  const [a1, a2, a3] = [await acess(1), await acess(2), await acess(3)];
  assert.notDeepEqual(a2, a1, 'semana 2 igual à 1');
  assert.notDeepEqual(a3, a2, 'semana 3 igual à 2');
});

test('âncora: a âncora é um exercício composto (multiarticular)', async () => {
  const comp = H.run('(n)=>isExercicioComposto(n)');
  for (const [nivel, local, nDias, extra] of CASOS) {
    const a = ancoras(await gerarSemana(H, perfil({ nivel, local, nDias, extra }), 2));
    for (const n of Object.values(a)) assert.notEqual(comp(n), false, `${nivel}/${local}: ${n} não é composto`);
  }
});

test('âncora: sem repetir exercício no dia e sem erro de validação nas semanas 1 a 8', async () => {
  const R = perfil({ nivel: 'intermediario', local: 'academia', nDias: 4 });
  for (let w = 1; w <= 8; w++) {
    const r = await gerarSemana(H, R, w);
    assert.equal(r.validacao.ok, true, `semana ${w}: ${JSON.stringify(r.validacao.erros)}`);
    for (const l of Object.values(resumoMusc(r))) assert.equal(new Set(l.map((e) => e.nome)).size, l.length, `semana ${w}: repetido no dia`);
  }
});
