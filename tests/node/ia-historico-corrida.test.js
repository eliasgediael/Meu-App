// IA — resumo do histórico de corrida (src/ia/historico-corrida.js), só com histórico FICTÍCIO.
// Sem dados x dados insuficientes x desempenho ruim; aderência; pace planejado x realizado; por tipo; blocos fortes
// completos/interrompidos; tendência do pace leve com esforço; check-ins; pausa; futuro ignorado; privacidade
// (sem datas, GPS, ids ou chave do dia); determinismo (mesma entrada → mesmo resumo, em qualquer ordem).
const { carregarAppComIA } = require('../harness/ia.js');
const { ok, semErro } = require('../harness/carregar.js');

const HOJE = '2026-10-14';                  // quarta-feira
const SEGUNDAS = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];   // 3, 2, 1 e 0 semanas atrás
const dia = (seg, i) => { const d = new Date(seg + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };
const chave = (iso, nome) => `${nome} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const LEVE_PACE = '5:55 ~ 6:37/km', I_PACE = '4:42 ~ 4:45/km';
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/km`;

function leve(iso, nome, km) {
  return { day: chave(iso, nome), type: 'Rodagem Leve', sessao: 'RUN_EASY_Z2', totalKm: km, totalMin: Math.round(km * 6.27),
    steps: [{ name: 'Aquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1' }, { name: 'Principal', km: km - 2, pace: LEVE_PACE, zona: 'Z2' }, { name: 'Desaquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1' }],
    gpsSteps: [{ name: 'Aquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1', tipo: 'distancia' }, { name: 'Principal', km: km - 2, pace: LEVE_PACE, zona: 'Z2', tipo: 'distancia' }, { name: 'Desaquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1', tipo: 'distancia' }] };
}
function longao(iso, nome, km) { return { ...leve(iso, nome, km), type: 'Longão', sessao: 'RUN_LONG_RUN', totalMin: Math.round(km * 6.6) }; }
function intervalado(iso, nome) {
  const gps = [{ name: 'Aquecimento', km: 1.5, pace: LEVE_PACE, zona: 'Z1', tipo: 'distancia' }];
  for (let i = 1; i <= 6; i++) { gps.push({ name: `Tiro ${i}/6`, km: 0.8, pace: I_PACE, zona: 'Z5', tipo: 'distancia' }); if (i < 6) gps.push({ name: `Trote ${i}/6`, km: 0.3, pace: LEVE_PACE, zona: 'Z1', tipo: 'tempo', metaSeg: 120 }); }
  gps.push({ name: 'Desaquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1', tipo: 'distancia' });
  return { day: chave(iso, nome), type: 'Intervalado', sessao: 'RUN_INTERVALS_VO2MAX', totalKm: 9, totalMin: 50,
    steps: [{ name: 'Aquecimento', km: 1.5, pace: LEVE_PACE, zona: 'Z1' }, { name: 'Principal', km: 6, pace: I_PACE, zona: 'Z5' }, { name: 'Desaquecimento', km: 1, pace: LEVE_PACE, zona: 'Z1' }], gpsSteps: gps };
}
// Gravação do GPS de um intervalado: completa (6 tiros no alvo) ou interrompida depois de n tiros.
function gravacaoIntervalado(id, tiros, paceTiroSeg) {
  const ex = [{ tipo: 'Aquecimento', duracao_real_seg: 560, distancia_real_km: 1.5, pace_medio_real: 6.2 }];
  for (let i = 1; i <= tiros; i++) { ex.push({ tipo: `Tiro ${i}/6`, duracao_real_seg: Math.round(0.8 * paceTiroSeg), distancia_real_km: 0.8, pace_medio_real: paceTiroSeg / 60 }); if (i < 6 && i < tiros) ex.push({ tipo: `Trote ${i}/6`, duracao_real_seg: 120, distancia_real_km: 0.3, pace_medio_real: 6.6 }); }
  return { id, etapas_executadas: ex, pontos_gps: [{ lat: -23.5, lng: -46.6, timestamp: 1 }], distancia_total_km: 6, tempo_total_seg: 2400 };
}
const feito = (paceSeg, km, extra) => ({ done: true, km: String(km), tempo: `${Math.floor(paceSeg * km / 60)}:${String(Math.round(paceSeg * km % 60)).padStart(2, '0')}`, pace: fmt(paceSeg), ...(extra || {}) });

(async () => {
  const T = await carregarAppComIA();
  const G = globalThis;
  const resumo = (dados) => G.iaResumoCorrida(G.iaColetarHistoricoCorrida({ hoje: HOJE, ...dados }));

  // ---------- 1. sem dados ----------
  {
    const r = resumo({});
    ok(r.status === 'sem_dados' && r.sessoes.planejadas === 0 && r.aderencia.geral === null && Object.keys(r.porTipo).length === 0 && r.blocosFortes === null
      && r.tendenciaPaceLeve.status === 'dados_insuficientes' && r.checkinsSemanais === null && r.checkinDiario14dias === null, 'sem histórico: status sem_dados, tudo nulo (nunca zero inventado)');
    ok(!/NaN|Infinity|undefined/.test(JSON.stringify(r)), 'sem histórico: nenhum NaN/Infinity/undefined');
  }
  // ---------- 2. dados insuficientes ----------
  {
    const s = leve(dia(SEGUNDAS[3], 0), 'Seg', 6);
    const r = resumo({ treinos: [s], corridaProgress: { [s.day]: feito(375, 6, { data: dia(SEGUNDAS[3], 0), comoFoi: 2 }) } });
    ok(r.status === 'dados_insuficientes' && r.porTipo.leve.status === 'dados_insuficientes' && r.tendenciaPaceLeve.status === 'dados_insuficientes',
      'uma corrida só: dados_insuficientes no geral, no tipo e na tendência (sem conclusão)');
    ok(r.porTipo.leve.pace.n === 1 && r.sessoes.concluidas === 1, 'uma corrida só: o que existe aparece com n=1');
  }

  // ---------- 3. histórico de 4 semanas (bom) ----------
  const treinos = [], prog = {}, runs = {};
  SEGUNDAS.forEach((seg, w) => {
    const a = leve(dia(seg, 0), 'Seg', 6), b = intervalado(dia(seg, 2), 'Qua'), c = longao(dia(seg, 5), 'Sáb', 12);
    treinos.push(a, b, c);
    if (w === 3) return;   // semana atual: Seg feita abaixo; Qua = hoje (pendente, não conta); Sáb = futuro
    prog[a.day] = feito(375, 6, { data: dia(seg, 0), comoFoi: 2 });
    prog[b.day] = feito(285, 9, { data: dia(seg, 2), comoFoi: 3, gpsRunId: 'run_' + w });
    runs['run_' + w] = gravacaoIntervalado('run_' + w, 6, 284);
    prog[c.day] = feito(392, 12, { data: dia(seg, 5), comoFoi: 2 });
  });
  prog[treinos[9].day] = feito(372, 6, { data: dia(SEGUNDAS[3], 0), comoFoi: 2 });
  const base = { treinos, corridaProgress: prog, gpsRuns: runs };
  {
    const r = resumo(base);
    ok(r.status === 'ok' && r.sessoes.planejadas === 10 && r.sessoes.concluidas === 10 && r.aderencia.geral === 1, `4 semanas: 10 sessões passadas (hoje e o futuro ficam fora), aderência 1 (${r.sessoes.planejadas}/${r.aderencia.geral})`);
    ok(r.aderencia.porSemana.length === 4 && r.aderencia.porSemana.every(s => s.feitas === s.planejadas), 'aderência por semana (semanas atrás 3 → 0)');
    ok(r.porTipo.leve.status === 'ok' && Math.abs(r.porTipo.leve.pace.difMedianaSegKm) <= 5 && r.porTipo.leve.pace.dentroDoAlvo === r.porTipo.leve.pace.n, 'leve no alvo: diferença mediana ~0 s/km, todas dentro do alvo');
    ok(r.blocosFortes && r.blocosFortes.sessoesComGravacao === 3 && r.blocosFortes.completas === 3 && r.blocosFortes.interrompidas === 0 && r.blocosFortes.blocosCompletos === 18, 'intervalados completos: 3 sessões gravadas, 18 de 18 tiros');
    ok(r.porTipo.intervalado.esforco.media === 3 && r.porTipo.intervalado.esforco.dificeis === 3, 'esforço ("como foi") por tipo: intervalados "Difícil"');
    ok(r.porTipo.intervalado.pace === null && r.porTipo.intervalado.blocos.completas === 3 && Math.abs(r.porTipo.intervalado.blocos.paceNosBlocosDifMedianaSegKm) <= 2,
      'intervalado: pace comparado só nos tiros (média da sessão com trotes não é usada)');
  }

  // ---------- 4. intervalados interrompidos (desempenho ruim ≠ ausência) ----------
  {
    const runs2 = { ...runs, run_0: gravacaoIntervalado('run_0', 3, 300), run_1: gravacaoIntervalado('run_1', 4, 302) };
    const r = resumo({ ...base, gpsRuns: runs2 });
    ok(r.blocosFortes.interrompidas === 2 && r.blocosFortes.completas === 1 && r.blocosFortes.blocosCompletos === 13, `intervalados interrompidos: 2 de 3 sessões, 13 de 18 tiros (${r.blocosFortes.blocosCompletos})`);
    ok(r.blocosFortes.paceNosBlocosDifMedianaSegKm > 10, `tiros mais lentos que o alvo aparecem como número (+${r.blocosFortes.paceNosBlocosDifMedianaSegKm} s/km), não como ausência`);
    const semGrav = resumo({ ...base, gpsRuns: {} });
    ok(semGrav.blocosFortes === null && semGrav.qualidadeSemGravacao === 3 && semGrav.porTipo.intervalado.blocos === null && semGrav.porTipo.intervalado.semGravacao === 3
      && semGrav.porTipo.intervalado.status === 'dados_insuficientes', 'intervalado sem gravação do GPS: blocos ausentes (null), "sem gravação" e dados insuficientes — nunca "interrompido"');
  }
  // ---------- 5. não realizadas e concluídas sem registro ----------
  {
    const p2 = { ...prog };
    delete p2[treinos[0].day];                       // leve de 3 semanas atrás não feito
    p2[treinos[5].day] = { done: true };             // longão de 2 semanas atrás: concluído sem registro
    const r = resumo({ ...base, corridaProgress: p2 });
    ok(r.sessoes.naoRealizadas === 1 && r.sessoes.concluidasSemRegistro === 1 && r.aderencia.geral === 0.9, `não realizada conta contra a aderência; "concluída sem registro" conta a favor, sem pace (${r.aderencia.geral})`);
    ok(r.porTipo.longao.pace.n === 2 && r.porTipo.longao.semRegistro === 1, 'concluída sem registro não gera pace');
  }
  // ---------- 6. pace melhorando com esforço menor ----------
  {
    const p3 = { ...prog };
    const leves = treinos.filter(t => t.type !== 'Intervalado');
    const paces = [400, 395, 385, 380, 372, 365, 360];   // do mais antigo ao mais recente (s/km)
    const ordem = leves.filter(t => prog[t.day]).sort((a, b) => prog[a.day].data.localeCompare(prog[b.day].data));
    ordem.forEach((t, i) => { p3[t.day] = feito(paces[i], t.totalKm, { data: prog[t.day].data, comoFoi: i < 3 ? 3 : 1 }); });
    const r = resumo({ ...base, corridaProgress: p3 });
    ok(r.tendenciaPaceLeve.status === 'melhorando' && r.tendenciaPaceLeve.esforco === 'menor' && r.tendenciaPaceLeve.difSegKm < 0,
      `pace leve melhorando com esforço menor (${r.tendenciaPaceLeve.difSegKm} s/km, esforço ${r.tendenciaPaceLeve.esforco})`);
    const p4 = { ...prog };
    ordem.forEach((t, i) => { p4[t.day] = feito(370 + i * 8, t.totalKm, { data: prog[t.day].data, comoFoi: i < 3 ? 2 : 4 }); });
    const r4 = resumo({ ...base, corridaProgress: p4 });
    ok(r4.tendenciaPaceLeve.status === 'piorando' && r4.tendenciaPaceLeve.esforco === 'maior', 'pace piorando com esforço maior');
  }
  // ---------- 7. pausa, futuro, corridas livres, check-ins ----------
  {
    const p5 = { ...prog }; delete p5[treinos[3].day]; delete p5[treinos[4].day];
    const r = resumo({ ...base, corridaProgress: p5, pausa: { inicio: dia(SEGUNDAS[1], 0), fim: dia(SEGUNDAS[1], 3) } });
    ok(r.sessoes.naoRealizadas === 0 && r.sessoes.planejadas === 8, 'dias de pausa não contam como treino não realizado');
    const r2 = resumo({ ...base, atividadesLivres: [{ tipo: 'corrida', data: dia(SEGUNDAS[2], 3), distKm: 5.2 }, { tipo: 'caminhada', data: dia(SEGUNDAS[2], 4), distKm: 3 }, { tipo: 'corrida', data: '2026-08-01', distKm: 9 }] });
    ok(r2.corridasLivres.quantidade === 1 && r2.corridasLivres.kmTotal === 5, 'corridas livres na janela contadas à parte (caminhada e fora da janela ficam fora)');
    const r3 = resumo({ ...base, checkins: { 2: 'dificil', 3: 'bom' },
      checkinsSemanais: { 2: { semana: 2, data: dia(SEGUNDAS[1], 6), fatos: { fadiga: 4, sono: 2, percepcao: 4, dor: true, dorRegiao: 'joelho' } }, 3: { semana: 3, data: dia(SEGUNDAS[2], 6), fatos: { fadiga: 2, sono: 3, percepcao: 3, dor: false } } },
      checkinDiario: { [dia(SEGUNDAS[3], 0)]: { energia: 1, pernas: 3, dor: 1 }, [dia(SEGUNDAS[3], 1)]: { energia: 2, pernas: 2, dor: 3 } } });
    ok(r3.checkinsSemanais.length === 2 && r3.checkinsSemanais[0].resposta === 'dificil' && r3.checkinsSemanais[0].fadiga === 4 && r3.checkinsSemanais[0].dor === true,
      'check-ins semanais: resposta, fadiga, sono, percepção e dor (sim/não)');
    ok(!JSON.stringify(r3).includes('joelho'), 'região da dor nunca vai no resumo');
    ok(r3.checkinDiario14dias.dias === 2 && r3.checkinDiario14dias.energiaBaixa === 1 && r3.checkinDiario14dias.pernasPesadas === 1 && r3.checkinDiario14dias.dorForte === 1, 'check-in diário dos últimos 14 dias resumido em contagens');
  }
  // ---------- 8. privacidade ----------
  {
    const r = resumo({ ...base, atividadesLivres: [{ tipo: 'corrida', data: dia(SEGUNDAS[2], 3), distKm: 5.2, gpsRunId: 'run_x' }] });
    const txt = JSON.stringify(r);
    ok(!/\d{4}-\d{2}-\d{2}/.test(txt) && !/\d{1,2}\/\d{2}/.test(txt), 'sem datas exatas (só "semanas atrás")');
    ok(!/lat|lng|pontos|timestamp|run_|gpsRunId|tenis|shoe/i.test(txt), 'sem GPS, rota, ids de gravação ou tênis');
    ok(!/\b(Seg|Ter|Qua|Qui|Sex|Sáb|Dom)\b/.test(txt), 'sem a chave do dia');
  }
  // ---------- 9. determinismo ----------
  {
    const a = JSON.stringify(resumo(base));
    const embaralhado = { ...base, treinos: base.treinos.slice().reverse(), corridaProgress: Object.fromEntries(Object.entries(prog).reverse()) };
    ok(a === JSON.stringify(resumo(base)) && a === JSON.stringify(resumo(embaralhado)), 'mesmo histórico → mesmo resumo (inclusive em outra ordem)');
  }
  // ---------- 10. tipos do motor e do catálogo ----------
  {
    const t = (type, sessao) => G.iaHcTipo(type, sessao);
    ok(t('Rodagem Leve') === 'leve' && t('Longão') === 'longao' && t('Intervalado') === 'intervalado' && t('Limiar') === 'limiar' && t('Fartlek Leve') === 'fartlek'
      && t('Regenerativo') === 'regenerativo' && t('Qualquer', 'RUN_TEMPO_THRESHOLD') === 'limiar', 'tipos de sessão do motor e do catálogo reconhecidos');
  }
  if (process.env.EXEMPLO === '1') {
    const p3 = { ...prog }; delete p3[treinos[0].day];
    const runs2 = { ...runs, run_1: gravacaoIntervalado('run_1', 4, 300) };
    console.log(JSON.stringify(resumo({ ...base, corridaProgress: p3, gpsRuns: runs2, checkins: { 3: 'dificil' },
      checkinsSemanais: { 3: { semana: 3, data: dia(SEGUNDAS[2], 6), fatos: { fadiga: 4, sono: 2, percepcao: 4, dor: false } } },
      checkinDiario: { [dia(SEGUNDAS[3], 0)]: { energia: 1, pernas: 3, dor: 1 } }, atividadesLivres: [{ tipo: 'corrida', data: dia(SEGUNDAS[2], 3), distKm: 5.2 }] }), null, 1));
  }
  semErro();
  process.exit(process.exitCode || 0);
})();
