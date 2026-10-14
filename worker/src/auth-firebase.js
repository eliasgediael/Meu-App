// Conferência do token de login do Firebase (ID token) dentro do Worker, sem Admin SDK.
// Segue as regras da documentação do Firebase para bibliotecas JWT de terceiros:
//   assinatura RS256 com as chaves públicas do securetoken@system.gserviceaccount.com (escolhidas pelo "kid"),
//   iss = https://securetoken.google.com/<projeto>, aud = <projeto>, exp no futuro, iat e auth_time no passado,
//   sub não vazio com até 128 caracteres.
// Além disso: login anônimo é recusado. Limitação conhecida: token revogado continua valendo até expirar (≤ 1 h),
// porque checar revogação exige o Admin SDK.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_FIREBASE = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const TOLERANCIA_SEG = 60;
const TAMANHO_MAX_TOKEN = 4096;

class ErroAuth extends Error {
  constructor(motivo) { super(motivo); this.motivo = motivo; }
}

// Uma cópia por isolate: a jose guarda as chaves em cache e só busca de novo quando aparece um "kid" novo.
let jwksRemoto = null;
function chavesFirebase() {
  if (!jwksRemoto) jwksRemoto = createRemoteJWKSet(new URL(JWKS_FIREBASE), { cacheMaxAge: 6 * 3600 * 1000, cooldownDuration: 30 * 1000, timeoutDuration: 5000 });
  return jwksRemoto;
}

// opcoes: { projectId, chaves? (para testes: createLocalJWKSet), agora? () → ms }
function criarVerificadorFirebase(opcoes) {
  const projectId = opcoes && opcoes.projectId;
  if (!projectId || !/^[a-z0-9-]{4,40}$/.test(projectId)) throw new Error('FIREBASE_PROJECT_ID inválido');
  const agora = (opcoes && opcoes.agora) || (() => Date.now());
  const chaves = (opcoes && opcoes.chaves) || chavesFirebase();

  return async function verificarToken(cabecalhoAuthorization) {
    const m = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(cabecalhoAuthorization || '');
    if (!m || m[1].length > TAMANHO_MAX_TOKEN) throw new ErroAuth('token ausente ou malformado');
    let payload;
    try {
      ({ payload } = await jwtVerify(m[1], chaves, {
        algorithms: ['RS256'],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
        clockTolerance: TOLERANCIA_SEG,
        currentDate: new Date(agora()),
      }));
    } catch (e) {
      // Só o tipo do erro (ex.: JWTExpired, JWSSignatureVerificationFailed): nunca o token.
      throw new ErroAuth('token inválido: ' + ((e && e.code) || (e && e.name) || 'erro'));
    }
    const agoraSeg = agora() / 1000;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new ErroAuth('token inválido: sub');
    if (typeof payload.iat !== 'number' || payload.iat > agoraSeg + TOLERANCIA_SEG) throw new ErroAuth('token inválido: iat');
    if (typeof payload.auth_time !== 'number' || payload.auth_time > agoraSeg + TOLERANCIA_SEG) throw new ErroAuth('token inválido: auth_time');
    const provedor = payload.firebase && payload.firebase.sign_in_provider;
    if (typeof provedor !== 'string' || !provedor) throw new ErroAuth('token inválido: provedor');
    if (provedor === 'anonymous') throw new ErroAuth('login anônimo não permitido');
    // Mesmo formato que o refinar.js espera de req.auth no Firebase.
    return { uid: payload.sub, token: { firebase: { sign_in_provider: provedor } } };
  };
}

export { criarVerificadorFirebase, ErroAuth, JWKS_FIREBASE };
