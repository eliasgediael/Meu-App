// Cliente do Worker (Cloudflare) que fala com o Gemini. Ainda NÃO está no app: entra na etapa D, com aprovação.
// Devolve a função chamarFuncao(pedido) que iaRefinarSemana espera. Qualquer falha vira exceção, e o
// iaRefinarSemana fica com o plano do Motor V2.
/* eslint-disable */

// opcoes: { url: 'https://forza-ia.<subdominio>.workers.dev', obterToken: () → Promise<string>, fetch? }
function iaCriarChamadaServidor(opcoes){
  const url = String((opcoes && opcoes.url) || '').replace(/\/+$/,'');
  const obterToken = opcoes && opcoes.obterToken;
  const fetchFn = (opcoes && opcoes.fetch) || ((...a)=>fetch(...a));
  return async function chamarFuncao(pedido){
    if(!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error('servidor_sem_url');
    if(typeof obterToken!=='function') throw new Error('servidor_sem_login');
    const token = await obterToken();
    if(!token || typeof token!=='string') throw new Error('servidor_sem_login');
    const r = await fetchFn(url + '/refinar', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token },
      body: JSON.stringify({ consentimento:true, pedido }),
    });
    let j = null;
    try{ j = await r.json(); }catch(e){ throw new Error('servidor_resposta_invalida'); }
    if(!r.ok || !j || j.erro) throw new Error('servidor_' + ((j && j.erro && j.erro.codigo) || r.status));
    if(!j.resposta || typeof j.resposta!=='object') throw new Error('servidor_resposta_invalida');
    return j; // { resposta, modelo, cache } — iaRefinarSemana usa .resposta
  };
}

export { iaCriarChamadaServidor };
