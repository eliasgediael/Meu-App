// Testes de musculação vindos da pasta FORZA RUN (etapas 1 a 6, validador de conteúdo, bugs, propriedade), em tests/musculacao/.
// Usam o node:test; este arquivo os executa e converte cada resultado em linha PASS/FAIL para o executor do projeto.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const pasta = path.join(__dirname, '..', 'musculacao');
const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith('.test.js')).map(f => path.join(pasta, f));
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...arquivos], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
const saida = (r.stdout || '') + (r.stderr || '');
let n = 0;
for (const l of saida.split('\n')) {
  const m = /^(not ok|ok) \d+ - (.*)$/.exec(l);
  if (!m) continue;
  n++;
  console.log((m[1] === 'ok' ? 'PASS ' : 'FAIL ') + m[2]);
}
if (!n) { console.log('FAIL nenhum teste de musculação executou: ' + saida.slice(0, 300)); }
process.exit(process.exitCode || 0);
