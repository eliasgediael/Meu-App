// Comparação antes/depois: roda os testes de snapshot gravando o resultado ATUAL numa pasta temporária e compara
// com os snapshots aprovados em tests/snapshots. Mostra, por perfil/snapshot, exatamente o que mudou.
// Uso: npm run comparar            (todos os snapshots)
//      npm run comparar -- plano   (só os que começam com "plano")
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const RAIZ = path.resolve(__dirname, '..');
const APROVADOS = path.join(__dirname, 'snapshots');
const filtro = process.argv[2] || '';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forza-comparar-'));
const TESTES_SNAPSHOT = fs.readdirSync(path.join(__dirname, 'node')).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, 'node', f));
for (const t of TESTES_SNAPSHOT) spawnSync(process.execPath, [t], { cwd: RAIZ, env: { ...process.env, SNAPSHOT_SAIDA: tmp }, encoding: 'utf8' });

function diff(a, b, caminho, out) {
  if (out.length > 40) return;
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) diff(a[k], b[k], caminho + (Array.isArray(a) ? '[' + k + ']' : '.' + k), out);
    return;
  }
  const curto = (v) => { const s = JSON.stringify(v); return s === undefined ? '(ausente)' : s.length > 90 ? s.slice(0, 87) + '...' : s; };
  out.push(`${caminho || '(raiz)'}: ${curto(a)}  →  ${curto(b)}`);
}

const nomes = new Set([...fs.readdirSync(APROVADOS), ...fs.readdirSync(tmp)].filter(f => f.endsWith('.json') && f.startsWith(filtro)));
let iguais = 0, diferentes = 0, novos = 0, sumiram = 0;
for (const f of [...nomes].sort()) {
  const fa = path.join(APROVADOS, f), fb = path.join(tmp, f);
  if (!fs.existsSync(fa)) { novos++; console.log(`+ ${f}: novo (ainda não aprovado)`); continue; }
  if (!fs.existsSync(fb)) { sumiram++; console.log(`- ${f}: não foi gerado nesta execução`); continue; }
  const a = JSON.parse(fs.readFileSync(fa, 'utf8')), b = JSON.parse(fs.readFileSync(fb, 'utf8'));
  const out = []; diff(a, b, '', out);
  if (!out.length) { iguais++; continue; }
  diferentes++;
  console.log(`\n≠ ${f}${a.perfil ? ' — ' + a.perfil : ''}`);
  out.forEach(l => console.log('    ' + l));
}
console.log(`\nResumo: ${iguais} iguais · ${diferentes} diferentes · ${novos} novos · ${sumiram} não gerados`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(diferentes || sumiram ? 1 : 0);
