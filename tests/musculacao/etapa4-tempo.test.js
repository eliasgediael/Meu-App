// Etapa 4: preencher o tempo do dia com acessórios, respeitando o teto de séries por grupo na semana,
// sem repetir exercício e sem quebrar o validador.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { sessoesMusc } = require('./util');
const { gerarSemana } = require('./semanas');

let H;
test.before(async () => { H = await carregar(); });
const COM_CORRIDA = { cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', cUn: 'km' };
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];

test('dia de 90 min: a sessão média ocupa pelo menos 70% do teto do nível e nunca passa do dia', async () => {
  const teto = H.run('MOTOR_PARAMS.tetoSessaoMusc');
  for (const nivel of NIVEIS) {
    for (const local of ['academia', 'condominio']) {
      const r = await H.gerar(perfil({ nivel, local, nDias: 4, minutos: 90 }));
      const ss = sessoesMusc(r);
      const media = ss.reduce((t, x) => t + x.info.duracaoMin, 0) / ss.length;
      assert.ok(media >= 0.7 * teto[nivel], `${nivel}/${local}: média ${media.toFixed(1)} min (teto ${teto[nivel]})`);
      for (const { dia, info } of ss) assert.ok(info.duracaoMin <= 90, `${nivel}/${local} ${dia}: ${info.duracaoMin} min passa do dia`);
    }
  }
});

test('o dia curto não cresce: dia de 45 min continua cabendo em 45 min', async () => {
  for (const nivel of NIVEIS) {
    const r = await H.gerar(perfil({ nivel, local: 'academia', nDias: 4, minutos: 45 }));
    for (const { dia, info } of sessoesMusc(r)) assert.ok(info.duracaoMin <= 45, `${nivel} ${dia}: ${info.duracaoMin} min`);
  }
});

test('acessórios adicionados: no máximo 3 por sessão, sem repetir exercício nem família, validação ok', async () => {
  const fam = H.run('(n)=>motorFamilia(normalizeNoAccents(n))');
  for (const nivel of NIVEIS) {
    for (const local of ['academia', 'condominio', 'casa_h', 'casa_s']) {
      for (const extra of [{}, COM_CORRIDA]) {
        const r = await H.gerar(perfil({ nivel, local, nDias: 5, minutos: 90, extra }));
        assert.equal(r.validacao.ok, true, `${nivel}/${local}: ${JSON.stringify(r.validacao.erros)}`);
        for (const { dia, lista } of sessoesMusc(r)) {
          const nomes = lista.map((e) => e.nome);
          assert.equal(new Set(nomes).size, nomes.length, `${nivel}/${local} ${dia}: repetido`);
          assert.equal(new Set(nomes.map(fam)).size, nomes.length, `${nivel}/${local} ${dia}: família repetida: ${nomes.join(' | ')}`);
          assert.ok(lista.filter((e) => e.preenchido).length <= 3, `${nivel}/${local} ${dia}: mais de 3 acessórios`);
        }
      }
    }
  }
});

test('teto de séries por grupo na semana: grupo que recebeu acessório fica dentro do teto', async () => {
  const teto = H.run('(n,g)=>motorTetoSeriesGrupo(n,g)');
  let viuPreenchido = 0;
  for (const nivel of NIVEIS) {
    for (const local of ['academia', 'condominio', 'casa_h']) {
      for (const nDias of [3, 5, 6]) {
        const r = await H.gerar(perfil({ nivel, local, nDias, minutos: 90 }));
        const tot = {}, comExtra = new Set();
        for (const { lista } of sessoesMusc(r)) lista.forEach((e) => { tot[e.grupo] = (tot[e.grupo] || 0) + parseInt(e.series, 10); if (e.preenchido) { comExtra.add(e.grupo); viuPreenchido++; } });
        comExtra.forEach((g) => assert.ok(tot[g] <= teto(nivel, g), `${nivel}/${local}/${nDias}d ${g}: ${tot[g]} séries > teto ${teto(nivel, g)}`));
      }
    }
  }
  assert.ok(viuPreenchido > 0, 'nenhum acessório foi adicionado em nenhum perfil');
});

test('o teto realmente barra: com teto 0 nenhum acessório entra', async () => {
  H.run('globalThis.__t = motorTetoSeriesGrupo; motorTetoSeriesGrupo = () => 0;');
  try {
    const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 4, minutos: 90 }));
    for (const { lista } of sessoesMusc(r)) assert.equal(lista.filter((e) => e.preenchido).length, 0);
  } finally { H.run('motorTetoSeriesGrupo = __t'); }
});

test('manutenção e suporte à corrida não são preenchidos', async () => {
  const r = await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 5, minutos: 90, obj: 'prova', extra: { ...COM_CORRIDA, cFreq: 4 } }));
  for (const { lista, info } of sessoesMusc(r)) if (!['hipertrofia', 'forca'].includes(info.foco)) assert.equal(lista.filter((e) => e.preenchido).length, 0, `${info.dia} foco ${info.foco}`);
});

test('deload mantém os acessórios preenchidos da semana 3 (mesmos exercícios)', async () => {
  const R = perfil({ nivel: 'avancado', local: 'academia', nDias: 4, minutos: 90 });
  const n = async (w) => sessoesMusc(await gerarSemana(H, R, w)).map((s) => s.lista.map((e) => e.nome));
  assert.deepEqual(await n(4), await n(3));
});
