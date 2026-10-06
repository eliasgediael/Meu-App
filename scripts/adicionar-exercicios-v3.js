// Acrescenta ao catálogo os exercícios do pacote V3 (máquinas e peso corporal) e as mídias alternativas
// (outros ângulos de câmera do mesmo exercício). Pode rodar várias vezes: não duplica nada.
// Uso: node scripts/adicionar-exercicios-v3.js [caminho do exercises-gifs-main.zip]
// Os GIFs são da Gym visual (licença comprada pelo dono do projeto); ver docs/LICENCA-GIFS.md.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const ZIP = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'exercises-gifs-main.zip');
const CATALOGO = path.join(RAIZ, 'data', 'exercicios.json');
const GIFS = path.join(RAIZ, 'gifs');
const TMP = path.join(RAIZ, 'gifs-fonte', 'v3');
const LADO = 180; // limite de resolução pedido pela Gym visual

(async () => {
  const v3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'exercicios-v3.json'), 'utf8'));
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const porId = new Map(cat.map((e) => [e.id, e]));

  // GIFs necessários: exercícios novos + mídias alternativas
  const ids = new Set(v3.novos.map((n) => n.id));
  Object.values(v3.midias).forEach((l) => l.forEach((m) => ids.add(m.id)));
  fs.mkdirSync(TMP, { recursive: true });
  let convertidos = 0;
  for (const id of ids) {
    const webp = path.join(GIFS, id + '.webp');
    if (fs.existsSync(webp)) continue;
    const gif = path.join(TMP, id + '.gif');
    if (!fs.existsSync(gif)) {
      if (!fs.existsSync(ZIP)) throw new Error('ZIP dos GIFs não encontrado: ' + ZIP);
      const buf = execFileSync('unzip', ['-p', ZIP, 'exercises-gifs-main/assets/' + id + '.gif'], { maxBuffer: 64 * 1024 * 1024 });
      if (!buf.length) throw new Error('GIF ausente no ZIP: ' + id);
      fs.writeFileSync(gif, buf);
    }
    await sharp(gif, { animated: true }).resize(LADO, LADO, { fit: 'cover' }).webp({ quality: 70, effort: 4 }).toFile(webp);
    convertidos++;
  }

  // Exercícios novos (não sobrescreve um id que já existe)
  let novos = 0;
  for (const n of v3.novos) {
    if (porId.has(n.id)) continue;
    const reg = { ...n, origemMidia: 'Gym visual' };
    cat.push(reg); porId.set(n.id, reg); novos++;
  }
  // Mídias alternativas: ficam dentro do exercício principal; o registro do ângulo some da lista
  for (const [principal, lista] of Object.entries(v3.midias)) {
    const ex = porId.get(principal);
    if (!ex) continue;
    ex.midias = lista;
    lista.forEach((m) => { const alt = porId.get(m.id); if (alt && alt.id !== principal) { alt.oculto = true; alt.principal = principal; alt.motivoOculto = 'mídia alternativa de ' + principal; } });
  }
  fs.writeFileSync(CATALOGO, JSON.stringify(cat, null, 1));
  console.log('exercícios novos:', novos, '| GIFs convertidos:', convertidos, '| total no catálogo:', cat.length);
})().catch((e) => { console.error(e); process.exit(1); });
