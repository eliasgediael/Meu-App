// Gera as figuras do mapa muscular a partir de brand/anatomy-body-v1.png (direção visual aprovada):
// tira o fundo escuro (vira branco, para o tema claro), separa frente e costas e salva em WebP leve.
// Os músculos são destacados por máscaras SVG desenhadas por cima (ANATOMIA_REGIOES no treino-app.html),
// então a imagem em si nunca muda de cor. Rodar: node scripts/gerar-anatomia.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const raiz = path.join(__dirname, '..');
const origem = path.join(raiz, 'brand', 'anatomy-body-v1.png');
const destino = path.join(raiz, 'gifs', 'anatomia');
const LIMIAR = 238;      // fundo = região ligada às bordas que fica cada vez mais clara até o halo em volta do corpo
const TOLERANCIA = 3;    // o preenchimento só sobe de brilho (ruído de até 3 níveis); depois do pico do halo começa o corpo e ele para
const LARGURA_SAIDA = 360;

(async () => {
  const img = sharp(origem).removeAlpha();
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.299 * data[i * C] + 0.587 * data[i * C + 1] + 0.114 * data[i * C + 2];
  // preenchimento a partir das bordas
  const fundo = new Uint8Array(W * H);
  const fila = new Int32Array(W * H); let ini = 0, fim = 0;
  const empurra = (i, de) => { if (!fundo[i] && lum[i] < LIMIAR && (de < 0 || lum[i] >= lum[de] - TOLERANCIA)) { fundo[i] = 1; fila[fim++] = i; } };
  for (let x = 0; x < W; x++) { empurra(x, -1); empurra((H - 1) * W + x, -1); }
  for (let y = 0; y < H; y++) { empurra(y * W, -1); empurra(y * W + W - 1, -1); }
  while (ini < fim) {
    const i = fila[ini++], x = i % W, y = (i / W) | 0;
    if (x > 0) empurra(i - 1, i); if (x < W - 1) empurra(i + 1, i);
    if (y > 0) empurra(i - W, i); if (y < H - 1) empurra(i + W, i);
  }
  // distância (em px) até o fundo, para suavizar a borda: fundo branco, transição de 3 px
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
  for (const [nome, left] of [['frente', 0], ['costas', metade]]) {
    const buf = await base.clone().extract({ left, top: 0, width: metade, height: H }).png().toBuffer();
    await sharp(buf).resize(LARGURA_SAIDA).webp({ quality: 82 }).toFile(path.join(destino, nome + '.webp'));
    console.log('gifs/anatomia/' + nome + '.webp', (fs.statSync(path.join(destino, nome + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
})();
