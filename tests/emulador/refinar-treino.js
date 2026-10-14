// Teste de integração da função refinarTreino no Firebase Emulator Suite (Auth + Firestore + Functions).
// Usa só perfis fictícios (tests/harness/perfis.js) e um usuário criado no emulador de Auth.
//
//   node tests/emulador/refinar-treino.js            → modo simulado: a função NÃO chama o Gemini
//   node tests/emulador/refinar-treino.js --real     → uma chamada real ao Gemini (usa functions/.secret.local)
//   opções: --perfil 08  (número do perfil fictício)
//
// Antes: npx firebase emulators:start   (em outro terminal, na raiz do projeto)
// Só fala com 127.0.0.1: se os três emuladores não estiverem no ar, para sem enviar nada.
// O harness troca fetch e URL globais por dublês do navegador: as requisições usam node:http direto.
const http = require('http');
const { carregarAppComIA, prepararPerfil } = require('../harness/ia.js');

const PROJETO = 'treino-app-5a07f';
const REGIAO = 'southamerica-east1';
const HUB = 'http://127.0.0.1:4400';
const args = process.argv.slice(2);
const REAL = args.includes('--real');
const PERFIL = (args[args.indexOf('--perfil') + 1] && args.includes('--perfil')) ? args[args.indexOf('--perfil') + 1] : '08';

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALHA ') + msg); if (!cond) falhas++; };

function json(url, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: opcoes.method || 'GET', headers: opcoes.headers || {} }, (r) => {
      let t = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { t += c; });
      r.on('end', () => { try { resolve({ status: r.statusCode, corpo: JSON.parse(t) }); } catch (e) { resolve({ status: r.statusCode, corpo: t }); } });
    });
    req.on('error', reject);
    if (opcoes.body) req.write(opcoes.body);
    req.end();
  });
}

async function conferirEmuladores() {
  let lista;
  try { lista = (await json(HUB + '/emulators')).corpo; } catch (e) { lista = null; }
  const faltam = ['auth', 'firestore', 'functions'].filter(n => !lista || !lista[n]);
  if (faltam.length) {
    console.error('Emuladores fora do ar: ' + faltam.join(', ') + '. Rode "npx firebase emulators:start" na raiz do projeto.');
    process.exit(2);
  }
  const fora = Object.values(lista).filter(e => e.host !== '127.0.0.1' && e.host !== 'localhost');
  if (fora.length) { console.error('Emulador fora de 127.0.0.1: parado por segurança.'); process.exit(2); }
  return lista;
}

async function criarUsuarioFicticio(auth) {
  const base = `http://${auth.host}:${auth.port}/identitytoolkit.googleapis.com/v1`;
  const email = `atleta.ficticio.${Date.now()}@exemplo.test`;
  const r = await json(base + '/accounts:signUp?key=chave-falsa-emulador', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-ficticia-123', returnSecureToken: true }),
  });
  if (!r.corpo || !r.corpo.idToken) throw new Error('emulador de Auth não devolveu token: ' + JSON.stringify(r.corpo));
  return { uid: r.corpo.localId, idToken: r.corpo.idToken };
}

async function chamarFuncao(fn, dados, idToken) {
  const url = `http://${fn.host}:${fn.port}/${PROJETO}/${REGIAO}/refinarTreino`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = 'Bearer ' + idToken;
  const r = await json(url, { method: 'POST', headers, body: JSON.stringify({ data: dados }) });
  return r.corpo;
}

async function lerDocFirestore(fs, caminho) {
  const url = `http://${fs.host}:${fs.port}/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}`;
  return json(url, { headers: { Authorization: 'Bearer owner' } });
}

