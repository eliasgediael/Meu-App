// Funções de análise de plano usadas nos testes. Só leem o plano gerado e as funções do motor.
const sessoesMusc = (r) =>
  Object.entries((r.semana && r.semana.muscPlan) || {}).map(([dia, lista]) => ({
    dia,
    lista,
    info: r.sessoes.find((s) => s.dia === dia && s.modalidade === 'musculacao'),
  }));

function analisador(run) {
  const fam = run('(n)=>motorFamilia(normalizeNoAccents(n))');
  const chave = run('(n)=>motorPadraoChave(normalizeNoAccents(n))');
  const ehPush = run('motorEhEmpurrar');
  const ehPull = run('motorEhPuxar');
  const ehCore = (n) => fam(n) === 'core';
  return { fam, chave, ehPush, ehPull, ehCore };
}

// Problemas de conteúdo encontrados nas sessões de musculação de um plano (lista de textos).
function problemas(r, A) {
  const out = [];
  for (const { dia, lista, info } of sessoesMusc(r)) {
    const nomes = lista.map((e) => e.nome);
    const tipo = info && info.tipo;
    const dupNome = nomes.filter((n, i) => nomes.indexOf(n) !== i);
    if (dupNome.length) out.push(`${dia}: exercício repetido: ${dupNome.join(', ')}`);
    const porFam = {};
    nomes.forEach((n) => {
      const f = A.fam(n);
      (porFam[f] = porFam[f] || []).push(n);
    });
    Object.entries(porFam).forEach(([f, l]) => {
      if (l.length > 1) out.push(`${dia}: família "${f}" repetida: ${l.join(' + ')}`);
    });
    if (tipo === 'full' || tipo === 'upper') {
      const v = info.variante;
      if (v !== 'pull' && !nomes.some(A.ehPush)) out.push(`${dia} [${v || tipo}]: sem empurrar`);
      if (v !== 'push' && !nomes.some(A.ehPull)) out.push(`${dia} [${v || tipo}]: sem puxar`);
      if (v === 'push' && nomes.some(A.ehPull)) out.push(`${dia} [push]: exercício de puxar`);
      if (v === 'pull' && nomes.some(A.ehPush)) out.push(`${dia} [pull]: exercício de empurrar`);
    }
    if (tipo === 'full' && !nomes.some(A.ehCore)) out.push(`${dia} [full]: sem core`);
  }
  return out;
}

module.exports = { sessoesMusc, analisador, problemas };
