// Gera os ícones do app a partir de brand/logo.svg (rode: node scripts/gerar-icones.js).
//  - ios/.../AppIcon-512@2x.png  1024×1024, sem transparência (o iOS arredonda sozinho)
//  - brand/icone-1024.png        cópia usada pelo GitHub Actions (que recria a pasta ios/ a cada build)
//  - icon-180.png                180×180 (ícone do PWA / tela de início)
//  - logo inline na tela de boas-vindas do treino-app.html (entre os marcadores LOGO_SVG_START/END)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const raiz = path.join(__dirname, '..');
const svgPath = path.join(raiz, 'brand', 'logo.svg');
const FUNDO = '#0A0B0A';

async function quadrado(svg, tamanho, destino){
  await sharp(svg, { density: 600 })
    .resize(tamanho, tamanho, { fit: 'contain', background: FUNDO })
    .flatten({ background: FUNDO })
    .png()
    .toFile(destino);
  console.log('gerado', path.relative(raiz, destino), tamanho + '×' + tamanho);
}

(async () => {
  if(!fs.existsSync(svgPath)){ console.error('Não achei brand/logo.svg — coloque o arquivo lá e rode de novo.'); process.exit(1); }
  const svg = fs.readFileSync(svgPath);
  const appIcon = path.join(raiz, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  fs.mkdirSync(appIcon, { recursive: true });
  await quadrado(svg, 1024, path.join(appIcon, 'AppIcon-512@2x.png'));
  await quadrado(svg, 1024, path.join(raiz, 'brand', 'icone-1024.png'));
  await quadrado(svg, 180, path.join(raiz, 'icon-180.png'));

  // Contents.json: garante que todo tamanho pedido exista (hoje o iOS só pede o de 1024).
  const contents = JSON.parse(fs.readFileSync(path.join(appIcon, 'Contents.json'), 'utf8'));
  for(const img of contents.images){
    if(!img.filename) continue;
    const alvo = path.join(appIcon, img.filename);
    if(!fs.existsSync(alvo)){
      const px = parseInt(String(img.size).split('x')[0], 10) * (parseInt(String(img.scale||'1x'), 10) || 1);
      await quadrado(svg, px, alvo);
    }
  }

  // Logo inline (64px) na tela de boas-vindas.
  const inline = svg.toString('utf8').replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const htmlPath = path.join(raiz, 'treino-app.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const re = /\/\*LOGO_SVG_START\*\/[\s\S]*?\/\*LOGO_SVG_END\*\//;
  if(!re.test(html)){ console.error('Marcadores LOGO_SVG não encontrados no treino-app.html'); process.exit(1); }
  html = html.replace(re, () => '/*LOGO_SVG_START*/' + JSON.stringify(inline) + '/*LOGO_SVG_END*/');
  fs.writeFileSync(htmlPath, html);
  console.log('logo inline atualizado em treino-app.html');
})();
