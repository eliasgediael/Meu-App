// Harness de navegador: servidor estático + navegador Chromium headless (tamanho de iPhone) com perfil limpo,
// relógio controlável e os dados semeados de tests/fixtures/semana3.json. Prefere Edge no Windows e aceita
// CHROME_PATH para outro executável; sem navegador disponível, os testes são pulados, não falham.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.css': 'text/css' };
const CHROME = process.env.CHROME_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const RELOGIO = `(()=>{const R=Date;const k='__relogioOff';let off=0;try{off=+(localStorage.getItem(k)||0)}catch(e){}
class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off)} static now(){return R.now()+off}}
D.UTC=R.UTC;D.parse=R.parse;window.Date=D;
window.__setAgora=(ms)=>{off=ms-R.now();try{localStorage.setItem(k,off)}catch(e){}};
window.__avancar=(ms)=>{off+=ms;try{localStorage.setItem(k,off)}catch(e){}};})();`;
const espera = (ms) => new Promise(r => setTimeout(r, ms));

function servidor() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') u = '/treino-app.html';
      if (u === '/native-bridge.js') { res.writeHead(404); return res.end(); }
      if (u === '/motor.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return res.end(require(path.join(ROOT, 'scripts', 'motor-bundle.js')).codigoMotor()); }
      if (u.startsWith('/sons/') || u === '/fim-descanso.wav') u = '/sons/fim-descanso.wav';
      const f = path.join(ROOT, u);
      fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
    });
    s.listen(0, () => ok(s));
  });
}

// Abre o app com os dados da fixture. Devolve { page, fechar, erros }.
async function abrirApp(opts = {}) {
  if (!CHROME) return null;
  const puppeteer = require('puppeteer-core');
  const s = await servidor();
  const porta = s.address().port;
  const perfilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forza-chrome-'));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: perfilDir,
      // No executor isolado, o perfil normal do Chrome não é gravável. Redirecionar
      // LOCALAPPDATA/TEMP também mantém Crashpad e caches dentro do perfil descartável.
      env: { ...process.env, LOCALAPPDATA: perfilDir, TEMP: perfilDir, TMP: perfilDir },
      timeout: 30000,
      args: ['--no-first-run', '--disable-breakpad', '--disable-crash-reporter', '--hide-scrollbars', '--lang=pt-BR', '--autoplay-policy=no-user-gesture-required'] });
  } catch (e) {
    s.close();
    try { fs.rmSync(perfilDir, { recursive: true, force: true }); } catch (_) { }
    return { indisponivel: `Chrome encontrado, mas não pôde iniciar: ${e.message}` };
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  page.on('pageerror', e => erros.push(String(e.stack || e.message || e).split('\n').slice(0, 3).join(' / ')));
  await page.evaluateOnNewDocument(RELOGIO);
  const url = `http://localhost:${porta}/`;
  // O app mantém conexões/recursos em segundo plano; esperar networkidle2 torna
  // o teste dependente da rede e pode expirar mesmo com o DOM já utilizável.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.storage && typeof window.gpsDbPut === 'function');
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', opts.fixture || 'semana3.json'), 'utf8'));
  await page.evaluate(async (fx) => {
    __setAgora(new Date(fx.agora).getTime());
    for (const [k, v] of Object.entries(fx.chaves)) await window.storage.set(k, v, false);
    for (const r of fx.corridas) await gpsDbPut(r);
  }, fx);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof state !== 'undefined' && state && typeof render === 'function');
  await espera(1500);
  // Erros da inicialização (antes do teste começar) ficam separados: hoje há uma corrida conhecida na abertura
  // (render antes de state.treinos carregar, ver VALIDACAO-PLANO-MESTRE). O teste decide como tratá-los.
  const errosInicio = erros.splice(0);
  const fechar = async () => { await browser.close(); s.close(); try { fs.rmSync(perfilDir, { recursive: true, force: true }); } catch (e) { } };
  return { page, fechar, erros, errosInicio, url };
}
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
module.exports = { abrirApp, ok, espera, CHROME };
