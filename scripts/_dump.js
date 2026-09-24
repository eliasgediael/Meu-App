const fs = require('fs');
function parseCsv(text, sep){
  const rows = []; let row = [], cur = '', q = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true;
    else if(c===sep){ row.push(cur); cur=''; }
    else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else if(c!=='\r') cur+=c;
  }
  if(cur||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
const ex = fs.readFileSync('gifs-fonte/exercises.csv','utf8').replace(/^\uFEFF/,'');
const rows = parseCsv(ex, ',');
const head = rows[0];
const recs = rows.slice(1).filter(r=>r.length>3).map(r=>{ const o={}; head.forEach((h,i)=>o[h]=r[i]||''); return o; });
console.log('registros', recs.length, 'com FFFD', recs.filter(r=>JSON.stringify(r).includes('\uFFFD')).length);
const sel = parseCsv(fs.readFileSync('gifs-fonte/exercicios-selecionados.csv','utf8').replace(/^\uFEFF/,''), ';').filter(r=>r.length>2);
console.log('selecionados', sel.length-1, sel[0]);
const byId = new Map(recs.map(r=>[r.id,r]));
const out = []; const faltando = [];
sel.slice(1).forEach(r=>{
  const id = r[0]; const e = byId.get(id); if(!e){ faltando.push(id); return; }
  const sec = Object.keys(e).filter(k=>k.startsWith('secondaryMuscles/')).sort((a,b)=>parseInt(a.split('/')[1])-parseInt(b.split('/')[1])).map(k=>e[k]).filter(Boolean);
  const ins = Object.keys(e).filter(k=>k.startsWith('instructions/')).sort((a,b)=>parseInt(a.split('/')[1])-parseInt(b.split('/')[1])).map(k=>e[k]).filter(Boolean);
  out.push({ id, nomeEn:e.name, grupo:r[2], target:e.target, bodyPart:e.bodyPart, equip:e.equipment, sec, ins });
});
console.log('faltando', faltando);
const bad = out.filter(o=>/\uFFFD/.test(JSON.stringify(o))); console.log('quebrados', bad.map(b=>b.id+':'+b.nomeEn));
const grupos = {}; out.forEach(o=>grupos[o.grupo]=(grupos[o.grupo]||0)+1); console.log(grupos);
const eq = {}; out.forEach(o=>eq[o.equip]=(eq[o.equip]||0)+1); console.log(eq);
const tg = {}; out.forEach(o=>{ tg[o.target]=(tg[o.target]||0)+1; o.sec.forEach(s=>tg[s]=(tg[s]||0)+1); }); console.log(Object.keys(tg).join(', '));
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 0));
