// PROTÓTIPO ISOLADO — dose planejada do treino forte (aprovado só como protótipo em 08/10/2026).
// Não é importado por src/motor/index.js nem pelo app: só os scripts de comparação o carregam.
//
// Separa o FORMATO da sessão (qual variante: 400 m, 800 m, 2 × 2000 m…) da QUANTIDADE de esforço (dose = km nos
// trechos intensos). Hoje a variante define as duas coisas, então trocar o formato muda a dose sem regra explícita.
// No protótipo:
//   - dose de referência = km intensos que a variante da semana 1 já prescreve para a pessoa, no mesmo contexto
//     (nível, ritmos, teto de tempo) — o motor atual já usa essa dose na semana 1;
//   - o formato continua girando pela semana do plano (como a P1);
//   - a quantidade é recalculada para a dose: repetições (intervalado), minutos (limiar contínuo), comprimento do
//     bloco (limiar em blocos e ritmo de maratona). Nenhum aumento ou redução de dose por fase: isso seria regra nova.
// Mínimos: 4 repetições para tiros < 1000 m e 3 para ≥ 1000 m; 12 min de limiar contínuo; blocos ≥ 1000 m (limiar)
// e ≥ 2 km (maratona). O teto de tempo do dia (cap) continua mandando: se não couber, reduz.
// opcoes.fatorDose(ctx) → multiplica a dose de referência (só para simular propostas, ex.: descarga; padrão 1).
function criarQualidadePorDose(G, originais, opcoes){
  const fatorDose = (opcoes && opcoes.fatorDose) || (()=>1);
  const intensoKm = (s)=>(s.gpsSteps||[]).filter(x=>/^(Tiro|Limiar|Ritmo de maratona)/.test(x.name)).reduce((t,x)=>t+(x.km||0), 0);
  const principalKm = (s)=>(s.gpsSteps||[]).filter(x=>!/^(Aquecimento|Desaquecimento)/.test(x.name)).reduce((t,x)=>t+(x.km||0), 0);
  // Dose e espaço de referência = o que a variante da semana 1 já entrega neste contexto. O construtor atual aceita
  // passar do próprio teto quando bate no mínimo de repetições/bloco; o protótipo aceita o mesmo espaço, nem mais nem menos.
  const referencia = (orig, ctx, longKm)=>{ const s = orig({ ...ctx, weekNumber:1 }, longKm); return { D:intensoKm(s), espaco:principalKm(s) }; };

  function intervalo(ctx, longKm){
    const ref = referencia(originais.intervalo, ctx, longKm), D = ref.D*fatorDose(ctx);
    const lista = G.HB_INTERVALO_VARIANTS[ctx.goalKey] || G.HB_INTERVALO_VARIANTS[10];
    const coolMin = G.HYBRID_COOLDOWN_MIN[ctx.nivel];
    const cap = Math.max(longKm*0.85 - G.hbKmDeMin(ctx, ctx.warmMin) - G.hbKmDeMin(ctx, coolMin), ref.espaco);
    const v = lista[(ctx.weekNumber-1) % lista.length];
    const paceKey = v.m<=300 ? 'R' : 'I';
    const restKm = G.kmFromMinAtPace(v.rest/60, ctx.paces.Es);
    const minReps = v.m>=1000 ? 3 : 4;
    let reps = Math.max(minReps, Math.round(D*1000/v.m));
    const mainKmDe = r=>r*v.m/1000 + (r-1)*restKm;
    while(reps>minReps && mainKmDe(reps)>cap) reps--;
    const paceStr = G.paceRangeWithMargin(ctx.paces[paceKey],3)+'/km';
    const gps = [];
    for(let i=1;i<=reps;i++){
      gps.push({ name:`Tiro ${i}/${reps}`, km:v.m/1000, pace:paceStr, zona:'Z5', desc:`${v.m}m`, tipo:'distancia' });
      if(i<reps) gps.push({ name:`Trote ${i}/${reps}`, km:restKm, pace:ctx.easyPace, zona:'Z1', desc:`Trote ${G.hbFmtRest(v.rest)}`, tipo:'tempo', metaSeg:v.rest });
    }
    const main = { desc:`${reps} × ${v.m}m em Z5 (ritmo ${paceKey}), trote ${G.hbFmtRest(v.rest)} entre`, pace:paceStr, zona:'Z5', km:mainKmDe(reps),
      min: reps*G.minFromKmAtPace(v.m/1000, ctx.paces[paceKey]) + (reps-1)*v.rest/60, gps };
    return G.hbMontarSessao(ctx, { type:'Intervalado', cor:'var(--danger)', objetivo:G.VDOT_OBJETIVO['Intervalado'], sessao:'RUN_INTERVALS_VO2MAX', warmMin:ctx.warmMin, coolMin, completo:true, main });
  }

  function tempo(ctx, longKm){
    const ref = referencia(originais.tempo, ctx, longKm), D0 = ref.D*fatorDose(ctx);
    const lista = G.HB_TEMPO_VARIANTS[ctx.goalKey] || G.HB_TEMPO_VARIANTS['21.0975'];
    const coolMin = G.HYBRID_COOLDOWN_MIN[ctx.nivel];
    const cap = Math.max(longKm*0.85 - G.hbKmDeMin(ctx, ctx.warmMin) - G.hbKmDeMin(ctx, coolMin), ref.espaco);
    const v = lista[(ctx.weekNumber-1) % lista.length];
    const isMaratona = ctx.goalKey==='42.195';
    const paceKey = isMaratona ? 'M' : 'T', zona = isMaratona ? 'Z3' : 'Z4';
    const paceStr = G.paceRangeWithMargin(ctx.paces[paceKey],3)+'/km';
    const escala = (ctx.nivel==='avancado' ? 1 : 0.85) * ctx.kmFactor;
    const build = (D)=>{
      const gps = []; let km = 0, min = 0, desc;
      if(v.cont){
        const m = Math.max(12, Math.round(D / G.kmFromMinAtPace(1, ctx.paces.T)));
        km = G.kmFromMinAtPace(m, ctx.paces.T); min = m;
        desc = `${m} min contínuos em limiar (Z3/Z4)`;
        gps.push({ name:'Limiar', km, pace:paceStr, zona, desc:`${m} min em limiar`, tipo:'distancia' });
      }else if(isMaratona){
        // recuperação encolhe junto com o bloco, como no construtor atual
        const bk = Math.max(2, G.roundToHalf(D / v.reps)), rec = v.recKm ? Math.max(1, G.roundToHalf(v.recKm*Math.min(escala, D/(v.reps*v.km)))) : 0;
        for(let i=1;i<=v.reps;i++){
          gps.push({ name:v.reps>1 ? `Ritmo de maratona ${i}/${v.reps}` : 'Ritmo de maratona', km:bk, pace:paceStr, zona, desc:`${G.fmtKm(bk)} em ritmo de prova`, tipo:'distancia' });
          if(i<v.reps && rec) gps.push({ name:`Recuperação ${i}/${v.reps}`, km:rec, pace:ctx.easyPace, zona:'Z2', desc:`${G.fmtKm(rec)} em Z2`, tipo:'distancia' });
        }
        km = v.reps*bk + (v.reps-1)*rec; min = v.reps*G.minFromKmAtPace(bk, ctx.paces.M) + (v.reps-1)*G.minFromKmAtPace(rec, ctx.paces.Es);
        desc = v.reps>1 ? `${v.reps} × ${G.fmtKm(bk)} em ritmo de maratona (Z3), ${G.fmtKm(rec)} em Z2 entre` : `${G.fmtKm(bk)} contínuos em ritmo de maratona (Z3)`;
      }else{
        // mantém o comprimento do bloco da variante; se a dose ficar a mais de 15% do planejado, ajusta o bloco (múltiplo de 500 m)
        const reps = Math.max(2, Math.round(D*1000/v.m));
        const mBloco = Math.abs(reps*v.m - D*1000) > D*1000*0.15 ? Math.max(1000, Math.round(D*1000/reps/500)*500) : v.m;
        const restKm = G.kmFromMinAtPace(v.rest/60, ctx.paces.Es);
        for(let i=1;i<=reps;i++){
          gps.push({ name:`Limiar ${i}/${reps}`, km:mBloco/1000, pace:paceStr, zona, desc:`${mBloco}m em limiar`, tipo:'distancia' });
          if(i<reps) gps.push({ name:`Trote ${i}/${reps}`, km:restKm, pace:ctx.easyPace, zona:'Z1', desc:`Trote ${G.hbFmtRest(v.rest)}`, tipo:'tempo', metaSeg:v.rest });
        }
        km = reps*mBloco/1000 + (reps-1)*restKm; min = reps*G.minFromKmAtPace(mBloco/1000, ctx.paces.T) + (reps-1)*v.rest/60;
        desc = `${reps} × ${mBloco}m em limiar (Z4), trote ${G.hbFmtRest(v.rest)} entre`;
      }
      return { desc, pace:paceStr, zona, km, min, gps };
    };
    let D = D0, main = build(D);
    while(main.km>cap && D>D0*0.4){ D *= 0.9; main = build(D); }
    return G.hbMontarSessao(ctx, { type:'Limiar', cor:'var(--amber)', objetivo:G.VDOT_OBJETIVO['Limiar'], sessao:'RUN_TEMPO_THRESHOLD', warmMin:ctx.warmMin, coolMin, completo:true, main });
  }
  return { intervalo, tempo, intensoKm };
}
if(typeof module!=='undefined' && module.exports) module.exports = { criarQualidadePorDose };
