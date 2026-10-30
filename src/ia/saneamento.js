// Saneamento da resposta da IA antes dos validadores: o erro mais comum é repetir o mesmo movimento no mesmo dia (dois
// supinos, duas remadas), que o F5 usa para reprovar a SEMANA INTEIRA. Aqui só esse caso é corrigido, de forma
// determinística: o exercício repetido volta a ser o do motor naquele dia (com os números do motor) ou sai da lista.
// Tudo o mais segue para os validadores exatamente como veio, e os validadores continuam sendo a barreira de segurança.
/* eslint-disable */
function iaItemDoMotor(ctx, e){
  return { id:ctx.autorizados.chavePorNome.get(e.nome), papel:e.papel, series:parseInt(e.series,10), reps:parseInt(e.reps,10), rpe:e.rpe, descansoSeg:parseDescansoSec(e.descanso) };
}
function iaSanearFamilias(ctx, resp){
  try{
    if(!resp || typeof resp!=='object' || !Array.isArray(resp.dias) || !ctx.autorizados) return resp;
    const porId = ctx.autorizados.porId;
    let mudou = false;
    const dias = resp.dias.map(d=>{
      if(!d || !Array.isArray(d.exercicios)) return d;
      const doMotor = ctx.muscServido[d.dia] || [];
      const famMotor = {};
      doMotor.forEach(e=>{ const f = motorFamilia(normalizeNoAccents(e.nome)); famMotor[f] = (famMotor[f] || 0) + 1; });
      const presentes = new Set(d.exercicios.map(x=>x && x.id));
      const contagem = {};
      const saida = [];
      d.exercicios.forEach(x=>{
        const it = x && porId.get(x.id);
        if(!it){ saida.push(x); return; }
        contagem[it.familia] = (contagem[it.familia] || 0) + 1;
        if(contagem[it.familia] <= Math.max(1, famMotor[it.familia] || 0)){ saida.push(x); return; }
        // repetido: volta o do motor que ainda não está na lista e não repete movimento; se não houver, sai
        contagem[it.familia]--; mudou = true;
        const volta = doMotor.find(e=>{
          const id = ctx.autorizados.chavePorNome.get(e.nome), mi = id && porId.get(id);
          return mi && !presentes.has(id) && !saida.some(s=>s.id===id) && (contagem[mi.familia] || 0) < Math.max(1, famMotor[mi.familia] || 0) && x.papel!=='base';
        });
        if(volta){ const item = iaItemDoMotor(ctx, volta); presentes.add(item.id); contagem[porId.get(item.id).familia] = (contagem[porId.get(item.id).familia] || 0) + 1; saida.push(item); }
      });
      return { ...d, exercicios:saida };
    });
    return mudou ? { ...resp, dias } : resp;
  }catch(e){ return resp; }
}
export { iaSanearFamilias };
