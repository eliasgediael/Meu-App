'use strict';
// Extensão isolada, ainda sem endpoint/ativação. Nunca modifica prescrição, GIF ou anatomia.
const CONTRATO='exercicio-educativo/1';
const PAPEIS=new Set(['geral','principal','complementar','aquecimento']);
const campos=(o,lista)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===lista.length&&lista.every(k=>Object.hasOwn(o,k));
const texto=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[<>\u0000-\u001f]/.test(v);
function pedido(catalogo,id,versaoCatalogo,papel='geral'){
 const e=catalogo.find(e=>e.id===id);if(!e||!texto(versaoCatalogo,100)||!PAPEIS.has(papel))throw Error('contexto_invalido');
 return {contrato:CONTRATO,id:e.id,versaoCatalogo,papel,exercicio:{nome:e.nome,equipamento:e.equipamento,passos:e.passos.slice(0,8)}};
}
function validar(r,p){
 if(!campos(r,['contrato','id','versaoCatalogo','papel','passos','atencao','explicacao']))return false;
 if(r.contrato!==CONTRATO||r.id!==p.id||r.versaoCatalogo!==p.versaoCatalogo||r.papel!==p.papel)return false;
 return Array.isArray(r.passos)&&r.passos.length>=1&&r.passos.length<=6&&r.passos.every(x=>texto(x,220))&&Array.isArray(r.atencao)&&r.atencao.length<=3&&r.atencao.every(x=>texto(x,180))&&texto(r.explicacao,320);
}
function criarLeitor({catalogo,versaoCatalogo,chamar,habilitado=false,timeoutMs=5000}){
 const cache=new Map(),pendentes=new Map();
 return async function ler(id,papel='geral'){
  const p=pedido(catalogo,id,versaoCatalogo,papel),e=catalogo.find(e=>e.id===id);
  const fallback=()=>({origem:'catalogo',id,passos:[...e.passos],atencao:[],explicacao:''});
  if(!habilitado||typeof chamar!=='function')return fallback();
  const key=JSON.stringify([CONTRATO,versaoCatalogo,id,papel]);if(cache.has(key))return structuredClone(cache.get(key));
  if(pendentes.has(key))return structuredClone(await pendentes.get(key));
  const tarefa=(async()=>{let timer;try{const r=await Promise.race([Promise.resolve().then(()=>chamar(p)),new Promise((_,rej)=>{timer=setTimeout(()=>rej(Error('timeout')),timeoutMs)})]);if(!validar(r,p))return fallback();const v={...structuredClone(r),origem:'gemini'};cache.set(key,v);return v;}catch{return fallback();}finally{clearTimeout(timer);}})();
  pendentes.set(key,tarefa);try{return structuredClone(await tarefa);}finally{pendentes.delete(key);}
 };
}
module.exports={CONTRATO,pedido,validar,criarLeitor};
