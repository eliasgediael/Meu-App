// Orquestração: Motor V2 → Gemini (via Cloud Function) → validação determinística → plano final.
// Em qualquer falha (IA desligada, sem consentimento, offline, sem login, erro, demora, validação reprovada) devolve
// a semana do motor sem nenhuma alteração. Ainda não está ligado ao app (nenhuma tela chama esta função).
/* eslint-disable */
import { IA_CONFIG } from './config.js';
import { iaConsentimentoEstado } from './consentimento.js';
import { iaContextoDoMotor, iaMontarPedido } from './contrato.js';
import { iaValidarProposta, iaMontarSemanaFinal } from './validador.js';

function iaComTimeout(p, ms){
  let t;
  return Promise.race([
    Promise.resolve(p).finally(()=>clearTimeout(t)),
    new Promise((_, rej)=>{ t = setTimeout(()=>rej(new Error('timeout')), ms); }),
  ]);
}
// entrada: { perfil, opcoes (as mesmas do motor), semanaMotor, tipo:'inicial'|'semanal', historico, online, usuario, chamarFuncao }
// chamarFuncao(pedido) → Promise<{ resposta }> (a Cloud Function refinarTreino).
async function iaRefinarSemana(entrada){
  entrada = entrada || {};
  const semanaMotor = entrada.semanaMotor;
  const fim = (motivo, extra)=>({ semana:semanaMotor, origem:'motor', motivo, ...(extra || {}) });
  if(!IA_CONFIG.ativa) return fim('ia_desligada');
  if(!semanaMotor || !semanaMotor.muscPlan || !Object.keys(semanaMotor.muscPlan).length) return fim('sem_musculacao');
  if(iaConsentimentoEstado(entrada.perfil)!=='aceito') return fim('sem_consentimento');
  if(!entrada.online) return fim('offline');
  if(!entrada.usuario) return fim('sem_login');
  if(typeof entrada.chamarFuncao!=='function') return fim('sem_funcao');
  let ctx;
  try{ ctx = iaContextoDoMotor(entrada.perfil, entrada.opcoes, semanaMotor); }catch(e){ return fim('contexto_erro'); }
  if(!ctx.ok) return fim(ctx.motivo);
  // Qualquer sinal de alerta (mesmo liberado) ou modo conservador: só o motor.
  if(ctx.est.cautela.temAlerta || ctx.est.conservador) return fim('cautela');
  let pedido;
  try{ pedido = iaMontarPedido(ctx, { perfil:entrada.perfil, historico:entrada.historico, tipo:entrada.tipo }); }catch(e){ return fim('pedido_erro'); }
  let retorno;
  try{ retorno = await iaComTimeout(entrada.chamarFuncao(pedido), IA_CONFIG.timeoutMs); }catch(e){ return fim('falha_chamada'); }
  const bruto = retorno && typeof retorno==='object' && 'resposta' in retorno ? retorno.resposta : retorno;
  let val;
  try{ val = iaValidarProposta(ctx, bruto); }catch(e){ return fim('validacao_erro'); }
  if(!val.ok) return fim('validacao_reprovada', { erros:val.erros });
  let semana;
  try{ semana = iaMontarSemanaFinal(ctx, semanaMotor, val); }catch(e){ return fim('montagem_erro'); }
  return { semana, origem:'ia', motivo:'ok', avisos:val.avisos, volume:val.volume };
}

export { iaComTimeout, iaRefinarSemana };
