// Armazém da função refinar (mesma interface do functions/src/armazem-firestore.js), versão Cloudflare:
//   cache das respostas → Workers KV (expira sozinho; leitura eventualmente consistente, o que basta para cache)
//   cotas               → Durable Object CotaIA (atômico: chamadas simultâneas não passam do limite)
// No cache só vai a resposta da IA (ids de exercício, séries, reps...): nada pessoal.

const PREFIXO_CACHE = 'cache:';
const TTL_MINIMO_SEG = 60; // o KV não aceita expiração menor que 60 s

// opcoes: { kv, cotas: { consumir(d) → Promise<{ ok, motivo }> }, limites: { diaGlobal, minuto }, agora? }
function criarArmazemCloudflare(opcoes) {
  const { kv, cotas, limites } = opcoes;
  const agora = opcoes.agora || (() => Date.now());
  return {
    async consumirCota({ uid, dia, mes, limiteDia, limiteMes }) {
      return cotas.consumir({ uid, dia, mes, limiteDia, limiteMes, limiteDiaGlobal: limites.diaGlobal, limiteMinuto: limites.minuto });
    },
    async lerCache(hash) {
      if (!/^[0-9a-f]{64}$/.test(hash)) return null;
      return kv.get(PREFIXO_CACHE + hash, { type: 'json' });
    },
    async gravarCache(hash, valor) {
      if (!/^[0-9a-f]{64}$/.test(hash)) return;
      const ttl = Math.max(TTL_MINIMO_SEG, Math.round(((valor && valor.expiraEm) - agora()) / 1000) || 0);
      await kv.put(PREFIXO_CACHE + hash, JSON.stringify(valor), { expirationTtl: ttl });
    },
  };
}

// Liga o armazém ao Durable Object "global" do Worker.
function cotasDoDurableObject(namespace) {
  return {
    async consumir(d) {
      const stub = namespace.get(namespace.idFromName('global'));
      const r = await stub.fetch('https://cotas.interno/consumir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json();
      return (j && typeof j.ok === 'boolean') ? j : { ok: false, motivo: 'cota indisponível' };
    },
  };
}

export { criarArmazemCloudflare, cotasDoDurableObject, PREFIXO_CACHE };
