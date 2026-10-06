// Regrava os snapshots a partir do código atual. Só use DEPOIS de aprovar a mudança mostrada por "npm run comparar".
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
for (const f of fs.readdirSync(path.join(__dirname, 'node')).filter(f => f.endsWith('.test.js'))) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'node', f)], { cwd: RAIZ, env: { ...process.env, ATUALIZAR_SNAPSHOTS: '1' }, encoding: 'utf8' });
  console.log(`${f}: ${(r.stdout.match(/snapshot gravado/g) || []).length} snapshot(s) regravado(s)`);
}
