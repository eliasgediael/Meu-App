// Build "estático": copia o app (arquivo único) e os assets para www/, que é o webDir do Capacitor,
// e empacota src/native-bridge.js e o motor (src/motor/) em bundles IIFE.
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
fs.cpSync(path.join(root, 'data'), path.join(out, 'data'), { recursive: true });
// Som do fim do descanso: em sons/ para o app e também na raiz do www para a notificação local do iOS achar pelo nome (fim-descanso.wav).
fs.cpSync(path.join(root, 'sons'), path.join(out, 'sons'), { recursive: true });
fs.copyFileSync(path.join(root, 'sons', 'fim-descanso.wav'), path.join(out, 'fim-descanso.wav'));

esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'native-bridge.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(out, 'native-bridge.js'),
});

// Motor (src/motor/) empacotado em motor.js, carregado antes do script principal.
require('./motor-bundle.js').gravarMotor(path.join(out, 'motor.js'));

console.log('Build concluído em', out);
