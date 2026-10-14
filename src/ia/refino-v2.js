// Orquestração v2: Motor V2 → menus do catálogo → pedido v2 → Worker/Gemini → validação v2 (F0–F9 + R0–R9 + semana
// conjunta) → semana final. Qualquer falha devolve a semana do motor intacta. O v1 (iaRefinarSemana) continua igual.
//
// Opção A (decisão do usuário, 14/10/2026): a personalização faz parte do app, sem tela de ativação; a pessoa pode
// desligar no Perfil (athleteProfile.meta.personalizacaoIA === false); dados de saúde nunca vão para a IA.
/* eslint-disable */
import { IA_CONFIG } from './config.js';
import { iaContextoDoMotor, iaAssinaturaCorrida } from './contrato.js';
import { iaContextoCorridaV2, iaMontarPedidoV2 } from './contrato-v2.js';
import { iaValidarPropostaV2, iaMontarSemanaFinalV2 } from './validador-corrida.js';
import { iaComTimeout } from './refino.js';

function iaPersonalizacaoLigada(perfil){ return !(perfil && perfil.meta && perfil.meta.personalizacaoIA===false); }
function iaDefinirPersonalizacao(perfil, ligada){ if(!perfil) return; perfil.meta = perfil.meta || {}; perfil.meta.personalizacaoIA = !!ligada; }

// entrada: { perfil, opcoes (as do motor), semanaMotor, tipo, historico (musculação), historicoCorrida (iaResumoCorrida),
//            online, usuario, chamarFuncao(pedido) → Promise<{ resposta }>, timeoutMs? }
async function iaRefinarSemanaV2(entrada){
  entrada = entrada || {};
  const semanaMotor = entrada.semanaMotor;
  const fim = (motivo, extra)=>({ semana:semanaMotor, origem:'motor', motivo, ...(extra || {}) });
  if(!IA_CONFIG.ativa) return fim('ia_desligada');
  if(!iaPersonalizacaoLigada(entrada.perfil)) return fim('personalizacao_desligada');
  const temMusc = !!(semanaMotor && semanaMotor.muscPlan && Object.keys(semanaMotor.muscPlan).length);
  const temCorrida = !!(semanaMotor && semanaMotor.corridaWeek && semanaMotor.corridaWeek.length);
  if(!temMusc && !temCorrida) return fim('sem_sessoes');
  if(!entrada.online) return fim('offline');
  if(!entrada.usuario) return fim('sem_login');
  if(typeof entrada.chamarFuncao!=='function') return fim('sem_funcao');
  let ctx, ctxC;
  try{ ctx = iaContextoDoMotor(entrada.perfil, entrada.opcoes, semanaMotor); }catch(e){ return fim('contexto_erro'); }
  if(!ctx.ok) return fim(ctx.motivo);
  if(ctx.est.cautela.temAlerta || ctx.est.conservador) return fim('cautela');
  if(iaAssinaturaCorrida(semanaMotor.corridaWeek)!==iaAssinaturaCorrida(ctx.semana.corridaWeek)) return fim('semana_servida_divergente');
  try{ ctxC = iaContextoCorridaV2(ctx); }catch(e){ return fim('contexto_corrida_erro'); }
  if(!ctxC.ok) return fim(ctxC.motivo);
  let pedido;
  try{ pedido = iaMontarPedidoV2(ctx, ctxC, { perfil:entrada.perfil, historico:entrada.historico, historicoCorrida:entrada.historicoCorrida, tipo:entrada.tipo }); }
  catch(e){ return fim('pedido_erro'); }
  let retorno;
  try{ retorno = await iaComTimeout(entrada.chamarFuncao(pedido), entrada.timeoutMs || IA_CONFIG.timeoutMs); }catch(e){ return fim('falha_chamada'); }
  const bruto = retorno && typeof retorno==='object' && 'resposta' in retorno ? retorno.resposta : retorno;
  let val;
  try{ val = iaValidarPropostaV2(ctx, ctxC, bruto); }catch(e){ return fim('validacao_erro', { erro:String(e && e.message) }); }
  if(!val.ok) return fim('validacao_reprovada', { erros:val.erros });
  let semana;
  try{ semana = iaMontarSemanaFinalV2(ctx, ctxC, semanaMotor, val); }catch(e){ return fim('montagem_erro'); }
  return { semana, origem:'ia', motivo:'ok', avisos:val.avisos, corrida:{ opcoes:val.corrida.escolhidas, minutos:val.corrida.somaMin, minutosMotor:val.corrida.somaMotor,
    carga:val.corrida.cargaSemana, cargaMotor:val.corrida.cargaMotor, pedidoProgressao:val.corrida.progressao }, volumeMusc:val.musc ? val.musc.volume : null, motivos:val.motivos };
}

export { iaPersonalizacaoLigada, iaDefinirPersonalizacao, iaRefinarSemanaV2 };
