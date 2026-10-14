// Etapa B — teste real local: app (harness) → Worker no wrangler dev (127.0.0.1) → Gemini → F0–F9 → treino.
// Perfil fictício, sem dados de saúde. A chave fica só em worker/.dev.vars (ignorado pelo git) e nunca é impressa.
//
// Login: cria um usuário FICTÍCIO no Firebase Auth real (plano Spark, gratuito), usa o token para o Worker conferir
// a assinatura com as chaves públicas reais do Google e APAGA o usuário no fim. Nada vai para o Firestore.
//
//   Terminal 1:  cd worker && npx wrangler dev --port 8787
//   Terminal 2:  node tests/worker/refinar-real.js [--perfil 08]
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https');

const RAIZ = path.resolve(__dirname, '..', '..');
const WORKER_URL = 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const PERFIL = args.includes('--perfil') ? args[args.indexOf('--perfil') + 1] : '08';
const COM_HISTORICO = args.includes('--historico');

// Histórico SINTÉTICO no formato real do app (nada de produção):
//   state.historicoCarga[repdbId || nome] = [{ data, sets: [{ peso, reps, pse }] }]   (logSetsHistory / registro com PSE)
//   hybridPlanData.checkins = { [semana]: 'facil' | 'bom' | 'dificil' }                (check-in semanal)
//   aderencia = fração das sessões planejadas que foram feitas (0 a 1)
// Cenário: 4 semanas; agachamentos pesados estagnando com PSE alto, leg press/flexora/supino evoluindo,
// barra fixa perdendo repetições, duas semanas "difíceis" e 70% de aderência (sessões não feitas).
const SESSOES_SINTETICAS = {
  'Agachamento livre com barra': [[60, 8, 8], [60, 7, 9], [57.5, 6, 9], [55, 6, 9.5]],
  'Agachamento livre': [[50, 8, 8], [50, 8, 8.5], [50, 7, 9], [50, 7, 9]],
  'Leg press 45 graus': [[120, 10, 7], [125, 10, 7], [130, 10, 7], [135, 10, 7.5]],
  'Mesa flexora (deitado)': [[30, 10, 7], [30, 10, 7], [32, 10, 7], [32, 10, 7]],
  'Supino reto com barra': [[50, 8, 7], [52.5, 8, 7.5], [52.5, 8, 7.5], [55, 8, 7.5]],
  'Barra fixa (pegada neutra)': [[0, 10, 8.5], [0, 9, 9], [0, 8, 9], [0, 7, 9]],
};
function historicoSintetico(ctx) {
  const chaves = new Map([...ctx.autorizados.porId.values()].map(it => [it.nome, it.chaveHistorico]));
  const historicoCarga = {};
  for (const [nome, sessoes] of Object.entries(SESSOES_SINTETICAS)) {
    const chave = chaves.get(nome);
    if (!chave) continue;
    historicoCarga[chave] = sessoes.map(([peso, reps, pse], i) => ({ data: `2026-09-${String(8 + i * 7).padStart(2, '0')}`, sets: [1, 2, 3].map(() => ({ peso: String(peso), reps: String(reps), pse })) }));
  }
  return { historicoCarga, checkins: { 1: 'bom', 2: 'dificil', 3: 'dificil', 4: 'bom' }, aderencia: 0.7 };
}

// O harness troca fetch/URL globais por dublês: requisições usam node:http/https direto.
function requisicao(url, { method = 'GET', headers = {}, body } = {}) {
  const mod = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method, headers }, (r) => {
      let t = ''; r.setEncoding('utf8');
      r.on('data', (c) => { t += c; });
      r.on('end', () => { let j = null; try { j = JSON.parse(t); } catch (e) { /* não é JSON */ } resolve({ status: r.statusCode, j, t }); });
    });
    req.on('error', reject);
    req.setTimeout(55000, () => req.destroy(new Error('tempo esgotado')));
    if (body) req.write(body);
    req.end();
  });
}

// apiKey pública da configuração web do Firebase (a mesma que já vai no app). Não é a chave do Gemini.
function apiKeyFirebaseWeb() {
  const m = /apiKey:\s*["'](AIza[0-9A-Za-z_-]{30,})["']/.exec(fs.readFileSync(path.join(RAIZ, 'treino-app.html'), 'utf8'));
  if (!m) throw new Error('apiKey do Firebase não encontrada no app');
  return m[1];
}

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; };
const resumoEx = (e) => `${e.nome} ${e.series}x${e.reps} RPE ${e.rpe} · ${e.descanso}`;

