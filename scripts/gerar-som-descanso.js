// Gera sons/fim-descanso.wav: o aviso de "descanso acabou". O mesmo arquivo toca dentro do app (Web Audio)
// e como som da notificação local quando a tela está bloqueada, então o som é igual nos dois casos.
// Três toques de sino (dois curtos e um mais alto e longo): fácil de reconhecer na academia, curto
// (1,2 s) e sem chiado/estalo. Rodar: node scripts/gerar-som-descanso.js
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const DUR = 1.2;
const n = Math.round(RATE * DUR);
const buf = new Float32Array(n);

// [início (s), frequência (Hz), decaimento (s), volume]
const toques = [
  [0.00, 1046.5, 0.16, 0.75], // dó
  [0.20, 1046.5, 0.16, 0.75], // dó
  [0.40, 1568.0, 0.32, 0.95], // sol (mais alto e mais longo: "pronto, volta")
];
// Parciais de sino: fundamental forte, harmônicos leves para o som cortar o barulho da academia sem ser estridente.
const parciais = [[1, 1], [2, 0.35], [3, 0.12], [4.2, 0.05]];

for (const [ini, f, dec, vol] of toques) {
  const i0 = Math.round(ini * RATE);
  for (let i = i0; i < n; i++) {
    const t = (i - i0) / RATE;
    const ataque = Math.min(1, t / 0.006); // 6 ms, evita estalo
    const env = ataque * Math.exp(-t / dec);
    if (env < 1e-4 && t > 0.05) break;
    let s = 0;
    for (const [mult, amp] of parciais) s += amp * Math.sin(2 * Math.PI * f * mult * t) * Math.exp(-t * (mult - 1) * 2);
    buf[i] += vol * env * s;
  }
}
// Normaliza para -1 dBFS e fecha com fade de 30 ms.
let pico = 0;
for (const v of buf) pico = Math.max(pico, Math.abs(v));
const ganho = 0.89 / pico;
const fade = Math.round(0.03 * RATE);
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const f = i > n - fade ? (n - i) / fade : 1;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * ganho * f)) * 32767), i * 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
const dir = path.join(__dirname, '..', 'sons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'fim-descanso.wav'), Buffer.concat([h, pcm]));
console.log('sons/fim-descanso.wav', ((44 + pcm.length) / 1024).toFixed(0) + ' KB');
