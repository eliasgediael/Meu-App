// Controle de cotas da IA num Durable Object (SQLite, disponível no plano Free do Workers).
// Um único objeto ("global") atende todas as requisições, uma de cada vez: a verificação e a soma acontecem
// juntas, então chamadas simultâneas nunca passam do limite (o KV não serve para isso: é eventualmente consistente).
//
// Limites conferidos a cada chamada que vai ao Gemini (cache não conta):
//   por usuário por dia (fuso de Brasília)       → u|<uid>|<dia>
//   global por dia (fuso do Pacífico, o mesmo em que o Google zera a cota diária do Gemini) → gd|<dia>
//   global por minuto (cota por minuto do Gemini) → mi|<AAAA-MM-DDTHH:MM>
//   global por mês                                → gm|<AAAA-MM>

const PREFIXOS_DIARIOS = ['u|', 'gd|', 'mi|'];

function diaPacifico(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
function minutoUTC(ms) { return new Date(ms).toISOString().slice(0, 16); }

// Lógica pura sobre um storage com get(array) → Map e put(objeto). Quem chama garante uma chamada por vez.
// d: { uid, dia, mes, limiteDia, limiteMes, limiteDiaGlobal, limiteMinuto, agora }
async function consumirCota(storage, d) {
  const uid = String(d.uid || '');
  if (!uid || uid.length > 128 || !/^\d{4}-\d{2}-\d{2}$/.test(d.dia || '') || !/^\d{4}-\d{2}$/.test(d.mes || '')) return { ok: false, motivo: 'pedido de cota inválido' };
  const kU = `u|${uid}|${d.dia}`, kGD = `gd|${diaPacifico(d.agora)}`, kMI = `mi|${minutoUTC(d.agora)}`, kGM = `gm|${d.mes}`;
  const atuais = await storage.get([kU, kGD, kMI, kGM]);
  const n = (k) => atuais.get(k) || 0;
  if (n(kU) >= d.limiteDia) return { ok: false, motivo: 'limite diário do usuário' };
  if (n(kMI) >= d.limiteMinuto) return { ok: false, motivo: 'limite por minuto do app' };
  if (n(kGD) >= d.limiteDiaGlobal) return { ok: false, motivo: 'limite diário do app' };
  if (n(kGM) >= d.limiteMes) return { ok: false, motivo: 'limite mensal do app' };
  await storage.put({ [kU]: n(kU) + 1, [kGD]: n(kGD) + 1, [kMI]: n(kMI) + 1, [kGM]: n(kGM) + 1 });
  return { ok: true };
}

// Apaga contadores diários e por minuto com mais de 3 dias (o mensal fica: são 12 linhas por ano).
async function limparAntigos(storage, agora) {
  const corte = new Date(agora - 3 * 86400000).toISOString().slice(0, 10);
  const apagar = [];
  for (const p of PREFIXOS_DIARIOS) {
    const itens = await storage.list({ prefix: p });
    for (const k of itens.keys()) {
      const data = p === 'u|' ? k.slice(k.lastIndexOf('|') + 1) : k.slice(p.length, p.length + 10);
      if (data < corte) apagar.push(k);
    }
  }
  for (let i = 0; i < apagar.length; i += 128) await storage.delete(apagar.slice(i, i + 128));
  return apagar.length;
}

class CotaIA {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.fila = Promise.resolve();
  }
  // Fila explícita: mesmo que o runtime intercale requisições, uma cota só é conferida depois da anterior terminar.
  consumir(d) {
    const vez = this.fila.then(() => consumirCota(this.ctx.storage, { ...d, agora: Date.now() }));
    this.fila = vez.catch(() => {});
    return vez;
  }
  async fetch(request) {
    let d;
    try { d = await request.json(); } catch (e) { return Response.json({ ok: false, motivo: 'pedido de cota inválido' }, { status: 400 }); }
    const r = await this.consumir(d);
    if (r.ok && this.ctx.storage.getAlarm && !(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 86400000);
    return Response.json(r);
  }
  async alarm() {
    await limparAntigos(this.ctx.storage, Date.now());
    await this.ctx.storage.setAlarm(Date.now() + 86400000);
  }
}

export { CotaIA, consumirCota, limparAntigos, diaPacifico, minutoUTC };
