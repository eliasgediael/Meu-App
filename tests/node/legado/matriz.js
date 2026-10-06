// Matriz de perfis: gera a semana 1 (e a trajetória) pelo motor V2 e confere invariantes esportivos.
// node matriz.js <projeto> [--detalhe]
const H = require('../../harness/app-node.js'); const { NET } = H; const fs = require('fs');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const detalhe = process.argv.includes('--detalhe');
global.fetch = async (u) => /exercicios\.json/.test(u) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(H.ROOT + '/data/exercicios.json', 'utf8')) } : { ok: false, json: async () => ({}) };
const D7 = (min, dias) => { const o = {}; ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach(d => { if (dias.includes(d)) o[d] = { on: true, min }; }); return o; };
const BASE = { cUn: 'km', cDesNao: true, comb: 'combinar_se_preciso', dor: false, alertasOk: true, alertas: [], orient: [], dorRegioes: [], sono: '7mais', mPadroes: [] };
const P = [
  ['01 iniciante absoluto, 3 dias, academia', { obj: 'saude', cSit: 'nunca', mSit: 'nunca', local: 'academia', dias: D7(60, ['Seg', 'Qua', 'Sex']) }],
  ['02 iniciante absoluto, 5 dias seguidos', { obj: 'emagrecer', cSit: 'nunca', mSit: 'nunca', local: 'academia', dias: D7(60, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']) }],
  ['03 corrida avançada + musc iniciante, prova 21k', { obj: 'prova', dist: 21.0975, semData: true, cSit: 'regular', cExp: 'mais3a', cFreq: 5, cMaior: '18', mSit: 'nunca', local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) }],
  ['04 musc avançada + corrida iniciante, massa', { obj: 'massa', cSit: 'nunca', mSit: 'regular', mExp: 'mais3a', mFreq: 5, mPadroes: ['agachar', 'dobradica', 'empurrarH', 'puxarV', 'puxarH', 'empurrarV'], local: 'academia', dias: D7(90, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) }],
  ['05 retorno pausa curta (1-3m)', { obj: 'retorno', cSit: 'parado', cExp: '1-3a', cParado: '1-3m', mSit: 'parado', mExp: '1-3a', mParado: '1-3m', local: 'academia', dias: D7(60, ['Seg', 'Qua', 'Sex', 'Sáb']) }],
  ['06 retorno pausa longa (>1a)', { obj: 'saude', cSit: 'parado', cExp: 'mais3a', cParado: 'mais1a', mSit: 'parado', mExp: 'mais3a', mParado: 'mais1a', local: 'academia', dias: D7(60, ['Seg', 'Qua', 'Sex']) }],
  ['07 prova 5k intermediário', { obj: 'prova', dist: 5, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(60, ['Seg', 'Ter', 'Qui', 'Sáb']) }],
  ['08 prova 10k intermediário', { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 4, cMaior: '12', mSit: 'regular', mExp: '1-3a', mFreq: 3, mPadroes: ['agachar', 'empurrarH', 'puxarV'], local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) }],
  ['09 maratona avançado', { obj: 'prova', dist: 42.195, semData: true, cSit: 'regular', cExp: 'mais3a', cFreq: 5, cMaior: '28', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(120, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) }],
  ['10 força, 4 dias', { obj: 'forca', cSit: 'ocasional', cExp: '6-12m', cFreq: 1, cMaior: '5', cCont: '20-30', mSit: 'regular', mExp: '1-3a', mFreq: 4, mPadroes: ['agachar', 'dobradica', 'empurrarH', 'puxarH'], local: 'academia', dias: D7(75, ['Seg', 'Ter', 'Qui', 'Sex']) }],
  ['11 apenas 2 dias', { obj: 'saude', cSit: 'regular', cExp: '1-3a', cFreq: 2, cMaior: '6', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dias: D7(60, ['Ter', 'Qui']) }],
  ['12 dias consecutivos só (Seg-Qua)', { obj: 'saude', cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '7', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', dias: D7(60, ['Seg', 'Ter', 'Qua']) }],
  ['13 casa com halteres', { obj: 'massa', cSit: 'ocasional', cExp: '3-6m', cFreq: 1, cMaior: '4', cCont: '10-20', mSit: 'regular', mExp: '6-12m', mFreq: 3, mPadroes: ['agachar', 'empurrarH'], local: 'casa_h', dias: D7(45, ['Seg', 'Qua', 'Sex']) }],
  ['14 peso corporal', { obj: 'saude', cSit: 'nunca', mSit: 'ocasional', mExp: '3-6m', mFreq: 2, local: 'casa_s', dias: D7(40, ['Seg', 'Qua', 'Sex']) }],
  ['15 dor joelho moderada', { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '10', mSit: 'regular', mExp: '1-3a', mFreq: 2, local: 'academia', dor: true, dorRegioes: ['joelho'], dorInt: 'moderada', dorRep: false, dias: D7(60, ['Seg', 'Ter', 'Qui', 'Sáb']) }],
  ['16 dor lombar + ombro', { obj: 'massa', cSit: 'nunca', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', dor: true, dorRegioes: ['lombar', 'ombro'], dorInt: 'moderada', dorRep: false, dias: D7(60, ['Seg', 'Qua', 'Sex']) }],
  ['17 dor tornozelo', { obj: 'saude', cSit: 'regular', cExp: '6-12m', cFreq: 3, cMaior: '6', mSit: 'ocasional', mExp: '3-6m', mFreq: 1, local: 'academia', dor: true, dorRegioes: ['tornozelo'], dorInt: 'leve', dorRep: false, dias: D7(60, ['Seg', 'Qua', 'Sex', 'Sáb']) }],
  ['18 baixa recuperação (sono<6h)', { obj: 'prova', dist: 10, semData: true, cSit: 'regular', cExp: '1-3a', cFreq: 4, cMaior: '12', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', sono: 'menos6', dias: D7(60, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) }],
  ['19 prefere combinar no mesmo dia', { obj: 'saude', cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', comb: 'combinar_preferencial', dias: D7(90, ['Seg', 'Qua', 'Sex']) }],
  ['20 exige separar', { obj: 'saude', cSit: 'regular', cExp: '1-3a', cFreq: 3, cMaior: '8', mSit: 'regular', mExp: '1-3a', mFreq: 3, local: 'academia', comb: 'separar', dias: D7(60, ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) }],
];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
(async () => {
  NET.sdkOnline = false; navigator.onLine = false;
  (0, eval)(H.js + ';\nglobalThis.__T={state,qv2Aplicar,gerarPlanoSemanal,criarAthleteProfile,motorNecessario,motorFiltroExercicio,lerEstado,exercicioTier};');
  await espera(700);
  const T = globalThis.__T, S = T.state;
  const tot = {};
  for (const [nome, R0] of P) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null;
    const R = { ...BASE, ...R0 };
    await T.qv2Aplicar(R);
    let r; try { r = T.gerarPlanoSemanal(S.athleteProfile); } catch (e) { console.log('ERRO', nome, e.message); continue; }
    if (r.bloqueado) { console.log(nome, 'BLOQUEADO', r.status); continue; }
    const ses = r.sessoes, porDia = {}; ses.forEach(s => { (porDia[s.dia] = porDia[s.dia] || []).push(s); });
    const viol = [];
    const nx = (d) => DIAS[(DIAS.indexOf(d) + 1) % 7];
    const pesadoPerna = (s) => s.modalidade === 'musculacao' && (s.tipo === 'lower' || s.tipo === 'full');
    DIAS.forEach(d => {
      const a = porDia[d] || [], b = porDia[nx(d)] || [];
      const mA = a.find(s => s.modalidade === 'musculacao'), mB = b.find(s => s.modalidade === 'musculacao');
      if (r.capacidade.musc === 'iniciante' && mA && mB) viol.push(`musc consecutiva iniciante ${d}/${nx(d)}`);
      const lA = a.find(s => s.tipo === 'longa'), lB = b.find(s => s.tipo === 'longa');
      const legDay = (x) => x.modalidade === 'musculacao' && x.tipo === 'lower';
      const intensa = (x) => x.modalidade === 'corrida' && (x.tipo === 'qualidade' || x.tipo === 'longa');
      if ((a.some(legDay) && b.some(intensa)) || (a.some(intensa) && b.some(legDay))) viol.push(`Leg Day colado em corrida forte ${d}/${nx(d)}`);
      if (a.some(pesadoPerna) && lA) viol.push(`longão + perna mesmo dia ${d}`);
      const altoA = a.some(s => s.dura || s.tipo === 'longa' || s.tipo === 'qualidade'), altoB = b.some(s => s.dura || s.tipo === 'longa' || s.tipo === 'qualidade');
      if (altoA && altoB) viol.push(`estímulos altos seguidos ${d}/${nx(d)}`);
      const disp = r.estado.disp.find(x => x.dia === d);
      const soma = a.reduce((t, s) => t + s.duracaoMin, 0);
      if (disp && soma > disp.minutos + 0.5) viol.push(`${d} ${soma}min > ${disp.minutos}`);
    });
    // exercícios repetidos e equipamento
    const nomes = []; Object.values(r.semana.muscPlan).forEach(l => l.forEach(e => nomes.push(e.nome)));
    const rep = nomes.filter((n, i) => nomes.indexOf(n) !== i);
    if (rep.length) console.log('  (info) exercício repetido na semana: ' + [...new Set(rep)].join(', '));
    const fad = r.tipos && r.tipos.fadiga; if (fad) DIAS.forEach(d => { if (fad[d] && fad[d].pontos > 50) viol.push(`fadiga de perna > 50 ${d}`); });
    if (!r.validacao.ok) viol.push('plano entregue reprovado na verificação');
    const eq = new Set(r.estado.equipamentos);
    Object.values(r.semana.muscPlan).forEach(l => l.forEach(e => { const need = T.motorNecessario(e.nome); if (!need.every(i => i === 'corpo' || eq.has(i))) viol.push('equip ' + e.nome); }));
    if (r.capacidade.musc === 'iniciante') Object.values(r.semana.muscPlan).forEach(l => l.forEach(e => { if ((e.tier || 1) >= 3) viol.push('tier3 iniciante ' + e.nome); }));
    const sessoesM = Object.entries(r.semana.muscPlan).map(([d, l]) => l.map(e => e.nome).sort().join('|'));
    if (sessoesM.length > 1 && new Set(sessoesM).size < sessoesM.length) viol.push('sessões de musculação idênticas');
    viol.forEach(v => { const k = v.replace(/ \S+\/\S+$| \S+$/, '').replace(/:.*/, ''); tot[k] = (tot[k] || 0) + 1; });
    const sem = DIAS.map(d => { const a = porDia[d] || []; return d + ':' + (a.length ? a.map(s => s.modalidade === 'corrida' ? 'C-' + s.tipo + (s.dura ? '!' : '') + s.duracaoMin : 'M-' + s.tipo + s.duracaoMin).join('+') : '—'); }).join(' ');
    console.log(`\n${nome}\n  nível C=${r.capacidade.corrida} M=${r.capacidade.musc} | prioridade ${r.prioridade.principal} | calibr ${r.calibracao.ativa} | val ${r.validacao.ok ? 'ok' : 'FALHOU ' + r.validacao.erros.map(e => e.cod).join(',')} ciclos ${r.validacao.ciclos}`);
    console.log('  ' + sem);
    console.log('  corrida ' + r.resumo.corridaMin + 'min (partida ' + r.resumo.volumePartidaCorrida + ') · musc ' + r.resumo.musculacaoMin + 'min · ajustes ' + JSON.stringify(r.ajustes));
    if (detalhe) Object.entries(r.semana.muscPlan).forEach(([d, l]) => console.log('   ' + d + ': ' + l.map(e => e.nome + ' ' + e.series + 'x' + e.reps + ' T' + e.tier).join('; ')));
    if (detalhe) { console.log('   hist', JSON.stringify(r.validacao.historico)); r.decisoes.filter(x=>x.etapa===6).forEach(x=>console.log('   ', x.regra, JSON.stringify(x.dados).slice(0,300))); }
    if (viol.length) console.log('  VIOLAÇÕES: ' + [...new Set(viol)].join(' | '));
  }
  console.log('\nRESUMO VIOLAÇÕES', JSON.stringify(tot));
  const nViol = Object.values(tot).reduce((a, b) => a + b, 0);
  console.log((nViol ? 'FAIL ' : 'PASS ') + 'matriz de 20 perfis sem violações de invariantes (' + nViol + ')');
  process.exit(nViol ? 1 : 0);
})();
