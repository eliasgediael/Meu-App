// Variação local da semana, sem IA e sem rede. O motor monta a mesma sessão de corrida toda semana; o catálogo
// (src/motor/corrida-catalogo.js) já tem as alternativas, e a IA é quem as escolhia. Aqui a escolha é determinística:
// a rodagem alterna com e sem acelerações, o longão alterna com o progressivo e a sessão forte gira entre limiar,
// intervalado e fartlek. A resposta passa pelos MESMOS validadores da IA (F0–F9, R0–R9, J1, V1–V10): qualquer dia
// que não passar volta para a opção do motor, e se nada passar a semana fica como o motor gerou.
// A musculação não é tocada aqui: a variação dela vem do próprio motor (semanasPorVariacao).
/* eslint-disable */
import { iaContextoDoMotor, iaAssinaturaCorrida } from './contrato.js';
import { iaContextoCorridaV2, iaV2Escolhas } from './contrato-v2.js';
import { iaValidarPropostaV2, iaMontarSemanaFinalV2 } from './validador-corrida.js';

const LOCAL_LEVES = ['LEVE', 'LEVE_STRIDES'];
const LOCAL_LONGOS = ['LONGO', 'LONGO_PROGRESSIVO'];
// ordem de rotação da sessão forte: a do motor, depois uma de cada família que o menu do dia permitir
const LOCAL_FAMILIAS_FORTES = ['motor', 'limiar', 'intervalo', 'fartlek'];

function iaItemLocal(ctx, e){
  return { id:ctx.autorizados.chavePorNome.get(e.nome), papel:e.papel, series:parseInt(e.series,10), reps:parseInt(e.reps,10), rpe:e.rpe, descansoSeg:parseDescansoSec(e.descanso) };
}

// Escolhe a opção de cada dia de corrida para a semana n. posLeve: posição entre as rodagens leves (para não
// ficarem todas iguais no mesmo dia).
function iaEscolhasLocais(ctxC, n){
  const escolhas = {};
  let posLeve = 0;
  Object.keys(ctxC.dias).forEach(d=>{
    const x = ctxC.dias[d], tipoDia = x.cdia.tipoDia;
    let id = x.motorId;
    if(tipoDia==='leve'){
      const pool = LOCAL_LEVES.filter(o=>x.menu.includes(o));
      if(pool.length>1) id = pool[(n + posLeve) % pool.length];
      posLeve++;
    } else if(tipoDia==='longa'){
      const pool = LOCAL_LONGOS.filter(o=>x.menu.includes(o));
      if(pool.length>1) id = pool[(n - 1) % pool.length];
    } else {
      const porFamilia = {};
      x.menu.forEach(o=>{ const f = o==='QUALIDADE_MOTOR' ? 'motor' : CORRIDA_OPCOES[o] && CORRIDA_OPCOES[o].familia; if(f && LOCAL_FAMILIAS_FORTES.includes(f)) (porFamilia[f] = porFamilia[f] || []).push(o); });
      const familias = LOCAL_FAMILIAS_FORTES.filter(f=>porFamilia[f] && porFamilia[f].length);
      if(familias.length>1){
        const fam = familias[(n - 1) % familias.length];
        const ops = porFamilia[fam];
        id = ops[Math.floor((n - 1) / familias.length) % ops.length];
      }
    }
    escolhas[d] = id;
  });
  return escolhas;
}

function iaRespostaLocal(ctx, ctxC, escolhas){
  const dias = Object.keys(ctx.muscServido || {}).map(d=>({ dia:d, exercicios:(ctx.muscServido[d] || []).map(e=>iaItemLocal(ctx, e)) }));
  const corrida = Object.keys(ctxC.dias).map(d=>{
    const x = ctxC.dias[d], id = escolhas[d];
    const s = id===x.motorId ? null : x.montadas[id];
    const padrao = s ? iaV2Escolhas(s) : { mobilidade:[], educativos:[], alongamentos:[], strides:0, stridesFim:0 };
    return { dia:d, opcao:id, ...padrao, progressao:'manter' };
  });
  const mudou = Object.keys(escolhas).some(d=>escolhas[d]!==ctxC.dias[d].motorId);
  return { versao:'2', dias, corrida, motivos: mudou ? ['variedade', 'variedade_corrida'] : ['manter_plano'] };
}

// entrada: { perfil, opcoes, semanaMotor }. Devolve { semana, origem:'local'|'motor', motivo }.
function iaVariarSemanaLocal(entrada){
  entrada = entrada || {};
  const semanaMotor = entrada.semanaMotor;
  const fim = (motivo)=>({ semana:semanaMotor, origem:'motor', motivo });
  try{
    if(!semanaMotor || !semanaMotor.corridaWeek || !semanaMotor.corridaWeek.length) return fim('sem_corrida');
    const ctx = iaContextoDoMotor(entrada.perfil, entrada.opcoes || {}, semanaMotor);
    if(!ctx.ok) return fim(ctx.motivo);
    // semana de descarga, calibração, cautela e modo conservador: só o motor (a prioridade é recuperar, não variar)
    if(ctx.est.cautela.temAlerta || ctx.est.conservador) return fim('cautela');
    if(ctx.est.calibracao && ctx.est.calibracao.corrida) return fim('calibracao');   // só a corrida: aqui só ela varia
    if(/descarga/i.test(String(semanaMotor.phaseLabel || ''))) return fim('descarga');
    if(iaAssinaturaCorrida(semanaMotor.corridaWeek)!==iaAssinaturaCorrida(ctx.semana.corridaWeek)) return fim('semana_servida_divergente');
    const ctxC = iaContextoCorridaV2(ctx);
    if(!ctxC.ok) return fim(ctxC.motivo);
    const n = Math.max(1, parseInt(semanaMotor.weekNumber, 10) || 1);
    const escolhas = iaEscolhasLocais(ctxC, n);
    // do mais para o menos arriscado: tudo, sem a sessão forte, sem o longão, tudo do motor
    const dias = Object.keys(ctxC.dias);
    const tipo = d=>ctxC.dias[d].cdia.tipoDia;
    const voltar = (pred)=>{ const e = { ...escolhas }; dias.forEach(d=>{ if(pred(tipo(d))) e[d] = ctxC.dias[d].motorId; }); return e; };
    const tentativas = [escolhas, voltar(t=>t!=='leve' && t!=='longa'), voltar(t=>t==='longa'), voltar(t=>t!=='leve'), voltar(()=>true)];
    for(const e of tentativas){
      if(!dias.some(d=>e[d]!==ctxC.dias[d].motorId)) return fim('sem_variacao_segura');
      const val = iaValidarPropostaV2(ctx, ctxC, iaRespostaLocal(ctx, ctxC, e));
      if(!val.ok) continue;
      return { semana:iaMontarSemanaFinalV2(ctx, ctxC, semanaMotor, val), origem:'local', motivo:'ok', escolhas:e };
    }
    return fim('validacao_reprovada');
  }catch(err){ return fim('erro_variacao'); }
}

export { iaVariarSemanaLocal, iaEscolhasLocais };
