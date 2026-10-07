// Executor dos testes do Forza Run (npm test).
//   node tests/run.js                 → testes em Node + testes de navegador (pulados se não houver Chrome)
//   node tests/run.js --sem-navegador → só os testes em Node (rápido)
// Cada arquivo roda num processo próprio; o resultado é a soma das linhas PASS/FAIL de cada um.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const semNavegador = process.argv.includes('--sem-navegador');

const B1_CENARIOS = ['offline-sem-conta', 'offline-com-conta-cache', 'nuvem-falha-nao-sobrescreve', 'migracao-segura', 'pendentes-flush',
  'gps-incremental-resume', 'gps-fim-backup-nuvem', 'gps-baixa-de-outro-aparelho'];
const testes = [
  ...B1_CENARIOS.map(c => ({ nome: 'dados/nuvem/GPS: ' + c, arq: 'node/legado/b1tests.js', args: [RAIZ, c] })),
  { nome: 'plano vivo e treinador (e2)', arq: 'node/legado/e2tests.js' },
  { nome: 'por quê / ajustar / check-in (e3)', arq: 'node/legado/e3tests.js' },
  { nome: 'corrida GPS ao vivo (e4)', arq: 'node/legado/e4tests.js' },
  { nome: 'aviso de fim do descanso', arq: 'node/legado/descansotest.js' },
  { nome: 'biblioteca de exercícios', arq: 'node/legado/bibtest.js' },
  { nome: 'matriz de 20 perfis (invariantes)', arq: 'node/legado/matriz.js', args: [RAIZ] },
  { nome: 'planos dourados (20 perfis)', arq: 'node/planos-dourados.test.js' },
  { nome: 'caracterização: motor', arq: 'node/caracterizacao-motor.test.js' },
  { nome: 'caracterização: treinador', arq: 'node/caracterizacao-treinador.test.js' },
  { nome: 'caracterização: musculação', arq: 'node/caracterizacao-forca.test.js' },
  { nome: 'caracterização: atividade e dados', arq: 'node/caracterizacao-atividade.test.js' },
  { nome: 'atividades separadas do plano (Bloco 3)', arq: 'node/atividades.test.js' },
];
if (!semNavegador) fs.readdirSync(path.join(__dirname, 'navegador')).filter(f => f.endsWith('.test.js')).sort()
  .forEach(f => testes.push({ nome: 'navegador: ' + f.replace('.test.js', ''), arq: 'navegador/' + f, timeout: 300000 }));

let totalPass = 0, totalFail = 0, arquivosComFalha = [];
const t0 = Date.now();
for (const t of testes) {
  const r = spawnSync(process.execPath, [path.join(__dirname, t.arq), ...(t.args || [])], { cwd: RAIZ, encoding: 'utf8', timeout: t.timeout || 180000, maxBuffer: 64 * 1024 * 1024 });
  const saida = (r.stdout || '') + (r.stderr || '');
  const pass = (saida.match(/^PASS /gm) || []).length, fail = (saida.match(/^FAIL /gm) || []).length;
  const pulou = /^SKIP /m.test(saida);
  const falhou = fail > 0 || (r.status !== 0 && !pulou) || r.error;
  totalPass += pass; totalFail += fail + (falhou && !fail ? 1 : 0);
  console.log(`${falhou ? '✗' : pulou ? '–' : '✓'} ${t.nome}: ${pass} ok${fail ? ', ' + fail + ' falha(s)' : ''}${pulou ? ' (pulado)' : ''}${r.error ? ' (' + r.error.code + ')' : ''}`);
  saida.split('\n').filter(l => /^(FAIL|SKIP|AVISO) /.test(l)).forEach(l => console.log('    ' + l));
  if (falhou) arquivosComFalha.push(t.nome);
}
console.log(`\n${totalPass} verificações ok · ${totalFail} falha(s) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (arquivosComFalha.length) console.log('Com falha: ' + arquivosComFalha.join('; '));
process.exit(totalFail ? 1 : 0);
