// Conversão entre os treinos do app e o formato compacto do relógio Garmin (FORZA RUN Connect IQ).
// Contrato: docs/CONTRATO-SYNC.md do projeto garmin-connectiq (v2). Sem dependências do app nem do
// Capacitor, para poder ser testado em Node e empacotado em www/native-bridge.js.

const MAX_TREINOS = 8;   // o relógio guarda no máximo 8 treinos
const MAX_ETAPAS = 40;   // e no máximo 40 etapas por treino
// O FR55 tem 128 KB para o app inteiro: uma mensagem de ~1,5 KB ocupa ~7 KB depois de guardada e
// mensagens acima de ~5 KB esgotam a memória no simulador. 3000 bytes deixam folga para as telas.
const MAX_BYTES = 3000;

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "4:10 ~ 4:30/km" -> { lo: 250, hi: 270 } (s/km). Valor único vira faixa de um ponto só.
function faixaRitmo(pace) {
  const m = String(pace || '').match(/\d+[:.]\d{1,2}/g) || [];
  if (!m.length) return null;
  const seg = (x) => { const p = x.match(/(\d+)[:.](\d{1,2})/); return parseInt(p[1], 10) * 60 + parseInt(p[2], 10); };
  const a = seg(m[0]), b = seg(m[m.length > 1 ? 1 : 0]);
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

// "Qui 09/10" -> Date local daquele dia. O ano vem de hoje; datas a mais de ~6 meses de distância
// passam para o ano anterior/seguinte (virada de ano).
function dataDoDia(day, hojeISO) {
  const m = String(day || '').match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const hoje = new Date(hojeISO + 'T00:00:00');
  const d = new Date(hoje.getFullYear(), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  const meioAno = 183 * 86400000;
  if (d - hoje > meioAno) d.setFullYear(d.getFullYear() - 1);
  else if (hoje - d > meioAno) d.setFullYear(d.getFullYear() + 1);
  return d;
}

// Tipo da etapa no relógio: w aquecimento, i tiro, r recuperação, s contínuo, c desaquecimento.
function tipoDaEtapa(etapa, tipoAnterior) {
  const n = semAcento(etapa.name);
  if (n.startsWith('desaq') || n.includes('volta a calma')) return 'c';
  if (n.startsWith('aquec')) return 'w';
  if (n.startsWith('recupera') || n.startsWith('caminhada') || n.startsWith('descanso') || n.startsWith('pausa')) return 'r';
  // "Trote" entre tiros é recuperação; no corre-caminha o trote é a parte corrida.
  if (n.startsWith('trote')) return tipoAnterior === 'i' ? 'r' : 's';
  if (n.startsWith('tiro') || etapa.zona === 'Z5') return 'i';
  // Blocos repetidos ("Moderado 2/6", "Limiar 3/5", "Ritmo de maratona 1/2") são repetições.
  if (/\d+\s*\/\s*\d+/.test(n)) return 'i';
  return 's';
}

// Etapa do app -> [tipo, medida, valor, ritmoMin?, ritmoMax?, nome?]
function etapaCompacta(etapa, tipo) {
  const faixa = faixaRitmo(etapa.pace);
  // Nome só nas etapas contínuas: tiro e recuperação o relógio numera sozinho.
  const nome = tipo === 's' && etapa.name ? String(etapa.name).slice(0, 20) : null;
  let medida, valor = null;
  if (etapa.tipo === 'aberta') { medida = 'o'; }
  else if (etapa.tipo === 'tempo' && etapa.metaSeg > 0) { medida = 't'; valor = Math.round(etapa.metaSeg); }
  else if (etapa.km > 0) { medida = 'd'; valor = Math.round(etapa.km * 1000); }
  else { medida = 'o'; }
  const out = [tipo, medida];
  if (medida !== 'o') out.push(valor);
  if (faixa || nome) {
    if (medida === 'o') out.push(null);
    out.push(faixa ? faixa.lo : null, faixa ? faixa.hi : null);
  }
  if (nome) out.push(nome);
  return out;
}

function etapasDoTreino(entry) {
  return (entry.gpsSteps && entry.gpsSteps.length) ? entry.gpsSteps : (entry.steps || []);
}

// Treino do app -> treino compacto, ou null se não der para correr no relógio.
function treinoCompacto(entry) {
  const etapas = etapasDoTreino(entry).filter(Boolean);
  if (!etapas.length || etapas.length > MAX_ETAPAS) return null;
  const s = [];
  let anterior = null;
  for (const e of etapas) {
    const t = tipoDaEtapa(e, anterior);
    s.push(etapaCompacta(e, t));
    anterior = t;
  }
  if (!s.some((x) => x[1] !== 'o')) return null; // só etapas abertas: nada a medir
  return { id: entry.day, k: entry.day, n: String(entry.type || 'Corrida').slice(0, 24), s };
}

// Próximos treinos de corrida (hoje em diante, não feitos, sem "descansar hoje"), em ordem de data.
// opcoes: { hojeISO: 'AAAA-MM-DD', feito: (entry) => bool }
function treinosParaRelogio(treinos, opcoes) {
  const hojeISO = opcoes.hojeISO;
  const hoje = new Date(hojeISO + 'T00:00:00');
  const feito = opcoes.feito || (() => false);
  const lista = [];
  for (const entry of treinos || []) {
    if (!entry || entry.descanso || feito(entry)) continue;
    const d = dataDoDia(entry.day, hojeISO);
    if (!d || d < hoje) continue;
    const c = treinoCompacto(entry);
    if (c) lista.push({ d, c });
  }
  lista.sort((a, b) => a.d - b.d);
  return lista.slice(0, MAX_TREINOS).map((x) => x.c);
}

// forca (opcional): treinos de musculação já compactados. Com ela a mensagem leva "v":2 e o relógio
// substitui também a lista de musculação; sem ela o formato é o de corrida de sempre.
// Os dois tipos entram alternados (os mais próximos primeiro) até o limite de bytes; o resto fica
// para a próxima sincronização.
function mensagemTreinos(lista, forca, maxBytes) {
  const limite = maxBytes || MAX_BYTES;
  const msg = forca ? { t: 'w', v: 2, w: [] } : { t: 'w', w: [] };
  const filas = forca ? [lista.slice(), forca.slice()] : [lista.slice()];
  let tam = JSON.stringify(msg).length, vez = 0;
  while (filas.some((f) => f.length)) {
    const fila = filas[vez % filas.length]; vez++;
    if (!fila.length) continue;
    const item = fila.shift();
    const custo = JSON.stringify(item).length + 1;
    if (tam + custo > limite) break;
    msg.w.push(item); tam += custo;
  }
  return msg;
}

// ---------- Musculação ----------
const MAX_EXERCICIOS = 12, MAX_SERIES = 10;

function primeiroNumero(v, padrao) {
  const m = String(v == null ? '' : v).replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : padrao;
}
// "60–90s" -> 75; "90s" -> 90; vazio -> 90 (mesma regra de parseDescansoSec do app).
function descansoSeg(descanso) {
  const nums = String(descanso || '').match(/\d+/g);
  if (!nums || !nums.length) return 90;
  return Math.round(nums.map(Number).reduce((a, b) => a + b, 0) / nums.length);
}

// Dia de musculação do app -> treino compacto do relógio ("y":"f").
// dia: { day:'Seg', k:'Seg 05/10', n:'Peito + Tríceps', exercicios:[{ id, nome, series, reps, carga, descanso }] }
// carga já pode vir com a sugestão de progressão do app.
function forcaCompacta(dia) {
  const ex = (dia.exercicios || []).filter(Boolean).slice(0, MAX_EXERCICIOS);
  if (!ex.length) return null;
  const e = ex.map((x, i) => {
    const id = String(x.id || x.repdbId || ('ex' + (i + 1)));
    const n = Math.max(1, Math.min(MAX_SERIES, Math.round(primeiroNumero(x.series, 3))));
    const reps = Math.max(1, Math.round(primeiroNumero(x.reps, 10)));
    const kg = Math.max(0, Math.round(primeiroNumero(x.carga, 0) * 10) / 10);
    const rest = descansoSeg(x.descanso);
    const series = [];
    // Série: [repetições, carga, descanso]. O id da série é "<id do exercício>#<n>" (estável, derivado).
    for (let k = 1; k <= n; k++) series.push([reps, kg, rest]);
    // 4º item (opcional): id da imagem do exercício no app (gifs/<id>.webp), para a página Execução.
    const item = [id, String(x.nome || 'Exercício').slice(0, 40), series];
    if (x.img) item.push(String(x.img));
    return item;
  });
  return { y: 'f', id: 'musc_' + dia.day, k: dia.k, n: String(dia.n || 'Musculação').slice(0, 24), e };
}

// Resultado de musculação do relógio -> dados para a sessão do histórico do app. null se inválido.
function registroForcaDoResultado(r) {
  if (!r || r.kind !== 'strength' || !r.resultId || !r.workoutId) return null;
  const seg = Math.max(0, Math.round(Number(r.durationSec) || 0));
  // Série do relógio: [reps, kg, repsPlanejadas, kgPlanejado] (id = "<exercício>#<n>"), ou o formato
  // anterior em objeto { id, reps, kg, plannedReps, plannedKg }.
  const serie = (e, st, i) => Array.isArray(st)
    ? { id: String(e.id) + '#' + (i + 1), reps: st[0], kg: st[1], plannedReps: st[2], plannedKg: st[3] } : st;
  const exercicios = (Array.isArray(r.exercises) ? r.exercises : []).map((e) => ({
    id: String(e.id), nome: String(e.name || ''),
    // Realizado (peso/reps) e planejado (pesoPlanejado/repsPlanejadas), gravados separados.
    sets: (Array.isArray(e.sets) ? e.sets : []).map((s0, i) => serie(e, s0, i)).filter((st) => st && typeof st === 'object').map((st) => ({ id: String(st.id || ''), peso: Math.max(0, Number(st.kg) || 0), reps: Math.max(0, Math.round(Number(st.reps) || 0)),
      pesoPlanejado: st.plannedKg != null ? Math.max(0, Number(st.plannedKg) || 0) : null,
      repsPlanejadas: st.plannedReps != null ? Math.max(0, Math.round(Number(st.plannedReps) || 0)) : null })),
  })).filter((e) => e.sets.length);
  if (!exercicios.length) return null;
  const inicio = r.startedAt > 0 ? r.startedAt * 1000 : null;
  return {
    logId: 'musc_garmin_' + String(r.resultId).replace(/[^A-Za-z0-9_-]/g, '_'),
    resultId: String(r.resultId),
    day: String(r.workoutId).replace(/^musc_/, ''),
    inicio, fim: inicio != null ? inicio + seg * 1000 : null, seg,
    fcMedia: r.avgHeartRate > 0 ? Math.round(r.avgHeartRate) : null,
    series: exercicios.reduce((n, e) => n + e.sets.length, 0),
    exercicios,
  };
}
function mensagemAck(ids) { return { t: 'ack', ids }; }

// Resultado vindo do relógio -> dados para gravar como corrida do app. null se inválido.
function registroDoResultado(r) {
  if (!r || typeof r !== 'object' || !r.resultId || !r.workoutId || r.kind === 'strength') return null;
  const seg = Math.max(0, Math.round(Number(r.durationSec) || 0));
  const km = Math.max(0, Math.round(Number(r.distanceMeters) || 0)) / 1000;
  if (seg <= 0) return null;
  const inicio = r.startedAt > 0 ? r.startedAt * 1000 : null;
  const etapas = (Array.isArray(r.steps) ? r.steps : []).map((e) => {
    const eSeg = Math.round(Number(e.durationSec) || 0), eKm = (Math.round(Number(e.distanceMeters) || 0)) / 1000;
    return { tipo: String(e.name || 'Etapa'), duracao_alvo: null, duracao_real_seg: eSeg, distancia_real_km: eKm,
      pace_medio_real: eKm > 0 ? (eSeg / 60) / eKm : null };
  });
  return {
    // "run_" no início: é o que gpsEhCorridaSalva/sincronizarCorridasGps reconhecem como corrida gravada.
    runId: 'run_garmin_' + String(r.resultId).replace(/[^A-Za-z0-9_-]/g, '_'),
    resultId: String(r.resultId),
    livre: r.workoutId === 'free',
    day: r.workoutId === 'free' ? null : String(r.workoutId),
    inicio, fim: inicio != null ? inicio + seg * 1000 : null,
    km, seg, fcMedia: r.avgHeartRate > 0 ? Math.round(r.avgHeartRate) : null, etapas,
  };
}

module.exports = {
  MAX_TREINOS, MAX_ETAPAS, faixaRitmo, dataDoDia, tipoDaEtapa, etapaCompacta, treinoCompacto,
  treinosParaRelogio, mensagemTreinos, mensagemAck, registroDoResultado, MAX_BYTES,
  MAX_EXERCICIOS, MAX_SERIES, descansoSeg, forcaCompacta, registroForcaDoResultado,
};
