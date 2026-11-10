// Dupla progressão de carga da musculação (vinda da pasta FORZA RUN, etapa 6). Função pura: recebe o exercício do plano e as
// séries da última sessão e devolve a carga sugerida, a direção (subir, manter, reduzir), o motivo em português e o reasonCode.

// Faixa de repetições do exercício: "8-12" → { min:8, max:12 }; "10" → { min:10, max:10 }.
function progFaixaReps(reps){
  const n = (String(reps==null ? '' : reps).match(/\d+/g) || []).map(Number).filter(x=>x>0);
  if(!n.length) return null;
  return { min:Math.min(...n), max:Math.max(...n) };
}
const progArred = p=>Math.round(p*2)/2;   // passo de 0,5 kg

function motorProgressaoDupla(ex, sets){
  const peso0 = parseFloat(sets && sets[0] && sets[0].peso) || 0;
  const faixa = progFaixaReps(ex.reps);
  const ultima = sets[sets.length-1];
  const repsUlt = parseFloat(ultima.reps);
  const rpeAlvo = typeof ex.rpe==='number' ? ex.rpe : (parseFloat(ex.rpe) || null);
  const rpeUlt = parseFloat(ultima.pse);
  const temRpe = !isNaN(rpeUlt);
  const resp = (direction, peso, motivo, reasonCode)=>({ peso, direction, motivo, reasonCode });
  if(!faixa || isNaN(repsUlt)) return resp('manter', peso0, 'Sem repetições registradas na última série — mantendo a carga.', 'sem_reps_ultima_serie');
  if(ex.deload) return resp('manter', peso0, 'Semana de deload: mantém a carga e faz menos séries com esforço menor, para recuperar.', 'deload');
  // Faixa como 8-12: abaixo de 8 reduz. Número único (10): só reduz bem abaixo (menos de 80%).
  const piso = faixa.min<faixa.max ? faixa.min : Math.ceil(faixa.max*0.8);
  if(repsUlt < piso){
    return resp('reduzir', progArred(peso0*0.90), `Na última série você fez ${repsUlt} repetições, abaixo do mínimo de ${piso} — reduzindo a carga em cerca de 10%.`, 'reps_abaixo');
  }
  if(repsUlt >= faixa.max){
    if(!temRpe){
      return resp('subir', progArred(peso0*1.025) > peso0 ? progArred(peso0*1.025) : peso0+0.5, `Você fez ${repsUlt} repetições na última série, o topo da faixa (${faixa.max}). Sem RPE registrado, a decisão foi só pelas repetições — subindo a carga.`, 'topo_sem_rpe');
    }
    if(rpeAlvo==null || rpeUlt <= rpeAlvo){
      const alvoTxt = rpeAlvo==null ? '' : ` no RPE ${rpeUlt}, dentro do alvo (RPE ${rpeAlvo})`;
      return resp('subir', progArred(peso0*1.025) > peso0 ? progArred(peso0*1.025) : peso0+0.5, `Você fez ${repsUlt} repetições na última série, o topo da faixa (${faixa.max})${alvoTxt} — hora de subir a carga.`, 'topo_no_alvo');
    }
    return resp('manter', peso0, `Você chegou ao topo da faixa (${faixa.max} repetições), mas com RPE ${rpeUlt}, acima do alvo (RPE ${rpeAlvo}) — mantém a carga até ficar mais leve.`, 'topo_rpe_alto');
  }
  return resp('manter', peso0, `Na última série você fez ${repsUlt} repetições; o topo da faixa é ${faixa.max}. Mantém a carga até chegar em ${faixa.max} repetições na última série${rpeAlvo!=null ? ` no RPE ${rpeAlvo} ou abaixo` : ''}.`, 'faixa_incompleta');
}

Object.assign(globalThis, { progFaixaReps, motorProgressaoDupla });
