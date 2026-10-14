// Personalização por IA (Gemini), empacotável como o motor. Ainda NÃO entra no motor.js nem no app:
// por enquanto só os testes carregam este módulo. Cada nome é publicado em globalThis, no mesmo padrão do motor.
/* eslint-disable */
import { IA_CONFIG } from './config.js';
import * as consentimento from './consentimento.js';
import * as contrato from './contrato.js';
import * as validador from './validador.js';
import * as refino from './refino.js';
import * as historicoCorrida from './historico-corrida.js';
import * as contratoV2 from './contrato-v2.js';
import * as validadorV2 from './validador-corrida.js';
import * as refinoV2 from './refino-v2.js';
import * as servidor from './servidor.js';
import * as aplicar from './aplicar.js';
import * as appV2 from './app-v2.js';

Object.assign(globalThis, { IA_CONFIG, ...consentimento, ...contrato, ...validador, ...refino, ...historicoCorrida, ...contratoV2, ...validadorV2, ...refinoV2, ...servidor, ...aplicar, ...appV2 });
