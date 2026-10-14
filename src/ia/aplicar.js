// Regra para trocar o treino do motor pelo da IA depois que a resposta chega (o Motor V2 mostra o treino na hora).
// A IA nunca sobrescreve nada do usuário: só aplica se a musculação da semana continua exatamente como o motor
// entregou no momento do pedido e se nenhum treino de musculação daquela semana foi iniciado ou concluído.
// Se não puder aplicar, a resposta é descartada inteira (aplicar só alguns dias quebraria o volume semanal do F6).
// Ainda NÃO está no app: entra na etapa D, com aprovação.
/* eslint-disable */
import { iaAssinaturaMusc } from './contrato.js';

// No momento do pedido: guarda a "foto" da musculação servida pelo motor.
function iaFotoDaSemana(semanaMotor){
  return { assinatura: iaAssinaturaMusc(semanaMotor && semanaMotor.muscPlan), corrida:JSON.stringify(semanaMotor && semanaMotor.corridaWeek || []) };
}
// Quando a resposta chega. estado: { semanaAtual, treinoIniciado:boolean, mesmaSemana:boolean }
function iaPodeAplicar(foto, resultado, estado){
  if(!resultado || resultado.origem!=='ia' || !resultado.semana) return { ok:false, motivo:'sem_resultado_ia' };
  if(!foto || !foto.assinatura) return { ok:false, motivo:'sem_foto' };
  if(!estado || estado.mesmaSemana===false) return { ok:false, motivo:'semana_mudou' };
  if(estado.treinoIniciado) return { ok:false, motivo:'treino_iniciado' };
  if(iaAssinaturaMusc(estado.semanaAtual && estado.semanaAtual.muscPlan)!==foto.assinatura) return { ok:false, motivo:'usuario_alterou' };
  if(resultado.semana.iaRefino && resultado.semana.iaRefino.versaoContrato==='2' && JSON.stringify(estado.semanaAtual && estado.semanaAtual.corridaWeek || [])!==foto.corrida) return { ok:false, motivo:'usuario_alterou_corrida' };
  return { ok:true, motivo:'ok' };
}

export { iaFotoDaSemana, iaPodeAplicar };
