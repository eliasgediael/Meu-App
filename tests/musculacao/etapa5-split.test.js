// Etapa 5: avançado com 6 dias disponíveis passa de 4 para 5 sessões de musculação (Upper, Lower, Push, Pull, Legs).
// Intermediário continua com teto 4.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./harness');
const { perfil, dias } = require('./perfis');
const { sessoesMusc } = require('./util');
const { gerarSemana, resumoMusc } = require('./semanas');

let H;
test.before(async () => { H = await carregar(); });
const nMusc = (r) => r.sessoes.filter((s) => s.modalidade === 'musculacao').length;
const varia = (s) => s.variante || s.tipo;
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// Corredor regular (1 corrida por semana): o iniciante de corrida exige 2 dias livres, o que impede 5 sessões de musculação em 6 dias;
// com a corrida do avançado há 6 dias de treino, e a rodagem divide o dia com uma sessão sem encostar no Longão.
const CORRE1 = { cSit: 'regular', cExp: '1-3a', cFreq: 1, cMaior: '5', cUn: 'km' };
const p6 = (local, extra = {}) => perfil({ nivel: 'avancado', local, nDias: 6, extra: { ...CORRE1, ...extra } });

test('avançado com 6 dias: 5 sessões, uma de cada: Upper, Lower, Push, Pull, Legs', async () => {
  for (const local of ['academia', 'condominio']) {
    const r = await H.gerar(p6(local));
    assert.equal(nMusc(r), 5, `${local}: ${nMusc(r)} sessões`);
    const v = Array.from(r.sessoes.filter((s) => s.modalidade === 'musculacao').map(varia)).sort();
    assert.deepEqual(v, ['legs', 'lower', 'pull', 'push', 'upper'], local);
  }
});

test('avançado que declara 6 treinos por semana também chega a 5 (teto), nunca a 6', async () => {
  const r = await H.gerar(p6('academia', { mFreq: 6 }));
  assert.equal(nMusc(r), 5);
});

test('avançado com menos de 6 dias continua com teto 4', async () => {
  for (const nDias of [4, 5]) {
    const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias, extra: { mFreq: 6 } }));
    assert.equal(nMusc(r), 4, `${nDias} dias`);
  }
});

test('intermediário continua com teto 4 mesmo com 6 dias e frequência 6', async () => {
  const r = await H.gerar(perfil({ nivel: 'intermediario', local: 'academia', nDias: 6, extra: { mFreq: 6 } }));
  assert.equal(nMusc(r), 4);
});

test('avançado que declara 4 treinos não é empurrado para 5', async () => {
  const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 6, extra: { mFreq: 4 } }));
  assert.equal(nMusc(r), 4);
});

test('Push só empurra, Pull só puxa, Legs só pernas/quadril; plano válido', async () => {
  const ehPush = H.run('motorEhEmpurrar'), ehPull = H.run('motorEhPuxar');
  for (const local of ['academia', 'condominio']) {
    const r = await H.gerar(p6(local));
    assert.equal(r.validacao.ok, true, JSON.stringify(r.validacao.erros));
    for (const { dia, lista, info } of sessoesMusc(r)) {
      const v = varia(info), nomes = lista.map((e) => e.nome);
      if (v === 'push') { assert.ok(nomes.some(ehPush), `${dia} push sem empurrar`); assert.ok(!nomes.some(ehPull), `${dia} push com puxar: ${nomes.join(' | ')}`); }
      if (v === 'pull') { assert.ok(nomes.some(ehPull), `${dia} pull sem puxar`); assert.ok(!nomes.some(ehPush), `${dia} pull com empurrar: ${nomes.join(' | ')}`); }
      if (v === 'legs' || v === 'lower') assert.ok(lista.every((e) => e.grupo === 'Pernas' || e.grupo === 'Costas'), `${dia} ${v}: ${lista.map((e) => e.grupo).join(',')}`);
    }
    const base = sessoesMusc(r).find((s) => varia(s.info) === 'legs');
    assert.ok(base.lista.length >= 5);
  }
});

