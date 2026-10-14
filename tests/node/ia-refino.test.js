// IA (Gemini) — orquestração no app: desligada por padrão, consentimento, offline, falhas e fallback automático para o
// plano do motor, e minimização dos dados enviados. Nenhuma chamada real: a "função" é um dublê.
const { ok, semErro } = require('../harness/carregar.js');
const { carregarAppComIA, prepararPerfil, respostaIdentidade } = require('../harness/ia.js');

(async () => {
  const T = await carregarAppComIA();
  const p = await prepararPerfil(T, '08');
  const semanaMotor = T.gerarPlanoSemanal(p, {}).semana;
  const congelada = JSON.stringify(semanaMotor);
  let chamadas = 0, ultimoPedido = null;
  const funcao = (resposta) => async (pedido) => { chamadas++; ultimoPedido = pedido; return typeof resposta === 'function' ? resposta(pedido) : resposta; };
  const ctx = T.iaContextoDoMotor(p, {}, semanaMotor);
  const identidade = respostaIdentidade(T, semanaMotor.muscPlan, ctx);
  const base = { perfil: p, opcoes: {}, semanaMotor, online: true, usuario: { uid: 'u1' } };
  const roda = (extra) => T.iaRefinarSemana({ ...base, chamarFuncao: funcao({ resposta: identidade }), ...extra });
  const ficaNoMotor = (r, motivo, msg) => ok(r.origem === 'motor' && r.semana === semanaMotor && r.motivo === motivo, msg + ` (${r.origem}/${r.motivo})`);

  // ---------- desligada por padrão ----------
  ok(T.IA_CONFIG.ativa === false, 'IA desligada por padrão');
  ficaNoMotor(await roda(), 'ia_desligada', 'desligada: plano do motor, sem chamada');
  ok(chamadas === 0, 'desligada: a função não é chamada');

  T.IA_CONFIG.ativa = true;
  // ---------- consentimento ----------
  ok(T.iaConsentimentoEstado(p) === 'pendente', 'consentimento começa pendente');
  ficaNoMotor(await roda(), 'sem_consentimento', 'sem consentimento: plano do motor');
  T.iaRegistrarConsentimento(p, { aceito: false });
  ok(T.iaConsentimentoEstado(p) === 'recusado', 'recusa registrada');
  ficaNoMotor(await roda(), 'sem_consentimento', 'recusou: plano do motor');
  T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });
  ok(T.iaConsentimentoEstado(p) === 'aceito' && !T.iaConsentimentoIncluiSaude(p), 'aceite sem dados de saúde');
  p.meta.consentimentoIA.versao = 'antiga';
  ok(T.iaConsentimentoEstado(p) === 'desatualizado', 'versão antiga do texto pede novo aceite');
  ficaNoMotor(await roda(), 'sem_consentimento', 'consentimento desatualizado: plano do motor');
  T.iaRegistrarConsentimento(p, { aceito: true, incluirSaude: false });
  ok(chamadas === 0, 'sem consentimento válido a função nunca é chamada');

  // ---------- offline, sem login, falhas ----------
  ficaNoMotor(await roda({ online: false }), 'offline', 'offline: plano do motor');
  ficaNoMotor(await roda({ usuario: null }), 'sem_login', 'sem login: plano do motor');
  ficaNoMotor(await roda({ chamarFuncao: async () => { chamadas++; throw new Error('unavailable'); } }), 'falha_chamada', 'erro da função: plano do motor');
  T.IA_CONFIG.timeoutMs = 50;
  ficaNoMotor(await roda({ chamarFuncao: () => new Promise(() => {}) }), 'falha_chamada', 'função que não responde: plano do motor depois do tempo-limite');
  T.IA_CONFIG.timeoutMs = 25000;
  const ruim = JSON.parse(JSON.stringify(identidade)); ruim.dias[0].exercicios[0].series = 9;
  const rr = await roda({ chamarFuncao: funcao({ resposta: ruim }) });
  ficaNoMotor(rr, 'validacao_reprovada', 'resposta reprovada: plano do motor');
  ok(Array.isArray(rr.erros) && rr.erros.some(e => e.cod === 'F2'), 'motivo da reprovação fica registrado (F2)');
  ficaNoMotor(await roda({ chamarFuncao: funcao({ resposta: 'não é json' }) }), 'validacao_reprovada', 'texto qualquer: plano do motor');
  ok(JSON.stringify(semanaMotor) === congelada, 'o plano do motor nunca é alterado pelas tentativas');

  // ---------- sucesso ----------
  const r = await roda();
  ok(r.origem === 'ia' && r.motivo === 'ok' && r.semana !== semanaMotor, 'resposta válida: semana refinada');
  ok(r.semana.iaRefino && r.semana.iaRefino.versaoContrato === '1', 'semana refinada marcada (versão do contrato)');
  ok(JSON.stringify(r.semana.corridaWeek) === JSON.stringify(semanaMotor.corridaWeek), 'corrida intacta');
  ok(JSON.stringify(semanaMotor) === congelada, 'plano do motor intacto depois do sucesso');

  // ---------- dados enviados (minimização) ----------
  T.state.perfil = { ...T.state.perfil, nome: 'Maria Teste', foto: 'data:image/png;base64,AAAA' };
  const hist = { historicoCarga: {}, checkins: { 1: 'bom', 2: 'dificil' }, aderencia: 0.8 };
  const primeiro = Object.values(semanaMotor.muscPlan)[0][0];
  hist.historicoCarga[primeiro.repdbId || primeiro.nome] = [
    { data: '2026-09-21', sets: [{ peso: '40', reps: '10', pse: '7' }] },
    { data: '2026-09-28', sets: [{ peso: '42.5', reps: '10', pse: '8' }] },
  ];
  await roda({ historico: hist });
  const txt = JSON.stringify(ultimoPedido);
  ok(!!ultimoPedido, 'pedido capturado');
  ok(!/Maria|base64|"nome":"Maria|email|uid|nascimento|"peso"|"altura"|"sexo"/.test(txt), 'pedido sem nome, foto, e-mail, uid, nascimento, peso, altura, sexo');
  ok(!/2026-09-2|42\.5/.test(txt), 'histórico sem datas e sem cargas em kg');
  const h = ultimoPedido.historico.porExercicio.find(x => x.sessoes === 2);
  ok(!!h && h.tendencia === 'subindo' && h.pseMedio === 7.5, 'histórico resumido: tendência e PSE médio');
  ok(ultimoPedido.historico.checkins.join() === 'bom,dificil' && ultimoPedido.historico.aderencia === 0.8, 'check-ins e aderência no resumo');
  ok(!('regioesDeDor' in ultimoPedido.perfil), 'sem aceite de saúde: regiões de dor não vão');
  ok(ultimoPedido.exerciciosAutorizados.every(e => /^[A-Za-z0-9_-]{1,12}$/.test(e.id)), 'exercícios autorizados identificados por id válido');
  ok(ultimoPedido.regras.diasFixos.join() === Object.keys(semanaMotor.muscPlan).join(), 'dias de musculação fixos no pedido');

  const p15 = await prepararPerfil(T, '15');
  const s15 = T.gerarPlanoSemanal(p15, {}).semana;
  T.iaRegistrarConsentimento(p15, { aceito: true, incluirSaude: true });
  const c15 = T.iaContextoDoMotor(p15, {}, s15);
  await T.iaRefinarSemana({ ...base, perfil: p15, semanaMotor: s15, chamarFuncao: funcao({ resposta: respostaIdentidade(T, s15.muscPlan, c15) }) });
  ok(ultimoPedido.perfil.regioesDeDor && ultimoPedido.perfil.regioesDeDor.join() === 'joelho', 'com aceite de saúde: só o código da região (joelho)');
  T.iaRevogarConsentimento(p15);
  ok(T.iaConsentimentoEstado(p15) === 'revogado', 'consentimento revogado');
  const antes = chamadas;
  const rv = await T.iaRefinarSemana({ ...base, perfil: p15, semanaMotor: s15, chamarFuncao: funcao({}) });
  ok(rv.origem === 'motor' && rv.semana === s15 && rv.motivo === 'sem_consentimento', 'revogado: plano do motor');
  ok(chamadas === antes, 'revogado: nenhuma chamada');

  // ---------- semana seguinte (adaptação semanal) ----------
  const p2 = await prepararPerfil(T, '04');
  T.iaRegistrarConsentimento(p2, { aceito: true });
  const alvo2 = T.state.hybridPlanData.trajetoria[1];
  const w2 = T.gerarSemanaV2(2);
  const c2 = T.iaContextoDoMotor(p2, { alvoSemana: alvo2 }, w2);
  const r2 = await T.iaRefinarSemana({ ...base, perfil: p2, opcoes: { alvoSemana: alvo2 }, semanaMotor: w2, tipo: 'semanal', chamarFuncao: funcao({ resposta: respostaIdentidade(T, w2.muscPlan, c2) }) });
  ok(r2.origem === 'ia' && ultimoPedido.tipo === 'semanal' && ultimoPedido.semana.numero === 2, 'semana 2: pedido semanal com o número da semana');

  T.IA_CONFIG.ativa = false;
  semErro();
})();
