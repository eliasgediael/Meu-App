// Snapshots de caracterização: gravam o comportamento ATUAL (não julgam se está certo).
// - Normal: compara com tests/snapshots/<nome>.json e falha se mudou.
// - ATUALIZAR_SNAPSHOTS=1 (npm run snapshots:atualizar): regrava a partir do código atual.
// - SNAPSHOT_SAIDA=<pasta> (usado por npm run comparar): grava o resultado atual em outra pasta, sem comparar.
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '..', 'snapshots');
const ATUALIZAR = process.env.ATUALIZAR_SNAPSHOTS === '1';
const SAIDA = process.env.SNAPSHOT_SAIDA || null;

// Ids gerados (aleatórios/horário) e carimbos de tempo não fazem parte do comportamento.
const CHAVES_VOLATEIS = new Set(['id', 'em', 'atualizadoEm', 'updatedAt', 'finishedAt', 'startedAt', 'corrigidaEm', 'geradoEm', 'calculadoEm']);
function limpar(v) {
  return JSON.parse(JSON.stringify(v === undefined ? null : v, (k, x) => (CHAVES_VOLATEIS.has(k) ? undefined : x)));
}
function texto(v) { return JSON.stringify(limpar(v), null, 1) + '\n'; }

function conferir(nome, valor) {
  const atual = texto(valor);
  if (SAIDA) {
    fs.mkdirSync(SAIDA, { recursive: true });
    fs.writeFileSync(path.join(SAIDA, nome + '.json'), atual);
    console.log('PASS ' + nome + ' (gravado para comparação)');
    return true;
  }
  const f = path.join(DIR, nome + '.json');
  if (ATUALIZAR || !fs.existsSync(f)) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(f, atual);
    console.log('PASS ' + nome + ' (snapshot gravado)');
    return true;
  }
  const igual = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') === atual;
  console.log((igual ? 'PASS ' : 'FAIL ') + 'snapshot ' + nome + (igual ? '' : ' mudou — rode "npm run comparar" para ver a diferença'));
  if (!igual) process.exitCode = 1;
  return igual;
}
module.exports = { conferir, limpar, DIR };