test('Lower e Legs nunca em dias seguidos; sem exercício repetido no dia', async () => {
  const r = await H.gerar(p6('academia'));
  const ss = sessoesMusc(r);
  const baixo = ss.filter((s) => s.info.tipo === 'lower').map((s) => DIAS.indexOf(s.dia)).sort();
  for (let i = 1; i < baixo.length; i++) assert.ok(baixo[i] - baixo[i - 1] > 1, 'pernas em dias seguidos');
  for (const s of ss) assert.equal(new Set(s.lista.map((e) => e.nome)).size, s.lista.length);
});

test('split de 5: âncora e deload funcionam nas semanas 1 a 4 e 5 a 8', async () => {
  const R = p6('academia');
  // sessões de pernas podem virar full body quando a corrida da semana pede (regra antiga); as de superiores mantêm a forma
  const anc = (r) => Object.fromEntries(r.sessoes.filter((s) => s.modalidade === 'musculacao' && ['upper', 'push', 'pull'].includes(varia(s))).map((s) => [varia(s), (r.semana.muscPlan[s.dia].find((e) => e.ancora) || {}).nome]));
  const a1 = anc(await gerarSemana(H, R, 1));
  assert.equal(Object.keys(a1).length, 3);
  for (const w of [2, 3, 4]) assert.deepEqual(anc(await gerarSemana(H, R, w)), a1, 'semana ' + w);
  // por sessão (forma + ordem), não por dia da semana: o deload pode cair em outros dias quando a corrida muda
  const porSessao = (r) => { const o = {}, c = {}; r.sessoes.filter((s) => s.modalidade === 'musculacao').forEach((s) => { const k = varia(s) + '#' + (c[varia(s)] = (c[varia(s)] || 0) + 1); o[k] = r.semana.muscPlan[s.dia].map((e) => e.nome); }); return o; };
  const p3 = porSessao(await gerarSemana(H, R, 3)), p4 = porSessao(await gerarSemana(H, R, 4));
  assert.deepEqual(Object.keys(p4).sort(), Object.keys(p3).sort());
  for (const k of Object.keys(p3)) assert.deepEqual(Array.from(p4[k]), Array.from(p3[k]), k);
  for (let w = 5; w <= 8; w++) { const r = await gerarSemana(H, R, w); assert.equal(nMusc(r), 5, 'semana ' + w); assert.equal(r.validacao.ok, true, 'semana ' + w); }
});

test('split de 5 com corrida junto: musculação até 5 e plano válido', async () => {
  const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 6, extra: { cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', cUn: 'km' } }));
  assert.ok(nMusc(r) <= 5);
  assert.equal(r.validacao.ok, true, JSON.stringify(r.validacao.erros));
});

// O Longão nunca muda por causa do split de 5. Musculação no dia do Longão mudaria a corrida (tempo, "combinada", justificativa),
// então nesses perfis o avançado usa 4 sessões (teto 4).
test('Longão no mesmo dia de uma sessão apertada (6 dias de 60 min): corrida igual ao baseline e 4 sessões', async () => {
  // Integração: a corrida do motor atual mudou desde o baseline original; a referência agora é a mesma semana com teto de 4 sessões (sem split de 5).
  const base = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 6 }), { _teto4: true });
  const r = await H.gerar(perfil({ nivel: 'avancado', local: 'academia', nDias: 6 }));
  const longao = (x) => x.semana.corridaWeek.find((w) => w.type === 'Longão').totalMin;
  assert.equal(longao(r), base.semana.corridaWeek.find((w) => w.type === 'Longão').totalMin);
  for (const s of r.sessoes.filter((x) => x.modalidade === 'musculacao')) assert.ok(s.exercicios >= 4, `${s.dia}: ${s.exercicios} exercícios`);
  assert.equal(nMusc(r), 4);
});

test('corredor com 1 corrida: split de 5 fica e a corrida é só uma rodagem fora do Longão', async () => {
  const r = await H.gerar(p6('academia'));
  assert.equal(nMusc(r), 5);
  assert.ok(!r.semana.corridaWeek.some((w) => w.type === 'Longão'));
});
