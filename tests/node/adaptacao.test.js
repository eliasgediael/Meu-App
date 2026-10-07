// Bloco 7: check-in semanal como contratos (WeeklyCheckin → WeekDecision → WeekOverlay), redução automática que
// mostra o que mudou, aumento só com confirmação, idempotência e overlays do dia.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });
const copia = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'aplicarCheckinSemanalV2', 'responderDecisaoPendente',
    'antesDepoisDoAjuste', 'overlaysDoDia', 'opcoesAjuste', 'decidirSemana', 'criarWeeklyCheckin']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); await T.qv2Aplicar(perfil('08')); await T.gerarPrimeiroPlanoV2();
  const hp0 = copia(S.hybridPlanData);
  const minCorrida = (w) => (w.corridaWeek || []).reduce((t, c) => t + (c.totalMin || 0), 0);

  // redução por dor: automática, mesmos ajustes de antes
  let hp = T.aplicarCheckinSemanalV2(copia(hp0), 1, { fadiga: 3, dor: true, dorRegiao: 'joelho', motivos: [] }, 'dificil');
  const dec = hp.decisoesSemanais[1];
  ok(hp.checkinsSemanais[1].id === 'chk:1' && dec.checkinId === 'chk:1' && hp.overlaysSemana[2].decisaoId === dec.id, 'check-in → decisão → overlay ligados por id');
  ok(JSON.stringify(hp.ajusteProximaSemana) === JSON.stringify({ semana: 2, ajustes: { volumeFator: 0.8, aliviarInferior: true } }), 'dor: −20% de volume e pernas aliviadas, aplicado na hora (como antes)');
  ok(dec.automatica && !dec.requerConfirmacao && dec.prioridade === 'seguranca_dor' && dec.reasonCodes.includes('dor_relatada'), 'decisão por dor é automática, prioridade segurança, com motivo');
  ok(!hp.decisaoPendente, 'redução não fica pendente');
  const ad = T.antesDepoisDoAjuste(hp, 2, hp.ajusteProximaSemana.ajustes);
  ok(ad.depois.corridaMin < ad.antes.corridaMin, `antes/depois mostra a redução da corrida (${ad.antes.corridaMin} → ${ad.depois.corridaMin} min)`);

  // idempotência: refazer o mesmo check-in não acumula
  const hp2 = T.aplicarCheckinSemanalV2(copia(hp), 1, { fadiga: 3, dor: true, dorRegiao: 'joelho', motivos: [] }, 'dificil');
  ok(JSON.stringify(hp2.ajusteProximaSemana) === JSON.stringify(hp.ajusteProximaSemana) && Object.keys(hp2.overlaysSemana).length === 1, 'refazer o check-in da mesma semana não acumula ajuste');

  // semana fácil: aumento fica pendente até confirmar
  hp = T.aplicarCheckinSemanalV2(copia(hp0), 1, { fadiga: 2, dor: false, motivos: ['leve'], percepcao: 1 }, 'facil');
  ok(!hp.ajusteProximaSemana && hp.decisaoPendente && hp.decisaoPendente.semana === 2, 'semana fácil: aumento NÃO entra sozinho, fica como proposta');
  S.hybridPlanData = hp; const semConfirmar = minCorrida(T.gerarSemanaV2(2));
  const aceito = T.responderDecisaoPendente(copia(hp), true);
  S.hybridPlanData = aceito; const comConfirmar = minCorrida(T.gerarSemanaV2(2));
  ok(aceito.ajusteProximaSemana && aceito.ajusteProximaSemana.ajustes.volumeFator === 1.05 && !aceito.decisaoPendente && aceito.overlaysSemana[2].estado === 'aplicado', 'aceitar aplica +5% na semana 2');
  ok(comConfirmar > semConfirmar, `semana 2 maior só depois de aceitar (${semConfirmar} → ${comConfirmar} min)`);
  const recusado = T.responderDecisaoPendente(copia(hp), false);
  ok(!recusado.ajusteProximaSemana && recusado.overlaysSemana[2].estado === 'recusado' && !recusado.decisaoPendente, 'recusar mantém a semana como planejada');

  // fadiga 5: sem qualidade, automático
  const d5 = T.decidirSemana(T.criarWeeklyCheckin(1, { fadiga: 5, dor: false, motivos: [] }, 'dificil'));
  ok(d5.acoes.includes('converter_qualidade_em_facil') && d5.acoes.includes('reduzir_volume') && d5.automatica, 'fadiga máxima: reduz volume e tira a qualidade, automático');
  ok(T.decidirSemana(T.criarWeeklyCheckin(1, { fadiga: 2, motivos: [] }, 'bom')).acoes[0] === 'manter', 'semana normal: manter');

  // overlays do dia (ajuste feito pela escada do treinador fica com o original guardado)
  S.hybridPlanData = copia(hp0);
  const op = T.opcoesAjuste('Seg').find(o => /Reduzir/.test(o.titulo));
  if (op) await op.aplicar();
  const ov = T.overlaysDoDia();
  ok(op && ov.some(o => o.modalidade === 'corrida' && o.dia === 'Seg' && o.original && o.atual), 'ajuste do dia aparece como overlay com original e atual');

  semErro();
  process.exit(process.exitCode || 0);
})();
