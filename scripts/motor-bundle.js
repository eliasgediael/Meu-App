// Empacota src/motor/ num único script (motor.js), no mesmo padrão da ponte nativa. Usado pelo build (www/motor.js),
// pelo harness de testes no Node e pelo servidor dos testes de navegador.
const path = require('path');
const esbuild = require('esbuild');
const ENTRADA = path.join(__dirname, '..', 'src', 'motor', 'index.js');
function codigoMotor() {
  const r = esbuild.buildSync({ entryPoints: [ENTRADA], bundle: true, format: 'iife', write: false, charset: 'utf8', legalComments: 'none' });
  return r.outputFiles[0].text;
}
function gravarMotor(destino) {
  esbuild.buildSync({ entryPoints: [ENTRADA], bundle: true, format: 'iife', outfile: destino, charset: 'utf8', legalComments: 'none' });
}
module.exports = { codigoMotor, gravarMotor, ENTRADA };
