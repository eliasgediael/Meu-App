// Consentimento para a personalização por IA (LGPD). Só dados + texto: a tela ainda não existe no app.
// Fica em athleteProfile.meta.consentimentoIA. Sem consentimento aceito na versão atual, o app nunca chama a IA.
// Dados de saúde (regiões de dor) têm aceite separado (LGPD art. 11): sem ele, a IA recebe só a lista de exercícios
// já filtrada pelo motor, sem saber o motivo dos bloqueios.
/* eslint-disable */
const IA_CONSENTIMENTO_VERSAO = '2026-10-13';

const IA_CONSENTIMENTO_TEXTO = {
  titulo: 'Personalizar com IA',
  itens: [
    'O Gemini (Google) pode ajustar sua musculação: exercícios, séries, repetições e descanso.',
    'Enviamos só o necessário: nível, objetivo, equipamento, dias e minutos, faixa de idade e um resumo dos seus treinos.',
    'Nunca enviamos nome, e-mail, foto, localização, frequência cardíaca nem data de nascimento.',
    'Toda sugestão passa pelas regras de segurança do app. Se algo falhar, vale o plano normal.',
    'Você pode desligar quando quiser no Perfil. Sem a IA, o app funciona igual.',
  ],
  saude: 'Incluir minhas regiões de dor para a IA evitar sobrecarga nelas',
  aceitar: 'Ativar',
  recusar: 'Agora não',
};

function iaConsentimento(perfil){
  const m = perfil && perfil.meta;
  const c = m && m.consentimentoIA;
  return (c && typeof c==='object') ? c : null;
}
// 'pendente' | 'aceito' | 'recusado' | 'revogado' | 'desatualizado'
function iaConsentimentoEstado(perfil){
  const c = iaConsentimento(perfil);
  if(!c) return 'pendente';
  if(c.revogadoEm) return 'revogado';
  if(c.aceito!==true) return 'recusado';
  if(c.versao!==IA_CONSENTIMENTO_VERSAO) return 'desatualizado';
  return 'aceito';
}
function iaConsentimentoIncluiSaude(perfil){
  const c = iaConsentimento(perfil);
  return iaConsentimentoEstado(perfil)==='aceito' && c.incluirSaude===true;
}
// Grava a escolha (aceite ou recusa) no perfil. Quem chama salva o perfil.
function iaRegistrarConsentimento(perfil, escolha, agoraISO){
  if(!perfil) return null;
  perfil.meta = perfil.meta || {};
  const em = agoraISO || new Date().toISOString();
  perfil.meta.consentimentoIA = {
    versao: IA_CONSENTIMENTO_VERSAO,
    aceito: !!(escolha && escolha.aceito),
    incluirSaude: !!(escolha && escolha.aceito && escolha.incluirSaude),
    decididoEm: em,
    revogadoEm: null,
  };
  return perfil.meta.consentimentoIA;
}
function iaRevogarConsentimento(perfil, agoraISO){
  const c = iaConsentimento(perfil);
  if(!c) return null;
  c.revogadoEm = agoraISO || new Date().toISOString();
  c.aceito = false; c.incluirSaude = false;
  return c;
}

export { IA_CONSENTIMENTO_VERSAO, IA_CONSENTIMENTO_TEXTO, iaConsentimento, iaConsentimentoEstado, iaConsentimentoIncluiSaude, iaRegistrarConsentimento, iaRevogarConsentimento };
