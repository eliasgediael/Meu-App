// Cloud Function refinarTreino (Firebase, 2ª geração). NÃO publicada: o deploy depende de aprovação, do plano Blaze
// e da chave GEMINI_API_KEY no Secret Manager (firebase functions:secrets:set GEMINI_API_KEY).
// A chave nunca vai para o app: só esta função a lê, em tempo de execução.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { criarRefinador, ErroFuncao } = require('./src/refinar.js');
const { criarArmazemFirestore } = require('./src/armazem-firestore.js');
const { esquemaParaGoogle } = require('./src/esquema-gemini.js');

admin.initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const IA_ATIVA = defineString('IA_ATIVA', { default: 'false' });               // chave geral: 'true' para ligar
const GEMINI_MODELO = defineString('GEMINI_MODELO', { default: 'gemini-2.5-flash' });
const LIMITE_DIA_USUARIO = defineInt('IA_LIMITE_DIA_USUARIO', { default: 6 });
const LIMITE_MES_GLOBAL = defineInt('IA_LIMITE_MES_GLOBAL', { default: 3000 });

async function chamarGemini({ modelo, instrucao, texto, esquema, maxOutputTokens, temperatura }) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  const r = await ai.models.generateContent({
    model: modelo,
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    config: { systemInstruction: instrucao, responseMimeType: 'application/json', responseSchema: esquemaParaGoogle(esquema, 'openapi'), maxOutputTokens, temperature: temperatura },
  });
  return r.text;
}

// Só no emulador local (FUNCTIONS_EMULATOR=true): o pedido pode vir com simulado:true para testar o fluxo inteiro
// (login, consentimento, cotas, cache, validação) sem chamar o Gemini. A resposta simulada repete o plano do motor.
// Em produção esse campo é ignorado. O modelo 'simulado-emulador' separa o cache simulado do cache real.
const NO_EMULADOR = process.env.FUNCTIONS_EMULATOR === 'true';
async function geminiSimulado({ texto }) {
  const pedido = JSON.parse(texto);
  if(pedido.versaoContrato==='2') return JSON.stringify({ versao:'2', dias:pedido.planoMotor, corrida:pedido.corrida.dias.map(d=>({dia:d.dia,opcao:d.sessaoMotor.opcao,mobilidade:[],educativos:[],alongamentos:[],strides:0,stridesFim:0,progressao:'manter'})), motivos:['manter_plano'] });
  return JSON.stringify({ versao: '1', dias: pedido.planoMotor, motivos: ['manter_plano'] });
}

exports.refinarTreino = onCall({
  region: 'southamerica-east1',
  secrets: [GEMINI_API_KEY],
  maxInstances: 3,          // teto de custo: no máximo 3 instâncias ao mesmo tempo
  concurrency: 10,
  timeoutSeconds: 40,
  memory: '256MiB',
  enforceAppCheck: false,   // App Check no WebView do Capacitor fica para depois (ver docs/ia-gemini.md)
}, async (req) => {
  const simulado = NO_EMULADOR && req.data && req.data.simulado === true;
  const refinar = criarRefinador({
    chamarGemini: simulado ? geminiSimulado : chamarGemini,
    armazem: criarArmazemFirestore(admin.firestore()),
    config: {
      ativa: IA_ATIVA.value() === 'true',
      modelo: simulado ? 'simulado-emulador' : GEMINI_MODELO.value(),
      limiteDiaUsuario: LIMITE_DIA_USUARIO.value(),
      limiteMesGlobal: LIMITE_MES_GLOBAL.value(),
    },
  });
  try {
    const { simulado: _s, ...dados } = req.data || {};
    return await refinar(dados, req.auth);
  } catch (e) {
    if (e instanceof ErroFuncao) throw new HttpsError(e.codigo, e.message);
    console.error('[refinarTreino]', 'erro interno');
    throw new HttpsError('internal', 'falha ao personalizar');
  }
});
