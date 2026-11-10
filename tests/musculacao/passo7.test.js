// Passo 7: RPE por calibração de musculação, pool de casa, dobradiça em dias seguidos e GIFs trocados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { carregar } = require('./harness');
const { perfil } = require('./perfis');
const { sessoesMusc } = require('./util');

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
let H;
test.before(async () => {
  H = await carregar();
});

const CORRIDA_REGULAR = { cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', cUn: 'km' };
const rpes = (r) => {
  const o = {};
  Object.values(r.semana.muscPlan).forEach((l) => l.forEach((e) => { o[e.papel] = e.rpe; }));
  return o;
};

// ---------- 1. RPE ----------
test('1) RPE do avançado é o mesmo com corrida "nunca" e com corrida regular (9/8/7)', async () => {
  const nunca = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 4 }));
  const regular = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 4, extra: CORRIDA_REGULAR }));
  assert.equal(nunca.calibracao.musc, false);
  assert.deepEqual({ ...rpes(nunca) }, { base: 9, auxiliar: 8, isolado: 7 }, 'corrida nunca');
  assert.deepEqual({ ...rpes(regular) }, { base: 9, auxiliar: 8, isolado: 7 }, 'corrida regular');
});

test('1) intermediário com corrida "nunca" sai com RPE 8/7/7', async () => {
  const r = await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 4 }));
  assert.deepEqual({ ...rpes(r) }, { base: 8, auxiliar: 7, isolado: 7 });
});

test('1) iniciante de musculação continua limitado a RPE 7 (calibração da própria musculação)', async () => {
  const r = await H.gerar(perfil({ nivel: 'iniciante', local: 'academia', nDias: 3 }));
  assert.equal(r.calibracao.musc, true);
  for (const v of Object.values(rpes(r))) assert.ok(v <= 7);
});

test('1) muscSeriesFator: 0,85 só quando a musculação está em calibração', async () => {
  const av = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 4 }));
  assert.equal(av.trajetoria[0].muscSeriesFator, 1, 'avançado (corrida nunca) não reduz séries');
  const ini = await H.gerar(perfil({ nivel: 'iniciante', local: 'academia', nDias: 3 }));
  assert.equal(ini.trajetoria[0].muscSeriesFator, 0.85);
  assert.equal(ini.trajetoria[2].muscSeriesFator, 1);
});

// ---------- 2. pool de casa ----------
test('2) pernas em casa com halteres: nenhuma sessão abaixo do tamanho nominal', async () => {
  const qtd = H.run('(nivel,foco)=>motorQtdExercicios({ capacidade:{ musc:nivel } }, foco)');
  for (const nivel of ['intermediario', 'avancado']) {
    for (const nDias of [3, 4, 5, 6]) {
      const r = await H.gerar(perfil({ nivel, local: 'casa_h', nDias }));
      for (const { dia, lista, info } of sessoesMusc(r)) {
        if (info.tipo !== 'lower') continue;
        const q = qtd(nivel, info.foco);
        assert.ok(lista.length >= q, `${nivel}/${nDias}d ${dia}: ${lista.length} exercícios (nominal ${q}): ${lista.map((e) => e.nome).join(' | ')}`);
      }
    }
  }
});

test('2) o pool de casa ganhou panturrilha em pé com halteres', () => {
  const nomes = Object.values(H.run('POOL.halteres')).flat().map((e) => e.nome);
  assert.ok(nomes.includes('Panturrilha em pé com halteres'), nomes.join(', '));
});

// ---------- 3. dobradiça ----------
test('3) dobradiça de quadril (stiff, terra, bom dia) não aparece em sessões de musculação consecutivas', async () => {
  const pad = H.run('(n)=>padraoMovimento(n)');
  for (const nivel of ['intermediario', 'avancado']) {
    // em casa o pool de perna é curto: a dobradiça só cede quando a sessão ficaria abaixo do tamanho nominal (teste 2)
    for (const local of ['academia', 'condominio']) {
      for (const nDias of [3, 4, 5, 6]) {
        const r = await H.gerar(perfil({ nivel, local, nDias }));
        const ordem = sessoesMusc(r).sort((x, y) => DIAS.indexOf(x.dia) - DIAS.indexOf(y.dia));
        const temHinge = (s) => s.lista.some((e) => e.papel !== 'isolado' && pad(e.nome) === 'dobradica');
        for (let i = 1; i < ordem.length; i++) {
          assert.ok(!(temHinge(ordem[i - 1]) && temHinge(ordem[i])), `${nivel}/${local}/${nDias}d ${ordem[i - 1].dia}->${ordem[i].dia}: dobradiça nas duas sessões`);
        }
      }
    }
  }
});

// ---------- 4. GIFs ----------
test('4) exercícios com GIF de outro exercício saíram do pool e dos planos', async () => {
  const fora = ['Agachamento livre', 'Flexão pike', 'Cão-prancha dinâmico', 'Elevação frontal com barra'];
  const P = H.run('POOL');
  const nomes = new Set(Object.values(P).flatMap((g) => Object.values(g).flat()).map((e) => e.nome));
  for (const f of fora) assert.ok(!nomes.has(f), `${f} ainda está no POOL`);
  for (const nivel of ['iniciante', 'intermediario', 'avancado']) {
    for (const local of ['academia', 'condominio', 'casa_h', 'casa_s']) {
      const r = await H.gerar(perfil({ nivel, local, nDias: 4 }));
      const usados = sessoesMusc(r).flatMap((s) => s.lista.map((e) => e.nome));
      for (const f of fora) assert.ok(!usados.includes(f), `${nivel}/${local}: ${f} no plano`);
    }
  }
});

test('4) todo exercício do POOL com id aponta para arquivo existente', () => {
  const P = H.run('POOL');
  const raiz = path.join(__dirname, '..', '..');
  const semArquivo = [];
  Object.values(P).forEach((g) => Object.values(g).flat().forEach((e) => {
    if (e.id && !fs.existsSync(path.join(raiz, 'gifs', e.id + '.webp'))) semArquivo.push(`${e.nome} (${e.id})`);
  }));
  assert.equal(semArquivo.length, 0, semArquivo.join(', '));
});
