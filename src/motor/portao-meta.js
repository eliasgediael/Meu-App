// Portão de meta (Etapa 3), só no motor: a meta (distância da prova) é viável com a carga de hoje, o nível e as
// semanas até a prova? Simula o que o plano consegue construir com o mesmo crescimento do plano (passoSemanal,
// ciclo 3:1, longão limitado a 115% do anterior e a uma fração do volume da semana) e compara com o que a
// distância exige (teto de longão do nível e, em meia e maratona, o volume de referência). Não altera o plano.
const PORTAO = {
  longoSim:1.0, longoApertado:0.75,        // pico de longão / teto de longão do nível para a distância
  volumeSim:0.9, volumeApertado:0.7,       // pico de volume / volume de referência da prova (só meia e maratona)
  semanasMax:52,                           // limite da busca por "mais semanas"
  // Fração do teto de longão do nível que a distância exige. Meia e maratona exigem o teto inteiro; 5K e 10K não
  // precisam de longão tão grande (decisão do motor, calibrável): sem isso um iniciante de 5K seria sempre "não".
  exigenciaLongo:{ 5:0.5, 10:0.7, '21.0975':1, '42.195':1 },
};
const PORTAO_NOME = { 5:'5K', 10:'10K', '21.0975':'meia maratona', '42.195':'maratona' };
const PORTAO_DISTANCIAS = [5, 10, 21.0975, 42.195];

