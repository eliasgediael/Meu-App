// Caracterização da musculação: sugestão de carga para a próxima série, recorde e trocas de exercício
// (nível, dor e filtro de equipamento).
const { carregarApp, ok, semErro } = require('../harness/carregar.js');
const { conferir } = require('../harness/snapshot.js');

(async () => {
  const T = await carregarApp(['state', 'suggestedForExercise', 'verificarRecorde', 'alternativasDoExercicio', 'exerciciosCompletos'], { espera: 900 });
  const S = T.state;

  // ---------- sugestão de carga ----------
  {
    const ex = { nome: 'Supino reto com barra', grupo: 'Peito', series: '3', reps: '10', carga: '40', repdbId: '0025' };
    const cenarios = {
      sem_historico: null,
      cumpriu_tudo_sem_pse: [{ peso: 40, reps: 10 }, { peso: 40, reps: 10 }, { peso: 40, reps: 10 }],
      cumpriu_tudo_pse_7: [{ peso: 40, reps: 10, pse: 7 }, { peso: 40, reps: 10, pse: 7 }, { peso: 40, reps: 10, pse: 7 }],
      cumpriu_tudo_pse_9_5: [{ peso: 40, reps: 10, pse: 9.5 }, { peso: 40, reps: 10, pse: 9.5 }, { peso: 40, reps: 10, pse: 9.5 }],
      abaixo_80_da_meta: [{ peso: 40, reps: 7 }, { peso: 40, reps: 6 }, { peso: 40, reps: 6 }],
      um_pouco_abaixo: [{ peso: 40, reps: 10 }, { peso: 40, reps: 9 }, { peso: 40, reps: 8 }],
      piramide_crescente: [{ peso: 30, reps: 10 }, { peso: 35, reps: 10 }, { peso: 40, reps: 10 }],
      acima_da_meta: [{ peso: 40, reps: 13 }, { peso: 40, reps: 12 }, { peso: 40, reps: 12 }],
    };
    const out = {};
    for (const [nome, sets] of Object.entries(cenarios)) {
      S.historicoCarga = sets ? { '0025': [{ data: '2026-10-01', sets }] } : {};
      out[nome] = T.suggestedForExercise(ex);
    }
    S.historicoCarga = { '0025': [{ data: '2026-10-05', sets: [{ peso: 42.5, reps: 8 }] }] };
    out.ja_registrado_hoje = T.suggestedForExercise(ex);
    conferir('forca-sugestao-de-carga', out);
  }

  // ---------- recorde ----------
  {
    const ex = { id: 'x1', nome: 'Supino reto com barra', grupo: 'Peito', repdbId: '0025' };
    S.historicoCarga = { '0025': [{ data: '2026-09-28', sets: [{ peso: 40, reps: 8 }, { peso: 42.5, reps: 6 }] }] };
    const out = {
      mais_peso: T.verificarRecorde(ex, 45, 5), mesmo_peso_mais_reps: T.verificarRecorde(ex, 42.5, 7), mesmo_peso_menos_reps: T.verificarRecorde(ex, 42.5, 5),
      menos_peso: T.verificarRecorde(ex, 40, 12),
    };
    S.historicoCarga = {};
    out.sem_historico = T.verificarRecorde(ex, 20, 10);
    conferir('forca-recorde', out);
  }

  // ---------- trocas ----------
  {
    const exs = [
      { nome: 'Supino reto com barra', grupo: 'Peito', repdbId: '0025' }, { nome: 'Agachamento livre com barra', grupo: 'Pernas', repdbId: '0043' },
      { nome: 'Puxada frontal na polia', grupo: 'Costas', repdbId: '0198' }, { nome: 'Leg press 45 graus', grupo: 'Pernas', repdbId: '0739' },
      { nome: 'Desenvolvimento com halteres', grupo: 'Ombro' },
    ];
    const out = {};
    for (const nivel of ['iniciante', 'intermediario', 'avancado']) for (const lesao of ['', 'joelho']) for (const filtro of [null, 'maquina', 'corpo']) {
      S.hybridPlanData = { draft: { nivelMusc: nivel, lesao } }; S.equipItens = null;
      const k = `${nivel}${lesao ? '-dor_' + lesao : ''}${filtro ? '-' + filtro : ''}`;
      out[k] = Object.fromEntries(exs.map(e => [e.nome, T.alternativasDoExercicio(e, 'Dom', 6, filtro).map(a => a.nome)]));
    }
    S.hybridPlanData = null;
    conferir('forca-trocas', out);
    const inic = out['iniciante']['Puxada frontal na polia'];
    ok(!inic.some(n => /barra fixa/i.test(n) && !/assistid/i.test(n)), 'iniciante não recebe barra fixa (sem ser assistida) como troca');
  }

  ok(T.exerciciosCompletos().length > 300, 'catálogo carregado (' + T.exerciciosCompletos().length + ' exercícios)');
  semErro();
  process.exit(process.exitCode || 0);
})();
