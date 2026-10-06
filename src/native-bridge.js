// Ponte nativa pro app rodando dentro do Capacitor (iOS via Sideloadly). Este arquivo é empacotado pelo
// esbuild em www/native-bridge.js e só é incluído no build do app nativo. No app web (PWA), o
// <script src="native-bridge.js"> do treino-app.html dá 404 silenciosamente e window.NativeBridge nunca
// existe — então todo o código de GPS/voz do app continua caindo nas APIs web originais sem mudança.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { KeepAwake } from '@capacitor-community/keep-awake';
// Este plugin não publica um wrapper JS pronto — é registrado direto (é o padrão documentado dele).
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
// Plugin próprio (plugins/aviso-descanso): abaixa a música de outros apps, toca o sinal e fala o próximo passo.
const AvisoDescanso = registerPlugin('AvisoDescanso');
async function avisoDescanso(opcoes) {
  try { await AvisoDescanso.tocar(opcoes || {}); return true; } catch (e) { return false; }
}

// Plugin próprio (mesmo pacote): compartilhar, salvar nas Fotos ou copiar a arte PNG sem perder a transparência.
const ImagemCompartilhar = registerPlugin('ImagemCompartilhar');
// acao: 'compartilhar' | 'salvar' | 'copiar'. Retorna { ok, erro }.
async function imagemArte(acao, base64) {
  try { await ImagemCompartilhar[acao]({ base64 }); return { ok: true }; } catch (e) { return { ok: false, erro: (e && e.message) || String(e) }; }
}

const isNative = () => Capacitor.isNativePlatform();

// BackgroundGeolocation entrega {latitude, longitude, accuracy, time, ...} (sem o wrapper .coords) — a
// gente adapta aqui pro mesmo formato do GeolocationPosition da Web API, que é o que gpsOnPosition (em
// treino-app.html) já espera. Assim a lógica de cálculo de distância/pace não muda nem sabe que trocou.
// Altitude, velocidade e direção também passam quando o GPS nativo entrega (senão ficam null, como na
// Web API) — antes a altitude era descartada aqui e a elevação nunca aparecia no app do iPhone.
function toWebLikePosition(loc) {
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  return {
    coords: {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      altitude: num(loc.altitude),
      altitudeAccuracy: num(loc.altitudeAccuracy),
      speed: num(loc.speed),
      heading: num(loc.bearing),
    },
    timestamp: loc.time || Date.now(),
  };
}

// O plugin avisa permissão negada com { code: 'NOT_AUTHORIZED' }; o app espera o formato da Web API
// (err.code === err.PERMISSION_DENIED), senão toda negação virava "indisponível".
function toWebLikeError(error) {
  const negada = error && error.code === 'NOT_AUTHORIZED';
  return { code: negada ? 1 : 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: (error && error.message) || '' };
}

async function watchPosition(onPosition, onError) {
  try {
    await Geolocation.requestPermissions({ permissions: ['location'] });
  } catch (e) { /* segue e deixa o addWatcher pedir de novo se precisar */ }
  const watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Forza Run está rastreando sua corrida',
      backgroundMessage: 'Toque para voltar ao treino.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (location, error) => {
      if (error) { onError(toWebLikeError(error)); return; }
      if (location) onPosition(toWebLikePosition(location));
    }
  );
  return watcherId;
}

function clearWatch(watcherId) {
  if (watcherId == null) return;
  BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
}

async function requestWakeLock() {
  try { await KeepAwake.keepAwake(); } catch (e) {}
}
async function releaseWakeLock() {
  try { await KeepAwake.allowSleep(); } catch (e) {}
}

let preferredVoiceIndex = null;
async function preferredPortugueseVoice() {
  if (preferredVoiceIndex !== null) return preferredVoiceIndex;
  try {
    const { voices = [] } = await TextToSpeech.getSupportedVoices();
    const isPt = (v) => /^pt([-_]|$)/i.test(v.lang || '');
    const female = /female|feminina|francisca|luciana|maria|joana|catarina|fernanda|helena|camila|victoria/i;
    let idx = voices.findIndex((v) => isPt(v) && female.test(v.name || ''));
    if (idx < 0) idx = voices.findIndex((v) => /^pt[-_]BR$/i.test(v.lang || ''));
    if (idx < 0) idx = voices.findIndex(isPt);
    preferredVoiceIndex = idx >= 0 ? idx : -1;
  } catch (e) { preferredVoiceIndex = -1; }
  return preferredVoiceIndex;
}
// Vozes em português instaladas no aparelho (a lista muda de iPhone para iPhone).
async function listarVozesPt() {
  try {
    const { voices = [] } = await TextToSpeech.getSupportedVoices();
    return voices.map((v, i) => ({ index: i, nome: v.name || ('Voz ' + (i + 1)), lang: v.lang || '' })).filter((v) => /^pt([-_]|$)/i.test(v.lang));
  } catch (e) { return []; }
}
// nomeVoz: voz escolhida em Preferências; sem escolha (ou voz não encontrada) usa a feminina automática.
async function speak(text, nomeVoz) {
  try {
    await TextToSpeech.stop();
    let voice = -1;
    if (nomeVoz) { const v = (await listarVozesPt()).find((x) => x.nome === nomeVoz); if (v) voice = v.index; }
    if (voice < 0) voice = await preferredPortugueseVoice();
    await TextToSpeech.speak({ text, lang: 'pt-BR', rate: 0.96, pitch: 1.04, category: 'ambient', ...(voice >= 0 ? { voice } : {}) });
  } catch (e) {}
}

async function vibrate() {
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
}

// Fim do descanso: vibração forte e bem marcada (notificação de sucesso + dois toques pesados), diferente
// da vibração leve dos toques comuns do app.
async function vibrarFimDescanso() {
  try {
    await Haptics.notification({ type: NotificationType.Success });
    setTimeout(() => { Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); }, 350);
    setTimeout(() => { Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); }, 600);
  } catch (e) {}
}

// Aviso de fim do descanso com a tela bloqueada / app em segundo plano: o JavaScript do app fica parado
// pelo iOS nesse estado, então quem toca o som é uma notificação local agendada para a hora exata em que
// o descanso acaba. O app agenda ao sair da tela e cancela ao voltar (com o app aberto, quem toca é o app).
const ID_AVISO_DESCANSO = 4201;
async function permissaoAvisos() {
  try {
    const st = await LocalNotifications.checkPermissions();
    if (st.display === 'granted') return true;
    if (st.display === 'denied') return false;
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  } catch (e) { return false; }
}
async function agendarAvisoDescanso(quandoMs) {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID_AVISO_DESCANSO }] }).catch(() => {});
    if (!(quandoMs > Date.now() + 500)) return false;
    const st = await LocalNotifications.checkPermissions();
    if (st.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: ID_AVISO_DESCANSO,
        title: 'Descanso acabou',
        body: 'Hora da próxima série.',
        sound: 'fim-descanso.wav',
        schedule: { at: new Date(quandoMs), allowWhileIdle: true },
      }],
    });
    return true;
  } catch (e) { return false; }
}
async function cancelarAvisoDescanso() {
  try { await LocalNotifications.cancel({ notifications: [{ id: ID_AVISO_DESCANSO }] }); } catch (e) {}
  try { await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: ID_AVISO_DESCANSO, title: '', body: '' }] }); } catch (e) {}
}

window.NativeBridge = { isNative, watchPosition, clearWatch, requestWakeLock, releaseWakeLock, speak, listarVozesPt, vibrate,
  vibrarFimDescanso, avisoDescanso, imagemArte, permissaoAvisos, agendarAvisoDescanso, cancelarAvisoDescanso };
