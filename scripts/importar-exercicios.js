// Importa os exercícios de gifs-fonte/ para o app:
//  - converte cada GIF em WebP animado 240x240 (qualidade 70) em gifs/<id>.webp
//  - gera data/exercicios.json com nomes/passos em PT-BR (scripts/traducoes.json)
// Uso: node scripts/importar-exercicios.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const FONTE = path.join(RAIZ, 'gifs-fonte');
const DESTINO = path.join(RAIZ, 'gifs');
const DATA = path.join(RAIZ, 'data');

const MUSCULOS = {
  'pectorals': 'Peitoral', 'serratus anterior': 'Serrátil anterior', 'traps': 'Trapézio', 'trapezius': 'Trapézio',
  'lats': 'Dorsal', 'latissimus dorsi': 'Dorsal', 'upper back': 'Parte superior das costas', 'spine': 'Coluna',
  'glutes': 'Glúteos', 'quads': 'Quadríceps', 'quadriceps': 'Quadríceps', 'calves': 'Panturrilha',
  'hamstrings': 'Posterior de coxa', 'abductors': 'Abdutores', 'adductors': 'Adutores', 'inner thighs': 'Adutores',
  'delts': 'Deltoides', 'deltoids': 'Deltoides', 'rear deltoids': 'Deltoide posterior', 'shoulders': 'Ombros',
  'biceps': 'Bíceps', 'triceps': 'Tríceps', 'forearms': 'Antebraço', 'abs': 'Abdômen', 'core': 'Core',
  'cardiovascular system': 'Sistema cardiovascular', 'rhomboids': 'Romboides', 'chest': 'Peitoral',
  'upper chest': 'Peitoral superior', 'lower back': 'Lombar', 'soleus': 'Sóleo', 'ankle stabilizers': 'Estabilizadores do tornozelo',
  'ankles': 'Tornozelos', 'feet': 'Pés', 'rotator cuff': 'Manguito rotador', 'brachialis': 'Braquial',
  'hip flexors': 'Flexores do quadril', 'obliques': 'Oblíquos'
};
const EQUIPAMENTOS = {
  'dumbbell': 'Halteres', 'body weight': 'Peso corporal', 'barbell': 'Barra', 'leverage machine': 'Máquina',
  'smith machine': 'Smith', 'cable': 'Polia', 'kettlebell': 'Kettlebell', 'medicine ball': 'Bola medicinal',
  'band': 'Elástico', 'weighted': 'Peso adicional', 'sled machine': 'Trenó', 'ez barbell': 'Barra W'
};
const GRUPOS = { 'Cardio/Pliometria': 'Cardio' };

function parseCsv(text, sep) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
// "45� side bend" -> "45° side bend" (caractere de grau quebrado no CSV)
const limpa = s => (s || '').replace(/(\d)�/g, '$1°').replace(/�/g, '');
const porN = (e, pref) => Object.keys(e).filter(k => k.startsWith(pref + '/'))
  .sort((a, b) => parseInt(a.split('/')[1]) - parseInt(b.split('/')[1])).map(k => limpa(e[k])).filter(Boolean);

async function main() {
  const lerCsv = (f, sep) => parseCsv(fs.readFileSync(path.join(FONTE, f), 'utf8').replace(/^﻿/, ''), sep);
  const linhas = lerCsv('exercises.csv', ',');
  const cab = linhas[0];
  const todos = new Map();
  linhas.slice(1).filter(r => r.length > 3).forEach(r => {
    const o = {}; cab.forEach((h, i) => o[h] = r[i] || ''); todos.set(o.id, o);
  });
  const sel = lerCsv('exercicios-selecionados.csv', ';').slice(1).filter(r => r.length > 2 && r[0]);
  const trad = JSON.parse(fs.readFileSync(path.join(__dirname, 'traducoes.json'), 'utf8'));

  fs.mkdirSync(DESTINO, { recursive: true });
  fs.mkdirSync(DATA, { recursive: true });

  const lista = []; const avisos = []; let bytes = 0;
  for (const r of sel) {
    const id = r[0].trim();
    const e = todos.get(id);
    if (!e) { avisos.push('sem dados no exercises.csv: ' + id); continue; }
    const t = trad[id];
    if (!t) { avisos.push('sem tradução: ' + id); continue; }
    const gif = path.join(FONTE, id + '.gif');
    const webp = path.join(DESTINO, id + '.webp');
    if (fs.existsSync(gif)) {
      await sharp(gif, { animated: true }).resize(240, 240, { fit: 'cover' }).webp({ quality: 70, effort: 4 }).toFile(webp);
      bytes += fs.statSync(webp).size;
    } else avisos.push('sem gif: ' + id);
    const grupo = GRUPOS[r[2]] || r[2];
    const trM = m => MUSCULOS[m] || m;
    const prim = trM(e.target);
    const sec = [...new Set(porN(e, 'secondaryMuscles').map(trM))].filter(m => m !== prim);
    lista.push({
      id, nome: t[0], nomeEn: limpa(e.name), grupo,
      musculoPrim: prim, musculosSec: sec,
      equipamento: EQUIPAMENTOS[e.equipment] || e.equipment,
      passos: t[1], apelidos: t[2] || []
    });
  }
  // Correções da auditoria de mídia (ângulos de câmera duplicados, animação que não confere, nome/passos):
  // ficam em scripts/correcoes-exercicios.json pra não se perderem quando o catálogo é regerado.
  const corr = JSON.parse(fs.readFileSync(path.join(__dirname, 'correcoes-exercicios.json'), 'utf8'));
  lista.forEach(ex => { if (corr[ex.id]) Object.assign(ex, corr[ex.id]); });
  fs.writeFileSync(path.join(DATA, 'exercicios.json'), JSON.stringify(lista, null, 1));
  console.log('exercícios gerados:', lista.length);
  console.log('WebP gerados: ' + (bytes / 1024 / 1024).toFixed(2) + ' MB (' + (bytes / 1024).toFixed(0) + ' KB)');
  if (avisos.length) console.log('AVISOS:\n' + avisos.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
