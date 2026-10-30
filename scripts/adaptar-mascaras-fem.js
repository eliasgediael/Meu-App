// Adapta as máscaras musculares masculinas (ANATOMIA no treino-app.html) ao corpo feminino: em cada altura, o x de cada
// ponto é reposicionado proporcionalmente à largura do corpo naquela linha (contorno de gifs/anatomia/*.webp).
// Saída: o JSON de ANATOMIA_FEM em scripts/anatomia-fem.json. Rodar depois de gerar-anatomia.js e gerar-anatomia-fem.js.
const sharp = require('sharp'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
(async () => {
  const html = fs.readFileSync(path.join(raiz, 'treino-app.html'), 'utf8');
  const i = html.indexOf('const ANATOMIA = '), j = html.indexOf('\n', i);
  const M = JSON.parse(html.slice(i + 'const ANATOMIA = '.length, j).replace(/;\s*$/, ''));
  const contorno = async (arq) => {
    const { data, info } = await sharp(path.join(raiz, 'gifs', 'anatomia', arq)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, ext = [];
    for (let y = 0; y < H; y++) {
      let xl = -1, xr = -1;
      for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; if (data[o] < 238 || data[o + 1] < 238 || data[o + 2] < 238) { if (xl < 0) xl = x; xr = x; } }
      ext.push(xl < 0 ? null : [xl, xr]);
    }
    // preenche linhas vazias com a vizinha mais próxima e suaviza (média de 9 linhas)
    for (let y = 0; y < H; y++) if (!ext[y]) { for (let d = 1; d < H && !ext[y]; d++) ext[y] = ext[y - d] || ext[y + d] || null; }
    return ext.map((_, y) => { let a = 0, b = 0, n = 0; for (let d = -4; d <= 4; d++) { const e = ext[Math.min(H - 1, Math.max(0, y + d))]; if (e) { a += e[0]; b += e[1]; n++; } } return [a / n, b / n]; });
  };
  const F = {};
  for (const lado of ['frente', 'costas']) {
    const m = await contorno(lado + '.webp'), f = await contorno(lado + '-fem.webp');
    const mapa = (x, y) => { const yy = Math.min(m.length - 1, Math.max(0, Math.round(y))); const [ml, mr] = m[yy], [fl, fr] = f[yy]; return fl + (x - ml) * (fr - fl) / (mr - ml); };
    const meio = (m[540][0] + m[540][1]) / 2, meioF = (f[540][0] + f[540][1]) / 2;
    const conv = (obj) => Object.fromEntries(Object.entries(obj).map(([id, pts]) => [id, pts.map(([x, y]) => [+mapa(x, y).toFixed(1), y])]));
    // eixo: o ponto médio do corpo feminino na altura do tronco (as máscaras de "lados" são espelhadas em torno dele)
    const eixoF = +((meioF + meio * 0 + (M[lado].eixo - meio) * 0)).toFixed(1);
    const eixoMapeado = +((() => { let s = 0, n = 0; for (let y = 300; y <= 700; y += 10) { s += (f[y][0] + f[y][1]) / 2; n++; } return s / n; })()).toFixed(1);
    F[lado] = { eixo: eixoMapeado, lados: conv(M[lado].lados), centro: conv(M[lado].centro) };
    void eixoF;
  }
  fs.writeFileSync(path.join(__dirname, 'anatomia-fem.json'), JSON.stringify(F));
  console.log('scripts/anatomia-fem.json', JSON.stringify(F).length, 'bytes; eixos', F.frente.eixo, F.costas.eixo, '(masculino', M.frente.eixo, M.costas.eixo + ')');
})();
