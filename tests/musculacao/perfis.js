// Perfis (respostas do questionário V2) usados nos testes. Dados fictícios.
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const dias = (o) => { const r = {}; Object.keys(o).forEach((d) => { r[d] = { on: true, min: o[d] }; }); return r; };
const TODOS = ['agachar', 'dobradica', 'empurrarH', 'puxarV', 'puxarH', 'unilateral', 'empurrarV'];
const base = { obj: 'saude', cSit: 'nunca', mSit: 'nunca', local: 'academia', comb: 'indiferente', dor: false, alertas: [], orient: [], mPadroes: [], dorRegioes: [], sono: '7mais', dias: {} };

const LOCAIS = { academia: 'academia', condominio: 'condominio', casa_h: 'casa_h', casa_s: 'casa_s' };
const NIVEIS = {
  iniciante: { mSit: 'nunca' },
  intermediario: { mSit: 'regular', mExp: '1-3a', mFreq: 3, mPadroes: TODOS },
  avancado: { mSit: 'regular', mExp: 'mais3a', mFreq: 5, mPadroes: TODOS },
};
// n dias disponíveis espalhados pela semana, 60 min cada
const DIAS_POR_N = { 2: ['Ter', 'Sáb'], 3: ['Seg', 'Qua', 'Sex'], 4: ['Seg', 'Ter', 'Qui', 'Sex'], 5: ['Seg', 'Ter', 'Qui', 'Sex', 'Sáb'], 6: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] };

function perfil({ nivel = 'iniciante', local = 'academia', nDias = 3, minutos = 60, obj = 'massa', extra = {} }) {
  const d = {}; DIAS_POR_N[nDias].forEach((x) => { d[x] = minutos; });
  return { ...base, obj, local: LOCAIS[local], ...NIVEIS[nivel], dias: dias(d), ...extra };
}

module.exports = { DIAS, dias, TODOS, base, NIVEIS, LOCAIS, DIAS_POR_N, perfil };
