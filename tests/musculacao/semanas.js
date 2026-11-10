// Gera a semana N do plano como o app faz: semana 1 sem alvo; semanas 2+ com a linha da trajetória da semana 1.
async function gerarSemana(H, R, w) {
  const r1 = await H.gerar(R);
  if (w === 1) return r1;
  return H.gerar(R, { alvoSemana: r1.trajetoria[w - 1] });
}
const resumoMusc = (r) => Object.fromEntries(Object.entries(r.semana.muscPlan || {}).map(([d, l]) => [d, l.map((e) => ({ nome: e.nome, papel: e.papel, series: parseInt(e.series, 10), rpe: e.rpe, reps: e.reps }))]));
module.exports = { gerarSemana, resumoMusc };
