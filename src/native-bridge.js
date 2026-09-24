// Ponte nativa pro app rodando dentro do Capacitor (iOS via Sideloadly). Este arquivo é empacotado pelo
// esbuild em www/native-bridge.js e só é incluído no build do app nativo. No app web (PWA), o
// <script src="native-bridge.js"> do treino-app.html dá 404 silenciosamente e window.NativeBridge nunca
// existe — então todo o código de GPS/voz do app continua caindo nas APIs web originais sem mudança.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { KeepAwake } from '@capacitor-community/keep-awake';
// Este plugin não publica um wrapper JS pronto — é registrado direto (é o padrão documentado dele).
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

const isNative = () => Capacitor.isNativePlatform();

// BackgroundGeolocation entrega {latitude, longitude, accuracy, time, ...} (sem o wrapper .coords) — a
// gente adapta aqui pro mesmo formato do GeolocationPosition da Web API, que é o que gpsOnPosition (em
// treino-app.html) já espera. Assim a lógica de cálculo de distância/pace não muda nem sabe que trocou.
function toWebLikePosition(loc) {
  return {
    coords: {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
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

async function speak(text) {
  try {
    await TextToSpeech.stop();
    await TextToSpeech.speak({ text, lang: 'pt-BR', rate: 1.0, category: 'ambient' });
  } catch (e) {}
}

async function vibrate() {
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
}

window.NativeBridge = { isNative, watchPosition, clearWatch, requestWakeLock, releaseWakeLock, speak, vibrate };
