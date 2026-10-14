// O esquema do projeto usa tipos em minúsculas (JSON Schema); a REST do generateContent usa o enum Type
// (STRING, INTEGER, OBJECT, ARRAY...). Copia o resto como está (enum, minimum, maxItems, required, propertyOrdering...).
function paraEsquemaGemini(no) {
  if (Array.isArray(no)) return no.map(paraEsquemaGemini);
  if (!no || typeof no !== 'object') return no;
  const out = {};
  for (const [k, v] of Object.entries(no)) {
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([nome, s]) => [nome, paraEsquemaGemini(s)]));
    else out[k] = (v && typeof v === 'object') ? paraEsquemaGemini(v) : v;
  }
  return out;
}

// Esquema para o campo responseJsonSchema (JSON Schema, tipos em minúsculas). Na etapa B o Gemini recusou o
// responseSchema (OpenAPI) com 400 INVALID_ARGUMENT; o SDK oficial indica o responseJsonSchema como alternativa e
// lista o que ele aceita: type, enum, items, minItems, maxItems, minimum, maximum, properties, required,
// additionalProperties, propertyOrdering... Sai só o que não está na lista (maxLength): o tamanho do id continua
// conferido no servidor (id só da lista enviada) e no app (F0/F9). Objetos ganham additionalProperties:false.
const CHAVES_JSON_SCHEMA = ['type', 'enum', 'items', 'minItems', 'maxItems', 'minimum', 'maximum', 'properties', 'required', 'propertyOrdering', 'additionalProperties', 'description', 'title', 'format'];
function paraJsonSchemaGemini(no) {
  if (Array.isArray(no)) return no.map(paraJsonSchemaGemini);
  if (!no || typeof no !== 'object') return no;
  const out = {};
  for (const [k, v] of Object.entries(no)) {
    if (!CHAVES_JSON_SCHEMA.includes(k)) continue;
    if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([nome, s]) => [nome, paraJsonSchemaGemini(s)]));
    else if (k === 'items') out.items = paraJsonSchemaGemini(v);
    else out[k] = v;
  }
  if (out.type === 'object' && !('additionalProperties' in out)) out.additionalProperties = false;
  return out;
}

// Limites que a API do Gemini recusa no esquema de resposta (diagnóstico de 2026-10-14: com eles, 400
// INVALID_ARGUMENT; sem eles, 200). Saem SÓ do esquema enviado ao Google: o esquema completo
// (functions/src/esquema-resposta.json) continua inteiro no app (F0) e todas essas faixas continuam conferidas
// por F0, F2, F5, D1 e F9 e, no servidor, pela barreira de ids.
const LIMITES_RECUSADOS = ['minimum', 'maximum', 'minItems', 'maxItems', 'maxLength'];
function semLimitesRecusados(no) {
  if (Array.isArray(no)) return no.map(semLimitesRecusados);
  if (!no || typeof no !== 'object') return no;
  const out = {};
  for (const [k, v] of Object.entries(no)) {
    if (LIMITES_RECUSADOS.includes(k)) continue;
    if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([nome, s]) => [nome, semLimitesRecusados(s)]));
    else out[k] = (k === 'enum' || k === 'required' || k === 'propertyOrdering') ? v : semLimitesRecusados(v);
  }
  return out;
}
// O que vai de fato no pedido ao Google, nos dois formatos.
const esquemaParaGoogle = (esquema, formato) => semLimitesRecusados(formato === 'json' ? paraJsonSchemaGemini(esquema) : paraEsquemaGemini(esquema));


module.exports = { paraEsquemaGemini, paraJsonSchemaGemini, semLimitesRecusados, esquemaParaGoogle, LIMITES_RECUSADOS };