(async () => {
  console.log(`refinarTreino no emulador — modo ${REAL ? 'REAL (chama o Gemini)' : 'simulado (sem Gemini)'} — perfil fictício ${PERFIL}`);
  const emu = await conferirEmuladores();
  ok(true, `emuladores no ar: auth ${emu.auth.port}, firestore ${emu.firestore.port}, functions ${emu.functions.port}`);

  // App em memória (harness), perfil fictício, plano do motor e pedido minimizado.
  const T = await carregarAppComIA();
  const p = await prepararPerfil(T, PERFIL);
  const semanaMotor = T.gerarPlanoSemanal(p, {}).semana;
  T.IA_CONFIG.ativa = true;   // só nesta cópia em memória; src/ia/config.js continua desligado
  T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });
  const ctx = T.iaContextoDoMotor(p, {}, semanaMotor);
  ok(ctx.ok, 'contexto do motor montado');
  const pedido = T.iaMontarPedido(ctx, { perfil: p, tipo: 'inicial' });
  const txt = JSON.stringify(pedido);
  // Mesma regra da função: perfil e histórico sem campos pessoais ("nome" no catálogo é nome de exercício).
  ok(!/"(nome|email|e-mail|uid|nascimento|foto|peso|altura|telefone)"\s*:/i.test(JSON.stringify({ perfil: pedido.perfil, historico: pedido.historico })), `pedido sem dados pessoais (${txt.length} bytes, ${pedido.exerciciosAutorizados.length} exercícios autorizados)`);

  const usuario = await criarUsuarioFicticio(emu.auth);
  ok(!!usuario.idToken, 'usuário fictício criado no emulador de Auth');

  // Recusas da função
  const semLogin = await chamarFuncao(emu.functions, { consentimento: true, pedido, simulado: true }, null);
  ok(semLogin.error && semLogin.error.status === 'UNAUTHENTICATED', 'sem login: recusado (' + (semLogin.error && semLogin.error.status) + ')');
  const semAceite = await chamarFuncao(emu.functions, { consentimento: false, pedido, simulado: true }, usuario.idToken);
  ok(semAceite.error && semAceite.error.status === 'FAILED_PRECONDITION', 'sem consentimento: recusado (' + (semAceite.error && semAceite.error.status) + ')');
  const pedidoRuim = await chamarFuncao(emu.functions, { consentimento: true, pedido: { ...pedido, nome: 'Fulana' }, simulado: true }, usuario.idToken);
  ok(pedidoRuim.error && pedidoRuim.error.status === 'INVALID_ARGUMENT', 'campo pessoal no pedido: recusado (' + (pedidoRuim.error && pedidoRuim.error.status) + ')');

  // Chamada válida, passando pelo fluxo do app (iaRefinarSemana: validação F0–F9 + validarPlano)
  let retornoBruto = null, pedidoEnviado = null;
  const t0 = Date.now();
  const r = await T.iaRefinarSemana({
    perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: usuario.uid }, tipo: 'inicial',
    chamarFuncao: async (ped) => {
      pedidoEnviado = ped;
      const c = await chamarFuncao(emu.functions, { consentimento: true, pedido: ped, simulado: !REAL }, usuario.idToken);
      retornoBruto = c;
      if (c.error) throw new Error(c.error.status + ': ' + c.error.message);
      return c.result;
    },
  });
  const ms = Date.now() - t0;
  if (retornoBruto && retornoBruto.error) console.log('  erro da função: ' + retornoBruto.error.status + ' — ' + retornoBruto.error.message);
  else if (retornoBruto) console.log(`  função respondeu em ${ms} ms, modelo ${retornoBruto.result.modelo}, cache ${retornoBruto.result.cache}`);
  ok(r.origem === 'ia' && r.motivo === 'ok', `resposta validada pelo app: origem ${r.origem}, motivo ${r.motivo}` + (r.erros ? ' — ' + JSON.stringify(r.erros).slice(0, 300) : ''));
  if (r.origem === 'ia') {
    Object.keys(r.semana.muscPlan).forEach(d => console.log(`    ${d}: ` + r.semana.muscPlan[d].map(e => `${e.nome} ${e.series}x${e.reps}`).join(', ')));
  }

  // Cota e cache gravados no Firestore do EMULADOR
  // (o harness congela o relógio do Node, então a data do documento é lida da coleção, não calculada aqui)
  const veioDoCache = !!(retornoBruto && retornoBruto.result && retornoBruto.result.cache);
  const usos = await lerDocFirestore(emu.firestore, 'iaUso');
  const doc = ((usos.corpo && usos.corpo.documents) || []).find(d => d.name.includes('/iaUso/' + usuario.uid + '_'));
  if (veioDoCache) console.log('  (resposta veio do cache de uma rodada anterior: sem consumo de cota, como esperado)');
  else ok(!!doc, 'cota do usuário gravada no Firestore do emulador' + (doc ? ` (${doc.name.split('/').pop()}, n=${doc.fields.n.integerValue})` : ''));

  // Segunda chamada igual: deve vir do cache, sem nova chamada ao modelo
  const repetida = await chamarFuncao(emu.functions, { consentimento: true, pedido: pedidoEnviado, simulado: !REAL }, usuario.idToken);
  ok(repetida.result && repetida.result.cache === true, 'pedido repetido: servido do cache');

  console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('Erro:', e && e.message); process.exit(1); });
