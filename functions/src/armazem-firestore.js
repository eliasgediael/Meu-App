// Cotas e cache da função no Firestore (coleções só do servidor: as regras do Firestore devem negar acesso do app).
//   iaUso/{uid}_{dia}     → { n }   chamadas do usuário no dia
//   iaUsoGlobal/{mes}     → { n }   chamadas do mês (todos os usuários)
//   iaCache/{hash}        → { resposta, modelo, expiraEm }
function criarArmazemFirestore(db) {
  return {
    async consumirCota({ uid, dia, mes, limiteDia, limiteMes }) {
      const refU = db.collection('iaUso').doc(`${uid}_${dia}`);
      const refG = db.collection('iaUsoGlobal').doc(mes);
      return db.runTransaction(async (t) => {
        const [u, g] = await Promise.all([t.get(refU), t.get(refG)]);
        const nU = (u.exists && u.data().n) || 0, nG = (g.exists && g.data().n) || 0;
        if (nU >= limiteDia) return { ok: false, motivo: 'limite diário do usuário' };
        if (nG >= limiteMes) return { ok: false, motivo: 'limite mensal do app' };
        t.set(refU, { n: nU + 1, uid, dia }, { merge: true });
        t.set(refG, { n: nG + 1 }, { merge: true });
        return { ok: true };
      });
    },
    async lerCache(hash) {
      const s = await db.collection('iaCache').doc(hash).get();
      return s.exists ? s.data() : null;
    },
    async gravarCache(hash, valor) {
      await db.collection('iaCache').doc(hash).set(valor);
    },
  };
}

module.exports = { criarArmazemFirestore };
