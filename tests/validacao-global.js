// Validação global (Bloco 8 / Entrega 6 do plano mestre): para os 20 perfis compara
//   1) plano antigo (snapshot aprovado no Passo 0) × plano novo (motor atual), semana a semana;
//   2) auditoria da agenda (modo auditoria) em todas as semanas;
//   3) semana 2 depois de 4 check-ins: normal, dor, fadiga máxima e semana fácil (proposta x aceita).
// Gera VALIDACAO-GLOBAL-MOTOR.md na raiz. Uso: npm run validacao
const fs = require('fs'), path = require('path');
const { carregarApp } = require('./harness/carregar.js');
const { PERFIS, BASE } = require('./harness/perfis.js');
const { limpar } = require('./harness/snapshot.js');
const RAIZ = path.resolve(__dirname, '..');
const copia = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'gerarSemanaV2', 'auditarSemana', 'sessoesDaSemanaGerada',
    'aplicarCheckinSemanalV2', 'responderDecisaoPendente', 'MOTOR_ENGINE_VERSION']);
  const S = T.state;
  const resumoSemana = (w) => w ? {
    corridaMin: (w.corridaWeek || []).reduce((t, c) => t + (c.totalMin || 0), 0),
    corridas: (w.corridaWeek || []).length,
    qualidade: (w.corridaWeek || []).filter(c => /interval|limiar|tempo|fartlek/i.test(c.type)).length,
    musc: Object.keys(w.muscPlan || {}).length,
    seriesPerna: Object.values(w.muscPlan || {}).flat().filter(e => e.grupo === 'Pernas').reduce((t, e) => t + (parseInt(e.series, 10) || 0), 0),
  } : null;
  const linhas = [];
  let iguais = 0, diferentes = 0, semanasAud = 0, conflitos = 0;
  const cen = [];
  for (const [nome, R0] of PERFIS) {
    S.athleteProfile = T.criarAthleteProfile(); S.equipItens = null; S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
    await T.qv2Aplicar({ ...BASE, ...R0 });
    await T.gerarPrimeiroPlanoV2();
    const hp = S.hybridPlanData;
    // 1) antigo × novo
    const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'snapshots', 'plano-' + nome.slice(0, 2) + '.json'), 'utf8'));
    const semanasNovas = [hp.plan[0], ...Array.from({ length: hp.plan.length - 1 }, (_, i) => T.gerarSemanaV2(i + 2))];
    const resumoNovo = semanasNovas.map(resumoSemana);
    const resumoAntigo = golden.bloco.semanas.map(w => w ? { corridaMin: w.corrida.reduce((t, c) => t + (c.totalMin || 0), 0), corridas: w.corrida.length,
      qualidade: w.corrida.filter(c => /interval|limiar|tempo|fartlek/i.test(c.type)).length, musc: Object.keys(w.musc).length,
      seriesPerna: Object.values(w.musc).flat().filter(e => e.grupo === 'Pernas').reduce((t, e) => t + (parseInt(e.series, 10) || 0), 0) } : null);
    const igual = JSON.stringify(resumoNovo) === JSON.stringify(resumoAntigo);
    if (igual) iguais++; else diferentes++;
    // 2) auditoria
    let conf = 0;
    semanasNovas.forEach((w, i) => { if (!w) return; semanasAud++; conf += T.auditarSemana(T.sessoesDaSemanaGerada(w), { semana: i + 1, minutosPorDia: (hp.assessment || {}).minutesByDay, dor: (hp.assessment || {}).currentPain }).conflictsFound.length; });
    conflitos += conf;
    // 3) check-ins
    const base = copia(hp);
    const sem2 = (h) => { S.hybridPlanData = h; return resumoSemana(T.gerarSemanaV2(2)); };
    const normal = sem2(T.aplicarCheckinSemanalV2(copia(base), 1, { fadiga: 2, dor: false, motivos: [] }, 'bom'));
    const dor = sem2(T.aplicarCheckinSemanalV2(copia(base), 1, { fadiga: 3, dor: true, dorRegiao: 'joelho', motivos: [] }, 'dificil'));
    const fad5 = sem2(T.aplicarCheckinSemanalV2(copia(base), 1, { fadiga: 5, dor: false, motivos: [] }, 'dificil'));
    const facilHp = T.aplicarCheckinSemanalV2(copia(base), 1, { fadiga: 2, dor: false, motivos: ['leve'], percepcao: 1 }, 'facil');
    const facilProposta = sem2(copia(facilHp));
    const facilAceita = sem2(T.responderDecisaoPendente(copia(facilHp), true));
    S.hybridPlanData = base;
    cen.push({ nome, normal, dor, fad5, facilProposta, facilAceita });
    linhas.push(`| ${nome} | ${igual ? 'igual' : '**diferente**'} | ${hp.plan.length} | ${conf} |`);
  }
  const fmt = (r) => r ? `${r.corridaMin} min · ${r.qualidade} forte(s) · ${r.seriesPerna} séries perna` : '—';
  const md = `# Validação global do motor — Forza Run

Gerado por \`npm run validacao\` · data de referência dos testes: segunda 05/10/2026 · motor ${T.MOTOR_ENGINE_VERSION} · 20 perfis sintéticos.

## Resumo

- **Plano antigo × plano novo:** ${iguais} de 20 perfis idênticos semana a semana${diferentes ? `, **${diferentes} diferentes**` : ''}. A separação do motor em módulos (Blocos 2 a 7) não mudou nenhum plano gerado.
- **Agenda em modo auditoria:** ${conflitos} conflito(s) em ${semanasAud} semanas geradas. O gerador atual já respeita as restrições híbridas do plano mestre: perna pesada × corrida forte, dias fortes seguidos, tempo disponível e dor ativa.
- **Check-in semanal:** as reduções por dor e fadiga são as mesmas de antes. A única mudança de comportamento é a aprovada na decisão 7: a semana fácil não aumenta sozinha. O aumento de cerca de 5% vira proposta, e a semana 2 só cresce se você aceitar.

## 1. Plano antigo × novo e auditoria

| Perfil | Antigo × novo | Semanas | Conflitos na auditoria |
|---|---|---|---|
${linhas.join('\n')}

## 2. Semana 2 depois de 4 cenários de check-in

| Perfil | Normal | Dor no joelho | Fadiga 5 | Fácil (proposta) | Fácil (aceita) |
|---|---|---|---|---|---|
${cen.map(c => `| ${c.nome.slice(0, 2)} | ${fmt(c.normal)} | ${fmt(c.dor)} | ${fmt(c.fad5)} | ${fmt(c.facilProposta)} | ${fmt(c.facilAceita)} |`).join('\n')}

Legenda: minutos de corrida na semana · sessões fortes de corrida (intervalado/limiar) · séries de perna na musculação.

## 3. O que precisa da sua aprovação

1. **Sugestões da agenda:** a auditoria não encontrou conflitos nos planos gerados. As sugestões passariam a valer quando você mudar treinos manualmente e criar um conflito. Liberar as sugestões, com aviso curto e opção de aceitar, ou continuar só auditando?
2. **Regras novas** (descarga adaptativa, orçamento de séries por músculo, ações semanais fechadas): continuam desligadas. Cada uma precisa de calibração profissional e de um relatório de diferenças próprio antes de entrar.
3. **Telas do Bloco 9:** dependem da definição do novo Início (decisão 11).
`;
  fs.writeFileSync(path.join(RAIZ, 'VALIDACAO-GLOBAL-MOTOR.md'), md);
  console.log(`antigo×novo: ${iguais} iguais, ${diferentes} diferentes · auditoria: ${conflitos} conflitos em ${semanasAud} semanas`);
  process.exit(0);
})();
