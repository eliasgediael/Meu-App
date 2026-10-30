// Gera as figuras FEMININAS do mapa muscular a partir de brand/anatomy-body-fem-v1.png (fundo preto liso):
// o fundo preto vira branco, separa frente e costas e salva em WebP no mesmo tamanho da figura masculina (360×1080 por vista).
// As máscaras dos músculos são ANATOMIA_FEM no treino-app.html. Rodar: node scripts/gerar-anatomia-fem.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const raiz = path.join(__dirname, '..');
const origem = path.join(raiz, 'brand', 'anatomy-body-fem-v1.png');
const destino = path.join(raiz, 'gifs', 'anatomia');
const LIMIAR = 30;       // fundo = região preta ligada às bordas
const LARGURA_SAIDA = 360;

(async () => {
  const { data, info } = await sharp(origem).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.299 * data[i * C] + 0.587 * data[i * C + 1] + 0.114 * data[i * C + 2];
  const fundo = new Uint8Array(W * H);
  const fila = new Int32Array(W * H); let ini = 0, fim = 0;
  const empurra = (i) => { if (!fundo[i] && lum[i] < LIMIAR) { fundo[i] = 1; fila[fim++] = i; } };
  for (let x = 0; x < W; x++) { empurra(x); empurra((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { empurra(y * W); empurra(y * W + W - 1); }
  while (ini < fim) {
    const i = fila[ini++], x = i % W, y = (i / W) | 0;
    if (x > 0) empurra(i - 1); if (x < W - 1) empurra(i + 1);
    if (y > 0) empurra(i - W); if (y < H - 1) empurra(i + W);
  }
  // borda suave: fundo branco, transição de 3 px (o contorno escuro do desenho some junto com o fundo)
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let perto = 0;
    if (!fundo[i]) { for (let d = 1; d <= 3 && !perto; d++) { if ((x >= d && fundo[i - d]) || (x < W - d && fundo[i + d]) || (y >= d && fundo[i - d * W]) || (y < H - d && fundo[i + d * W])) perto = d; } }
    const t = fundo[i] ? 1 : perto ? (4 - perto) / 4 : 0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(data[i * C + c] * (1 - t) + 255 * t);
  }
  fs.mkdirSync(destino, { recursive: true });
  const base = sharp(out, { raw: { width: W, height: H, channels: 3 } });
  const metade = W / 2;
  for (const [nome, left] of [['frente-fem', 0], ['costas-fem', metade]]) {
    const buf = await base.clone().extract({ left, top: 0, width: metade, height: H }).png().toBuffer();
    await sharp(buf).resize(LARGURA_SAIDA).webp({ quality: 82 }).toFile(path.join(destino, nome + '.webp'));
    console.log('gifs/anatomia/' + nome + '.webp', (fs.statSync(path.join(destino, nome + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
})();
