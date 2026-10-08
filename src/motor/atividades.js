// Atividades realizadas (ActivityRepository) e conclusão das sessões planejadas (SessionCompletion).
// Bloco 3 do plano mestre. Regras aprovadas pelo usuário:
// - cada atividade existe separada; uma sessão planejada só é concluída pela atividade vinculada a ela;
// - atividades livres (sem plano) entram no histórico, na carga real, nos recordes e no Progresso, mas não
//   concluem nenhuma sessão;
// - "concluído sem registro" (completed_without_record) conta para a aderência, mas não gera distância, ritmo,
//   carga, recorde nem km de tênis.
// Transição: as corridas/treinos ligados ao plano continuam gravados nas chaves antigas (corridaProgress,
// workoutSessionsLog) e aparecem aqui por derivação idempotente; só as atividades livres moram na chave nova
// "atividades". Assim versões antigas do app e a nuvem continuam funcionando sem migração destrutiva.

const ATIVIDADES_VERSAO = 1;
const TIPOS_ATIVIDADE_LIVRE = { corrida:'Corrida livre', caminhada:'Caminhada', esteira:'Esteira' };

async function saveAtividades(){ try{ await window.storage.set('atividades', JSON.stringify(state.atividadesLivres || []), false); }catch(e){} }
async function carregarAtividades(){
  try{
    const r = await window.storage.get('atividades', false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    state.atividadesLivres = Array.isArray(v) ? v : [];
  }catch(e){ state.atividadesLivres = []; }
}
function atividadesLivres(){ return state.atividadesLivres || (state.atividadesLivres = []); }

// Corrida ligada ao plano tem registro quando há gravação (GPS/esteira) ou distância/tempo informados.
function progressoTemRegistro(p){ return !!(p && typeof p==='object' && (p.gpsRunId || parseFloat(p.km)>0 || parseClockInput(p.tempo)>0)); }

// Lista única, em ordem cronológica (mais recente primeiro): corridas do plano com registro, atividades livres
// e treinos de musculação registrados. Derivada a cada chamada (não guarda cópia, então não diverge).
function listarAtividades(){
  const out = [];
  Object.entries(state.corridaProgress || {}).forEach(([chave, p])=>{
    if(!p || typeof p!=='object' || !p.done || !progressoTemRegistro(p)) return;
    const km = parseFloat(p.km) || null, seg = parseClockInput(p.tempo) || null;
    out.push({ id: p.gpsRunId ? 'run:'+p.gpsRunId : 'prog:'+chave, tipo:'corrida', livre:false, origem: p.gpsRunId ? 'gravada' : 'manual',
      data:p.data || null, distKm:km, tempoSeg:seg, paceSeg: km && seg ? seg/km : null, gpsRunId:p.gpsRunId || null,
      sessao:{ chave, modalidade:'corrida' }, titulo:(((state.treinos||[]).find(t=>t.day===chave)) || {}).type || 'Corrida' });
  });
  atividadesLivres().forEach(a=>out.push({ ...a, livre:true, sessao:null }));
  (state.workoutSessionsLog || []).forEach(l=>{
    if(!l || !l.data) return;
    out.push({ id:'musc:'+(l.id||l.data), tipo:'musculacao', livre:false, origem:'execucao', data:l.data, tempoSeg:l.duracaoSeg || null,
      muscLogId:l.id || null, sessao: l.day ? { chave:l.day, modalidade:'musculacao' } : null, titulo:l.title || 'Musculação', series:l.series || 0 });
  });
  const quando = (a)=>(a.data || '') + 'T' + String(a.inicio || 0).padStart(15, '0');
  return out.sort((a, b)=>quando(b).localeCompare(quando(a)));
}
function atividadesDoDia(iso){ return listarAtividades().filter(a=>a.data===iso); }
function atividadesLivresDoDia(iso){ return atividadesLivres().filter(a=>a.data===iso); }

// Estado de uma sessão planejada de corrida: concluída (com a atividade vinculada), concluída sem registro ou pendente.
function conclusaoCorrida(chave){
  const p = (state.corridaProgress || {})[chave];
  if(!p || (typeof p==='object' && !p.done)) return { status:'pending', atividadeId:null };
  if(typeof p!=='object' || !progressoTemRegistro(p)) return { status:'completed_without_record', atividadeId:null };
  return { status:'completed', atividadeId: p.gpsRunId ? 'run:'+p.gpsRunId : 'prog:'+chave };
}

// Grava uma atividade livre (sem sessão planejada).
async function registrarAtividadeLivre(a){
  const lista = atividadesLivres();
  const i = lista.findIndex(x=>x.id===a.id);
  const reg = { versao:ATIVIDADES_VERSAO, ...a, livre:true, atualizadoEm:Date.now() };
  if(i>=0) lista[i] = reg; else lista.push(reg);
  await saveAtividades();
  return reg;
}
async function excluirAtividadeLivre(id){
  const a = atividadesLivres().find(x=>x.id===id);
  if(!a) return false;
  if(a.shoeCredit){
    const t = (state.equipamentos.tenis || []).find(x=>x.id===a.shoeCredit.tenisId);
    if(t){ t.km = Math.max(0, Math.round((t.km - a.shoeCredit.km)*10)/10); saveEquipamentos(); }
  }
  if(a.gpsRunId){ try{ await gpsDbDelete(a.gpsRunId); gpsMarcarExcluidaNuvem(a.gpsRunId); }catch(e){} }
  state.atividadesLivres = atividadesLivres().filter(x=>x.id!==id);
  await saveAtividades();
  // Recordes recalculados com as corridas que restaram (decisão do usuário, 08/10/2026).
  try{ if(typeof recalcularRecordesCorrida==='function') await recalcularRecordesCorrida(); }catch(e){}
  try{ sincronizarCorridasGps(); }catch(e){}
  return true;
}

Object.assign(globalThis, {
  ATIVIDADES_VERSAO, TIPOS_ATIVIDADE_LIVRE, saveAtividades, carregarAtividades, atividadesLivres, progressoTemRegistro,
  listarAtividades, atividadesDoDia, atividadesLivresDoDia, conclusaoCorrida, registrarAtividadeLivre, excluirAtividadeLivre,
});

// ---------- Vínculo de atividade livre com o treino do dia (Bloco 9, só por escolha do usuário) ----------
async function vincularAtividadeLivre(id){
  const a = atividadesLivres().find(x=>x.id===id);
  if(!a) return null;
  const sug = sugerirVinculo({ ...a, livre:true });
  if(!sug) return null;
  const chave = sug.sessao.chave;
  state.corridaProgress[chave] = { ...(state.corridaProgress[chave] || {}), done:true, data:a.data, km:a.distKm ? String(a.distKm) : '',
    tempo:a.tempoSeg ? formatClock(a.tempoSeg) : '', pace:a.paceSeg ? formatPace(a.paceSeg)+'/km' : '', gpsRunId:a.gpsRunId || null,
    shoeCredit:a.shoeCredit || null, vinculadaDe:a.id };
  saveCorridaProgress();
  if(a.gpsRunId){
    try{
      const rec = await gpsDbGet(a.gpsRunId);
      if(rec){
        const novo = { ...rec, livre:false, day:sug.sessao.dia };
        await gpsDbPut(novo);
        try{ if(state.authUser && !state.viewingClient && nuvemAcessivel()) await comTimeout(db.collection('users').doc(state.authUser.uid).collection('data').doc('gpsRun__'+novo.id).set(gpsParaNuvem(novo)), CLOUD_TIMEOUT_MS); }catch(e){}
      }
    }catch(e){}
  }
  state.atividadesLivres = atividadesLivres().filter(x=>x.id!==id);
  await saveAtividades();
  return sug.sessao;
}
async function recusarVinculo(id){
  const a = atividadesLivres().find(x=>x.id===id);
  if(!a) return;
  a.vinculoRecusado = true;
  await saveAtividades();
}
Object.assign(globalThis, { vincularAtividadeLivre, recusarVinculo });
