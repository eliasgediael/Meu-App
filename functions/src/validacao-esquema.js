// Barreira estrutural compartilhada entre Cloud Function e Worker; não substitui F/R/V do app.
function conferirEsquema(v, s) {
  if (s.enum && !s.enum.includes(v)) return false;
  if (s.type === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    if ((s.required || []).some(k => !Object.prototype.hasOwnProperty.call(v, k))) return false;
    return Object.keys(v).every(k => Object.prototype.hasOwnProperty.call(s.properties || {}, k) && conferirEsquema(v[k], s.properties[k]));
  }
  if (s.type === 'array') return Array.isArray(v) && (s.minItems === undefined || v.length >= s.minItems) && (s.maxItems === undefined || v.length <= s.maxItems) && v.every(x => conferirEsqumaItem(x, s));
  if (s.type === 'string') return typeof v === 'string' && (s.maxLength === undefined || v.length <= s.maxLength);
  if (s.type === 'integer') return Number.isInteger(v) && (s.minimum === undefined || v >= s.minimum) && (s.maximum === undefined || v <= s.maximum);
  return false;
}
function conferirEsqumaItem(x, s) { return conferirEsquema(x, s.items); }
module.exports = { conferirEsquema };
