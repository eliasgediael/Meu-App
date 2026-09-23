// Build "estático": copia o app (arquivo único) e os assets para www/, que é o webDir do Capacitor,
// e empacota src/native-bridge.js (única parte do projeto que usa import) num bundle IIFE.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, 'treino-app.html'), path.join(out, 'index.html'));
fs.copyFileSync(path.join(root, 'icon-180.png'), path.join(out, 'icon-180.png'));
fs.copyFileSync(path.join(root, 'manifest.json'), path.join(out, 'manifest.json'));
fs.cpSync(path.join(root, 'gifs'), path.join(out, 'gifs'), { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'native-bridge.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(out, 'native-bridge.js'),
});

console.log('Build concluído em', out);
