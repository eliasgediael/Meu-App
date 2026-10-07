// Motor do Forza Run: módulos empacotados pelo esbuild em motor.js (ver scripts/motor-bundle.js).
// O motor.js é carregado antes do script principal do treino-app.html; cada módulo publica seus nomes em globalThis.
// As funções usam, na hora em que são chamadas, os globais do script principal (state, DAY_ABBR, catálogo etc.).
import './motor-v2.js';
import './plano-vivo.js';
import './forca.js';
import './atividades.js';
import './contratos.js';
