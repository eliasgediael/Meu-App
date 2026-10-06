// Navegador: histórico de musculação (detalhes, menu, correção com troca de exercício, exclusão),
// corrida concluída (ações do card, correção, exclusão), artes de compartilhamento e filtros do catálogo.
const { abrirApp, ok, CHROME } = require('../harness/navegador.js');

(async () => {
  if (!CHROME) { console.log('SKIP testes de navegador: Google Chrome não encontrado (defina CHROME_PATH)'); return; }
  const app = await abrirApp();
  if (app && app.indisponivel) { console.log('SKIP testes de navegador: ' + app.indisponivel); return; }
  const { page } = app;
  const r = await page.evaluate(async () => {
    const w = (ms) => new Promise(r => setTimeout(r, ms));
    const out = {};
    const L = state.workoutSessionsLog;
    const fichaMusc = JSON.stringify(state.musculacao), planoCorrida = JSON.stringify(state.treinos);

    // --- histórico de musculação ---
    L.push({ id: 'musc_antigo_teste', day: 'Seg', data: '2026-01-05', volume: 3000, series: 12, duracaoSeg: 2400, cargaMax: 40, recordes: 0, exercicios: [{ nome: 'Exercício que não existe', grupo: 'Peito', series: '3', reps: '10', carga: '20' }] });
    const vA = normalizarSessaoMuscHistorico(L[L.length - 1]);
    out.antigoSemDetalhe = !vA.temDetalhe;
    abrirMuscHistoryV2('musc_antigo_teste'); await w(200);
    out.msgAntigo = /não possui detalhes por série/.test(document.querySelector('.sheet').textContent);
    closeSheet();
    out.artesTreinoAntigo = artesMusculacao(vA).map(a => a.nome);
    state.tab = 'progresso'; state.progDetalhe = 'musc'; render(); await w(300);
    out.linhasHist = document.querySelectorAll('[data-muschistopen]').length;
    document.querySelector('[data-muschistmenu]').click(); await w(200);
    out.menuSoMenu = !!document.querySelector('[data-mhop=corrigir]') && !document.querySelector('#mhShare');
    closeSheet();
    const q = L.find(x => normalizarSessaoMuscHistorico(x).temDetalhe);
    out.temTreinoComSeries = !!q;
    if (q) {
      const nLogs = L.length;
      abrirCorrigirAtividade(q); await w(200);
      document.querySelector('[data-cttroca="0"]').click(); await w(200);
      document.querySelector('[data-selaba="todos"]').click(); await w(100);
      document.querySelector('[data-selequip="maquina"]').click(); await w(100);
      out.maquinas = document.querySelectorAll('#selLista [data-selpick]').length;
      document.querySelector('[data-selequip="corpo"]').click(); await w(100);
      out.corpo = document.querySelectorAll('#selLista [data-selpick]').length;
      document.querySelector('[data-selequip=""]').click(); await w(100);
      const bi = document.querySelector('#selBusca'); bi.value = 'leg press 45'; bi.dispatchEvent(new Event('input')); await w(100);
      out.legpress = [...document.querySelectorAll('#selLista [data-selpick] .t')].map(x => x.firstChild.textContent);
      bi.value = 'supino reto na maquina'; bi.dispatchEvent(new Event('input')); await w(100);
      [...document.querySelectorAll('#selLista [data-selpick]')].find(x => /Supino reto na máquina/.test(x.textContent)).click(); await w(400);
      const okBtn = document.querySelector('.sheet #cfOk'); if (okBtn) { okBtn.click(); await w(300); }
      document.querySelector('#ctSalvar').click(); await w(300);
      out.trocou = L.find(x => x.id === q.id).exercicios.some(e => e.nome === 'Supino reto na máquina');
      out.semDuplicar = L.length === nLogs;
    }
    excluirTreinoRegistrado(state.workoutSessionsLog.find(x => x.id === 'musc_antigo_teste'));
    out.excluiuSoORegistro = !state.workoutSessionsLog.some(x => x.id === 'musc_antigo_teste');
    out.fichaIntacta = JSON.stringify(state.musculacao) === fichaMusc;

    // --- corrida concluída ---
    const key = Object.keys(state.corridaProgress).find(k => state.corridaProgress[k] && state.corridaProgress[k].gpsRunId);
    out.temCorridaGravada = !!key;
    if (key) {
      const prog = state.corridaProgress[key], runId = prog.gpsRunId;
      // a fixture tem corridas gravadas na semana anterior: abre a semana em que a corrida aconteceu
      const [dAbbr, ddmm] = key.split(' '); const [dd, mm] = ddmm.split('/').map(Number);
      const segAtual = vdotMondayOf(new Date()), dataCorrida = new Date(2026, mm - 1, dd);
      state.tab = 'meusTreinos'; state.treinosSubTab = 'corrida'; state.selectedDayMusc = dAbbr; state.weekOffset = Math.round((vdotMondayOf(dataCorrida) - segAtual) / (7 * 86400000)); render(); await w(300);
      out.cardAcoes = ['[data-sharerun]', '[data-lastrun]', '[data-corrigirrun]', '[data-excluirrun]'].map(sel => !!document.querySelector(sel));
      out.semAjustar = !document.querySelector('[data-ajustar]');
      await salvarCorrecaoCorrida(key, { km: 5.03, seg: 30 * 60 + 49, data: prog.data || '2026-10-05' });
      out.correcao = { km: prog.km, tempo: prog.tempo, pace: prog.pace, recKm: (await gpsDbGet(runId)).distancia_total_km };
      const gr = await corridaGravadaParaArte(key);
      out.artesCorrida = artesCorrida(gr).map(a => a.nome);
      await excluirCorridaRealizada(key);
      out.excluiu = !(state.corridaProgress[key] && state.corridaProgress[key].done) && !(await gpsDbGet(runId));
      out.planoIntacto = JSON.stringify(state.treinos) === planoCorrida;
    }

    // --- artes (geração real em canvas) ---
    const v = normalizarSessaoMuscHistorico(L.find(x => normalizarSessaoMuscHistorico(x).temDetalhe) || L[0]);
    out.artesMusc = [];
    for (const a of artesMusculacao(v)) { const cv = await a.gerar('story'); out.artesMusc.push(a.nome + ':' + (cv ? cv.width + 'x' + cv.height : 'null')); }
    const im = document.createElement('canvas'); im.width = 800; im.height = 600; im.getContext('2d').fillRect(0, 0, 800, 600);
    out.artesFoto = [];
    for (const a of artesComFoto({ titulo: 'Teste', grande: '42 min', sub: '16 séries', dados: [['Tempo', '42 min']] }, { im, zoom: 1.2, dx: 0.3, dy: -0.2 })) { const cv = await a.gerar('quadrado'); out.artesFoto.push(a.nome + ':' + (cv ? cv.width + 'x' + cv.height : 'null')); }

    // --- catálogo e trocas ---
    out.legPressUnico = exerciciosCompletos().filter(e => /^leg press 45/i.test(normalizeNoAccents(e.nome)) && !/unilateral/i.test(e.nome)).length;
    state.bibFiltros = { equip: 'maquina' }; out.bibMaquinas = bibFiltrada().length;
    state.bibFiltros = { equip: 'corpo' }; out.bibCorpo = bibFiltrada().length;
    state.bibFiltros = {};
    out.trocaSupino = alternativasDoExercicio({ nome: 'Supino reto com barra', grupo: 'Peito', repdbId: '0025' }, 'Dom', 3).map(e => e.nome);
    return out;
  });

  ok(r.antigoSemDetalhe && r.msgAntigo, 'treino antigo sem séries abre com a mensagem certa');
  ok(r.artesTreinoAntigo.length === 3 && !r.artesTreinoAntigo.includes('Músculos'), 'treino antigo: 3 artes, sem a de músculos');
  ok(r.linhasHist >= 5, 'histórico de musculação lista os treinos (' + r.linhasHist + ')');
  ok(r.menuSoMenu, 'os ••• abrem só o menu, sem abrir os detalhes');
  ok(r.temTreinoComSeries, 'fixture tem treino com séries registradas');
  ok(r.maquinas > 50 && r.corpo > 100, `filtros Máquina (${r.maquinas}) e Peso corporal (${r.corpo}) na troca`);
  ok(r.legpress && r.legpress.filter(n => /^Leg press 45/.test(n) && !/unilateral/i.test(n)).length === 1, 'Leg press 45° aparece uma vez só (sem duplicata de câmera)');
  ok(r.trocou && r.semDuplicar, 'corrigir troca o exercício sem duplicar o treino');
  ok(r.excluiuSoORegistro && r.fichaIntacta, 'excluir apaga só o registro; a ficha não muda');
  ok(r.temCorridaGravada, 'fixture tem corrida gravada');
  ok(r.cardAcoes && r.cardAcoes.every(Boolean), 'card da corrida concluída tem Compartilhar, Ver atividade, Corrigir e Excluir');
  ok(r.semAjustar, 'aba Treino sem botão "Ajustar"');
  ok(r.correcao && r.correcao.km === '5.03' && r.correcao.tempo === '30:49' && r.correcao.recKm === 5.03, 'corrigir corrida grava distância e tempo no registro e na gravação');
  ok(r.artesCorrida && r.artesCorrida.join() === 'Trajeto,Números,Parciais,Mapa', 'corrida gravada gera as 4 artes');
  ok(r.excluiu && r.planoIntacto, 'excluir corrida apaga o registro e mantém o treino planejado');
  ok(r.artesMusc.length === 4 && r.artesMusc.every(x => /1080x1920/.test(x)), 'artes de musculação 1080×1920 (' + r.artesMusc.join(', ') + ')');
  ok(r.artesFoto.length === 3 && r.artesFoto.every(x => /1080x1080/.test(x)), 'artes com foto no formato quadrado');
  ok(r.legPressUnico === 1, 'catálogo: um só Leg press 45°');
  ok(r.bibMaquinas > 50 && r.bibCorpo > 100, `biblioteca: Máquinas (${r.bibMaquinas}) e Peso corporal (${r.bibCorpo})`);
  ok(r.trocaSupino.includes('Supino reto na máquina'), 'trocar Supino reto com barra oferece Supino reto na máquina entre as 3 primeiras');
  if (app.errosInicio.length) console.log('AVISO erro conhecido na abertura do app (render antes de carregar os treinos): ' + app.errosInicio[0]);
  ok(!app.erros.length, 'sem erro na página durante o teste' + (app.erros.length ? ': ' + app.erros.join(' | ') : ''));
  await app.fechar();
})().catch(e => { console.log('FAIL erro no teste de navegador: ' + e.message); process.exit(1); });
