// Etapa 2: semana 4 de cada bloco de 4 semanas = deload de musculação (mesmos exercícios, -1 série, RPE -1).
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { gerarSemana, resumoMusc } = require('./semanas');

let H;
test.before(async () => { H = await carregar(); });
const CASOS = [
  ['iniciante', 'academia', 3], ['iniciante', 'casa_s', 3], ['intermediario', 'academia', 4], ['intermediario', 'casa_h', 5],
  ['avancado', 'academia', 6], ['avancado', 'academia', 4], ['intermediario', 'condominio', 3],
];
const COM_CORRIDA = { cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', cUn: 'km' };

for (const extra of [{}, COM_CORRIDA]) {
  for (const [nivel, local, nDias] of CASOS) {
    const nome = `${nivel}/${local}/${nDias}d${extra.cSit ? ' +corrida' : ''}`;
    test(`deload: semana 4 = semana 3 com -1 série e RPE -1 (${nome})`, async () => {
      const R = perfil({ nivel, local, nDias, extra });
      const s3 = resumoMusc(await gerarSemana(H, R, 3));
      const s4 = resumoMusc(await gerarSemana(H, R, 4));
      assert.deepEqual(Object.keys(s4), Object.keys(s3), 'mesmos dias de musculação');
      for (const d of Object.keys(s3)) {
        assert.deepEqual(s4[d].map((e) => e.nome), s3[d].map((e) => e.nome), `${d}: mesmos exercícios`);
        s3[d].forEach((e, i) => {
          assert.equal(s4[d][i].series, Math.max(1, e.series - 1), `${d} ${e.nome}: séries ${e.series}->${s4[d][i].series}`);
          assert.equal(s4[d][i].rpe, e.rpe - 1, `${d} ${e.nome}: RPE ${e.rpe}->${s4[d][i].rpe}`);
          assert.equal(s4[d][i].reps, e.reps, `${d} ${e.nome}: mesmas repetições`);
        });
      }
    });
  }
}
test('deload: semanas 1 a 3 e 5 a 7 não são deload; semana 8 é', async () => {
  const R = perfil({ nivel: 'intermediario', local: 'academia', nDias: 4 });
  const b = async (w) => resumoMusc(await gerarSemana(H, R, w));
  const base = await b(3);
  const soma = (s) => Object.values(s).flat().reduce((t, e) => t + e.series, 0);
  assert.equal(soma(await b(2)), soma(await b(1)));
  assert.equal(soma(await b(5)), soma(base));
  assert.equal(soma(await b(7)), soma(base));
  assert.ok(soma(await b(8)) < soma(base));
  assert.ok(soma(await b(4)) < soma(base));
});

test('deload: V14 (tempo mínimo) fica mais tolerante na semana de deload, para não trocar exercícios', () => {
  const montar = () => ({
    sessoes: [{ dia: 'Seg', modalidade: 'musculacao', tipo: 'lower', foco: 'hipertrofia', duracaoMin: 17 }],
    muscPlan: { Seg: ['Agachamento livre com barra', 'Stiff com barra', 'Leg press 45 graus', 'Cadeira extensora', 'Elevação de panturrilha em pé', 'Mesa flexora (deitado)'].map((nome) => ({ nome })) },
  });
  const v = (o) => Array.from(H.run('validarConteudoMusc')(montar(), { nivel: 'intermediario', minutosDia: {}, seed: 0, ...o })).filter((x) => x.cod === 'V14');
  assert.equal(v({}).length, 1);
  assert.equal(v({ deload: true }).length, 0);
});
