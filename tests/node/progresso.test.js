// Progresso (pacote visual): período Semana/Mês/Ciclo com comparação justa, evolução, atividades com filtro e
// histórico completo. Só dados registrados; nada de tonelagem.
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { PERFIS, BASE } = require('../harness/perfis.js');
const perfil = (n) => ({ ...BASE, ...PERFIS.find(p => p[0].startsWith(n))[1] });

(async () => {
  const T = await carregarApp(['state', 'qv2Aplicar', 'criarAthleteProfile', 'gerarPrimeiroPlanoV2', 'renderProgressoV2', 'frPeriodoProg',
    'frKmEntre', 'renderPerfilV2Content', 'renderPreferenciasV2', 'renderContaV2', 'registrarAtividadeLivre', 'frFiltrarAtividades', 'listarAtividades', 'frHistoricoAtividades', 'corridaProgressKey', 'renderOnboardingScreen', 'qv2Render']);
  const S = T.state;
  S.athleteProfile = T.criarAthleteProfile(); S.hybridPlanData = null; S.treinos = []; S.musculacao = {};
  await T.qv2Aplicar(perfil('08')); const plano = await T.gerarPrimeiroPlanoV2();

  // boas-vindas e plano pronto (NOVA-04)
  const bv = T.renderOnboardingScreen();
  ok(/fr-bv-marca/.test(bv) && /id="obStart"/.test(bv) && /id="obLogin"/.test(bv) && !/#FF5A1F/i.test(bv), 'boas-vindas: marca, Começar, Já tenho uma conta, sem laranja');
  S.qv2 = { fase: 'pronto', resultado: plano, R: {} };
  const pr = T.qv2Render();
  const nC = (plano.semana.corridaWeek || []).length;
  ok(/Seu plano está pronto/.test(pr) && new RegExp(nC + ' corrida').test(pr) && (pr.match(/class="fr-prdia"/g) || []).length === 7 && /id="qv2VerTreino"/.test(pr), 'plano pronto: resumo, corridas e semana em ícones');
  S.qv2 = null;
  S.corridaProgress = {}; S.atividadesLivres = []; S.workoutSessionsLog = [];

  // período: semana atual até hoje × mesmo trecho da semana anterior (hoje = segunda 05/10/2026)
  const P = T.frPeriodoProg('semana');
  ok(P.ini === '2026-10-05' && P.fim === '2026-10-05' && P.iniAnt === '2026-09-28' && P.fimAnt === '2026-09-28', 'semana compara com o mesmo trecho da semana anterior');
  const M = T.frPeriodoProg('mes');
  ok(M.ini === '2026-10-01' && M.iniAnt === '2026-09-01' && M.fimAnt === '2026-09-05', 'mês compara com os mesmos dias do mês anterior');

  await T.registrarAtividadeLivre({ id: 'run:a', tipo: 'corrida', data: '2026-10-05', distKm: 5, tempoSeg: 1500 });
  await T.registrarAtividadeLivre({ id: 'run:b', tipo: 'corrida', data: '2026-09-28', distKm: 4, tempoSeg: 1300 });
  S.workoutSessionsLog = [{ id: 'm1', data: '2026-10-05', title: 'Superiores', series: 12, exercicios: [] }];
  ok(Math.round(T.frKmEntre(P.ini, P.fim)) === 5 && Math.round(T.frKmEntre(P.iniAnt, P.fimAnt)) === 4, 'km por período vem das atividades registradas');

  S.progModo = 'semana';
  const h = T.renderProgressoV2();
  ok(/Esta semana/.test(h) && /5 km/.test(h) && /\+25%/.test(h), 'resumo da semana com comparação (+25%)');
  ok(/data-progmodo="ciclo"/.test(h) && /Evolução/.test(h) && /Recuperação/.test(h) && /Ver histórico completo/.test(h), 'Semana/Mês/Ciclo, evolução, recuperação e acesso ao histórico');
  ok(!/kg ?×|tonelada|volume total/i.test(h.replace(/Última vez[^<]*/g, '')), 'sem tonelagem no Progresso');

  const todas = T.listarAtividades();
  ok(T.frFiltrarAtividades(todas, 'forca').every(a => a.tipo === 'musculacao') && T.frFiltrarAtividades(todas, 'livres').every(a => a.livre), 'filtros Força e Livres');
  S.progHistorico = true; S.histFiltro = 'todas';
  const hh = T.renderProgressoV2();
  ok(/Histórico/.test(hh) && /Outubro 2026/.test(hh) && /data-histdia="2026-10-05"/.test(hh) && /Corrida livre/.test(hh), 'histórico completo com mês, semana e atividades agrupadas');
  S.histDia = '2026-10-06';
  ok(/Nenhuma atividade neste dia/.test(T.renderProgressoV2()), 'dia sem atividade mostra estado vazio');

  const pf = T.renderPerfilV2Content();
  ok(/Plano híbrido/.test(pf) && (pf.match(/fr-pnivel"/g) || []).length === 2 && /Histórico de mudanças/.test(pf) && /Dados e backup/.test(pf), 'Perfil: plano, níveis separados, Meu treino e Minha conta');
  ok(!/data-perfilgo="turma"/.test(pf) && /Configurações/.test(pf), 'Perfil não oferece grupos como a nova rede social');
  ok(!/Turma/.test(T.renderContaV2()), 'Conta não promete a antiga Turma');
  S.preferencias = { vozKm: false, autoPause: true, aviso: { modo: 'vibracao', volume: 0.7 } };
  S.vozAtiva = false;
  const cfg = T.renderPreferenciasV2();
  ok(['Voz e corrida', 'Descanso da musculação', 'Exibição', 'Conta e dados'].every(x => cfg.includes(x)), 'Configurações agrupadas por assunto');
  ok(/aria-label="Voz nos treinos" aria-checked="false"/.test(cfg) && /aria-label="Voz a cada km" aria-checked="false"/.test(cfg) && /aria-label="Pausa automática na corrida" aria-checked="true"/.test(cfg), 'controles acessíveis refletem as preferências reais');
  ok(!/id="avisoVolume"/.test(cfg) && /id="avisoTestar"/.test(cfg), 'vibração não oferece volume; teste de aviso permanece');
  ok(/data-perfilgo="conta"/.test(cfg) && /data-perfilgo="maisOpcoes"/.test(cfg), 'Configurações mantém acesso à conta e ao backup');
  semErro();
  process.exit(process.exitCode || 0);
})();