(async () => {
  console.log(`Etapa B — chamada real ao Gemini pelo Worker local — perfil fictício ${PERFIL}\n`);
  const saude = await requisicao(WORKER_URL + '/saude', { headers: { Origin: 'capacitor://localhost' } }).catch(() => null);
  if (!saude || saude.status !== 200) { console.error('Worker local fora do ar. Rode: cd worker && npx wrangler dev --port 8787'); process.exit(2); }
  ok(saude.j.ativa === true, 'Worker local no ar (wrangler dev) com IA ativa só neste teste');

  // App em memória com o perfil fictício e o plano do Motor V2
  const { carregarAppComIA, prepararPerfil } = require('../harness/ia.js');
  const T = await carregarAppComIA();
  const p = await prepararPerfil(T, PERFIL);
  const semanaMotor = T.gerarPlanoSemanal(p, {}).semana;
  T.IA_CONFIG.ativa = true;
  T.IA_CONFIG.timeoutMs = 50000;   // o valor que o app terá na etapa D (Worker: 45 s)
  T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });   // opção A: personalização sem dados de saúde

  // Usuário fictício no Firebase Auth real
  const chaveWeb = apiKeyFirebaseWeb();
  const email = `teste-ia-${Date.now()}@exemplo.invalid`;
  const cad = await requisicao('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + chaveWeb, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Senha-ficticia-' + Date.now(), returnSecureToken: true }),
  });
  if (!cad.j || !cad.j.idToken) { console.error('Não consegui criar o usuário fictício no Firebase Auth: ' + ((cad.j && cad.j.error && cad.j.error.message) || cad.status)); process.exit(1); }
  const idToken = cad.j.idToken;
  ok(true, 'usuário fictício criado no Firebase Auth (será apagado no fim)');

  let pedidoEnviado = null, retorno = null, ms = 0;
  const chamarFuncao = async (pedido) => {
    pedidoEnviado = pedido;
    const t0 = Date.now();
    const r = await requisicao(WORKER_URL + '/refinar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken, Origin: 'capacitor://localhost' },
      body: JSON.stringify({ consentimento: true, pedido }),
    });
    ms = Date.now() - t0; retorno = r;
    if (r.status !== 200 || !r.j || r.j.erro) throw new Error('servidor_' + ((r.j && r.j.erro && r.j.erro.codigo) || r.status));
    return r.j;
  };

  try {
    const historico = COM_HISTORICO ? historicoSintetico(T.iaContextoDoMotor(p, {}, semanaMotor)) : undefined;
    const r = await T.iaRefinarSemana({ perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'ficticio' }, tipo: COM_HISTORICO ? 'semanal' : 'inicial', historico, chamarFuncao });
    if (COM_HISTORICO) {
      const h = pedidoEnviado && pedidoEnviado.historico;
      ok(h && h.porExercicio.length >= Object.keys(SESSOES_SINTETICAS).length && h.checkins.length === 4 && h.aderencia === 0.7, `histórico sintético no pedido: ${h ? h.porExercicio.length : 0} exercícios, check-ins ${h ? h.checkins.join('/') : '-'}, aderência ${h ? h.aderencia : '-'}`);
      ok(!/"(data|peso|carga)"\s*:/.test(JSON.stringify(h)), 'histórico sem datas e sem kg (só tendência, repetições médias e PSE médio)');
      if (h) h.porExercicio.forEach(x => console.log(`    ${x.id}: ${x.sessoes} sessões, tendência ${x.tendencia}, reps média ${x.repsMedia}, PSE médio ${x.pseMedio}`));
    }

    // Privacidade do pedido
    const txt = JSON.stringify(pedidoEnviado || {});
    ok(!!pedidoEnviado, `pedido montado (${txt.length} bytes, ${(pedidoEnviado && pedidoEnviado.exerciciosAutorizados.length) || 0} exercícios autorizados)`);
    ok(pedidoEnviado && !('regioesDor' in (pedidoEnviado.perfil || {})) && !/"(dor|dores|regioesDor|lesoes|lesao)"\s*:/i.test(txt), 'sem regiões de dor, lesões ou outro dado de saúde no pedido');
    ok(!/"(nome|email|uid|nascimento|foto|peso|altura)"\s*:/i.test(JSON.stringify({ perfil: pedidoEnviado && pedidoEnviado.perfil, historico: pedidoEnviado && pedidoEnviado.historico })), 'sem dados pessoais no perfil e no histórico');

    // Resposta do Worker
    if (retorno && retorno.j && retorno.j.erro) {
      ok(false, `Worker respondeu ${retorno.status} ${retorno.j.erro.codigo}: ${retorno.j.erro.mensagem} (veja o motivo no terminal do wrangler)`);
    } else if (retorno) {
      ok(retorno.status === 200, `chamada real feita: modelo ${retorno.j.modelo}, ${ms} ms, cache ${retorno.j.cache}`);
    }
    // Conferências diretas na resposta bruta do Gemini (além dos validadores do app)
    const resp = retorno && retorno.j && retorno.j.resposta;
    if (resp) {
      const ids = new Set(pedidoEnviado.exerciciosAutorizados.map(e => e.id));
      const todos = (resp.dias || []).flatMap(d => d.exercicios || []);
      ok(Array.isArray(resp.dias) && resp.versao === '1', `JSON válido no esquema (versao ${resp.versao}, ${resp.dias.length} dias, ${todos.length} exercícios)`);
      ok(todos.every(e => ids.has(e.id)), 'todos os exercícios estão na lista autorizada');
      const diasMotor = Object.keys(semanaMotor.muscPlan).sort().join(','), diasIA = resp.dias.map(d => d.dia).sort().join(',');
      ok(diasMotor === diasIA, `mesmos dias de musculação do motor (motor ${diasMotor} · IA ${diasIA})`);
      const lim = pedidoEnviado.regras || {};
      console.log('  limites enviados: ' + JSON.stringify({ totalSeriesSemanaMax: lim.totalSeriesSemanaMax }).slice(0, 200));
    }
    ok(r.origem === 'ia' && r.motivo === 'ok', `validação F0–F9 + validarPlano: ${r.origem}/${r.motivo}` + (r.erros ? ' — ' + JSON.stringify(r.erros).slice(0, 400) : ''));
    if (retorno && retorno.j && retorno.j.resposta) console.log('\n  motivos da IA: ' + (retorno.j.resposta.motivos || []).join(', '));
    if (r.avisos && r.avisos.length) console.log('  avisos: ' + JSON.stringify(r.avisos).slice(0, 300));

    // Guarda motor, resposta e plano final (sem dados pessoais) para a análise de qualidade
    if (process.env.SAIDA_ANALISE) fs.writeFileSync(process.env.SAIDA_ANALISE, JSON.stringify({ historico: pedidoEnviado && pedidoEnviado.historico, motor: semanaMotor.muscPlan, final: r.semana.muscPlan, origem: r.origem, motivo: r.motivo, erros: r.erros || null, avisos: r.avisos || null, volume: r.volume || null, resposta: (retorno && retorno.j && retorno.j.resposta) || null, perfil: pedidoEnviado && pedidoEnviado.perfil, dias: pedidoEnviado && pedidoEnviado.dias, regras: pedidoEnviado && pedidoEnviado.regras, autorizados: pedidoEnviado && pedidoEnviado.exerciciosAutorizados }, null, 1));
    // Comparação motor × IA
    const final = r.semana.muscPlan;
    console.log('\n  Motor V2 → ' + (r.origem === 'ia' ? 'IA (aprovado)' : 'plano final (motor)'));
    for (const d of Object.keys(semanaMotor.muscPlan)) {
      console.log(`  ${d}`);
      const a = semanaMotor.muscPlan[d], b = final[d] || [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const ea = a[i] ? resumoEx(a[i]) : '—', eb = b[i] ? resumoEx(b[i]) : '—';
        console.log(`    ${ea === eb ? ' ' : '*'} ${ea}${ea === eb ? '' : '\n        → ' + eb}`);
      }
    }
    const series = (mp) => Object.values(mp).flat().reduce((s, e) => s + (parseInt(e.series, 10) || 0), 0);
    console.log(`\n  séries na semana: motor ${series(semanaMotor.muscPlan)} → final ${series(final)}`);
    ok(series(final) <= series(semanaMotor.muscPlan), 'volume semanal não passou do motor (F6)');

    // Segunda chamada igual: cache, sem nova chamada ao Gemini
    if (r.origem === 'ia') {
      const t0 = Date.now();
      const c = await requisicao(WORKER_URL + '/refinar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken, Origin: 'capacitor://localhost' }, body: JSON.stringify({ consentimento: true, pedido: pedidoEnviado }) });
      ok(c.status === 200 && c.j.cache === true, `pedido repetido servido do cache (${Date.now() - t0} ms, sem gastar cota)`);
    }
  } finally {
    const del = await requisicao('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + chaveWeb, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
    ok(del.status === 200, 'usuário fictício apagado do Firebase Auth');
  }
  console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('Erro: ' + (e && e.message)); process.exit(1); });