// Simula as semanas do plano. Retorna picos de volume e de longão (minutos) antes do polimento.
function portaoSimular(e){
  const P = MOTOR_PARAMS;
  const goal = e.distanciaKm, nivel = e.nivel;
  const taper = Math.min((PROVA_POLIMENTO_SEMANAS[goal] || 1), Math.max(0, e.semanas - 1));
  const vref = P.volumeRef[nivel] * (P.fatorDistancia[String(goal)] || 1);
  const tetoVol = Math.max(motorTetoVolumeProva(goal, nivel, vref), e.volumeMin);   // o plano não passa disso (e não corta o que o atleta já faz)
  const tp = P.tetoLongoProva[String(goal)];
  const tetoLongo = tp ? tp[MOTOR_NIVEIS.indexOf(nivel)] : P.tetoLongo[nivel];            // teto de longão do nível (limite do plano)
  const exigeLongo = Math.round(tetoLongo * (PORTAO.exigenciaLongo[String(goal)] || 1));  // o que a distância exige
  const share = P.shareLongaMax[Math.min(5, Math.max(2, Math.round(e.freq || 3)))];
  let v = e.volumeMin, longo = Math.min(e.longoMin, tetoLongo), picoVol = v, picoLongo = longo;
  for(let w=1; w<=e.semanas-taper; w++){
    const pos = ((w-1)%4)+1;
    if(w>1 && !(e.calibracao && w<=2) && pos!==4){
      v = Math.min(v*(1+P.passoSemanal), Math.max(tetoVol, v));
      longo = Math.min(tetoLongo, longo*P.crescimentoLongo, Math.max(longo, share*v));   // longão cresce até 115%, limitado pela fração do volume
    }
    const vSemana = pos===4 && w>1 ? v*0.75 : v;
    picoVol = Math.max(picoVol, vSemana);
    picoLongo = Math.max(picoLongo, pos===4 && w>1 ? longo*P.reducaoLongoDescarga : longo);
  }
  const vr = P.volumeRefProva[String(goal)];
  return { semanasConstrucao:Math.max(0, e.semanas-taper), polimentoSemanas:taper, volumePicoMin:Math.round(picoVol), longoPicoMin:Math.round(picoLongo),
    longoNecessarioMin:exigeLongo, volumeNecessarioMin: vr ? vr[nivel] : null, compartilhaLongo:share };
}
function portaoClasse(razao, sim, apertado){ return razao>=sim ? 'sim' : razao>=apertado ? 'apertado' : 'nao'; }
function portaoAvaliar(e){
  const s = portaoSimular(e);
  const rLongo = s.longoPicoMin / s.longoNecessarioMin;
  const rVol = s.volumeNecessarioMin ? s.volumePicoMin / s.volumeNecessarioMin : null;
  const cLongo = portaoClasse(rLongo, PORTAO.longoSim, PORTAO.longoApertado);
  const cVol = rVol===null ? 'sim' : portaoClasse(rVol, PORTAO.volumeSim, PORTAO.volumeApertado);
  const ordem = ['sim', 'apertado', 'nao'];
  const viavel = ordem[Math.max(ordem.indexOf(cLongo), ordem.indexOf(cVol))];
  return { viavel, cLongo, cVol, rLongo, rVol, ...s };
}
// Entrada: { distanciaKm, nivel, volumeMin, longoMin, freq, semanas, calibracao }.
// Saída: { viavel:'sim'|'apertado'|'nao', motivo, alternativa:{ tipo, ... }|null, projecao }.
function motorViabilidadeMeta(e){
  const nome = PORTAO_NOME[e.distanciaKm] || (e.distanciaKm+' km');
  const a = portaoAvaliar(e);
  const motivos = [];
  if(a.cLongo!=='sim') motivos.push('o longão chegaria a '+a.longoPicoMin+' min e '+nome+' pede ao menos '+a.longoNecessarioMin+' min para o seu nível');
  if(a.cVol!=='sim') motivos.push('o volume semanal chegaria a '+a.volumePicoMin+' min e '+nome+' pede cerca de '+a.volumeNecessarioMin+' min');
  const motivo = a.viavel==='sim'
    ? 'em '+e.semanas+' semanas o plano chega a longão de '+a.longoPicoMin+' min'+(a.volumeNecessarioMin ? ' e volume de '+a.volumePicoMin+' min' : '')+', dentro do que '+nome+' pede'
    : 'em '+e.semanas+' semanas, crescendo '+Math.round(MOTOR_PARAMS.passoSemanal*100)+'% por semana com semana de alívio a cada 4, '+motivos.join('; ');
  let alternativa = null;
  if(a.viavel!=='sim'){
    // 1) mais semanas (até o limite da busca); 2) distância menor com o mesmo prazo.
    let maisSemanas = null;
    for(let n=e.semanas+1; n<=PORTAO.semanasMax; n++){ if(portaoAvaliar({ ...e, semanas:n }).viavel==='sim'){ maisSemanas = n; break; } }
    let menor = null;
    for(const d of PORTAO_DISTANCIAS.filter(x=>x<e.distanciaKm).reverse()){ if(portaoAvaliar({ ...e, distanciaKm:d }).viavel==='sim'){ menor = d; break; } }
    if(maisSemanas && maisSemanas<=PROVA_SEMANAS.max) alternativa = { tipo:'mais_semanas', semanas:maisSemanas, texto:'Com '+maisSemanas+' semanas até a prova, '+nome+' fica viável.' };
    else if(menor) alternativa = { tipo:'distancia_menor', distanciaKm:menor, texto:'Com este prazo, '+PORTAO_NOME[menor]+' fica viável no lugar de '+nome+'.' };
    else if(maisSemanas) alternativa = { tipo:'mais_semanas', semanas:maisSemanas, texto:'Com '+maisSemanas+' semanas até a prova, '+nome+' fica viável.' };
    else alternativa = { tipo:'mais_tempo', texto:'Faça mais algumas semanas de base e reavalie a meta.' };
  }
  return { viavel:a.viavel, motivo, alternativa,
    projecao:{ distanciaKm:e.distanciaKm, nivel:e.nivel, semanas:e.semanas, polimentoSemanas:a.polimentoSemanas, volumeAtualMin:Math.round(e.volumeMin), longoAtualMin:Math.round(e.longoMin),
      volumePicoMin:a.volumePicoMin, longoPicoMin:a.longoPicoMin, longoNecessarioMin:a.longoNecessarioMin, volumeNecessarioMin:a.volumeNecessarioMin } };
}
// Viabilidade a partir do estado lido pelo motor (semana 1 do plano). null quando o objetivo não é uma prova com distância.
function motorViabilidadeDoEstado(est){
  const o = est.objetivo, c = est.corrida;
  if(!o || o.tipo!=='prova' || !o.distanciaInformada || !c || !c.carga) return null;
  const P = MOTOR_PARAMS;
  const semanas = o.prova ? Math.min(o.prova.semanasReais, PORTAO.semanasMax) : motorSemanasDoPlano(est);
  const freq = c.freq || 3;
  const longoMin = c.maiorMin || Math.round(c.carga.min * (P.shareLonga[Math.min(5, Math.max(2, Math.round(freq)))] || 0.42));
  return motorViabilidadeMeta({ distanciaKm:o.distanciaKm, nivel:est.capacidade.corrida, volumeMin:c.carga.min, longoMin, freq, semanas, calibracao:!!est.calibracao.ativa });
}
Object.assign(globalThis, { PORTAO, motorViabilidadeMeta, motorViabilidadeDoEstado });
