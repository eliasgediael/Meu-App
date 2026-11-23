// Acrescenta ao catálogo os exercícios do plano Hyrox que não tinham imagem (Pallof press, Band pull-apart,
// Copenhagen plank). Os GIFs vêm do mesmo conjunto exercises-gifs já usado pelo app.
// Uso: node scripts/adicionar-exercicios-hyrox.js [pasta assets do exercises-gifs]. Pode rodar de novo: não duplica.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = process.argv[2] || path.join(process.env.USERPROFILE || '', 'exercises-gifs-repo', 'assets');
const CATALOGO = path.join(RAIZ, 'data', 'exercicios.json');
const GIFS = path.join(RAIZ, 'gifs');
const LADO = 180;

const NOVOS = [
  { id: '0979', nome: 'Pallof press com elástico', nomeEn: 'band horizontal pallof press', grupo: 'Core', musculoPrim: 'Abdômen', musculosSec: ['Oblíquos', 'Ombros'], equipamento: 'Elástico',
    apelidos: ['pallof press', 'pallof'],
    passos: ['Prenda o elástico na altura do peito e fique de lado para o ponto de fixação, com os pés na largura dos ombros.', 'Segure o elástico com as duas mãos junto ao peito, com o abdômen contraído.', 'Estenda os braços à frente sem deixar o tronco girar.', 'Segure um instante e volte as mãos ao peito de forma controlada. Repita e troque de lado.'] },
  { id: '0993', nome: 'Crucifixo inverso com elástico', nomeEn: 'band reverse fly', grupo: 'Ombro', musculoPrim: 'Deltoide posterior', musculosSec: ['Costas', 'Trapézio'], equipamento: 'Elástico',
    apelidos: ['band pull-apart', 'abertura com elástico'],
    passos: ['Fique em pé com o elástico seguro nas duas mãos, braços estendidos à frente na altura dos ombros.', 'Afaste as mãos abrindo os braços para os lados, juntando as escápulas.', 'Segure um instante com o elástico na altura do peito.', 'Volte devagar à posição inicial.'] },
  { id: '1775', nome: 'Prancha lateral com adução do quadril', nomeEn: 'side plank hip adduction', grupo: 'Core', musculoPrim: 'Adutores', musculosSec: ['Oblíquos', 'Abdômen'], equipamento: 'Peso corporal',
    apelidos: ['copenhagen plank', 'prancha copenhagen'],
    passos: ['Deite de lado e apoie o antebraço no chão, com o cotovelo abaixo do ombro.', 'Apoie a perna de cima em um banco ou no chão à frente e mantenha a de baixo solta.', 'Eleve o quadril formando uma linha reta e suba a perna de baixo em direção à de cima.', 'Segure pelo tempo desejado, desça com controle e repita do outro lado.'] },
];

(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const ids = new Set(cat.map((e) => e.id));
  let novos = 0, convertidos = 0;
  for (const n of NOVOS) {
    const webp = path.join(GIFS, n.id + '.webp');
    if (!fs.existsSync(webp)) {
      const gif = path.join(ORIGEM, n.id + '.gif');
      if (!fs.existsSync(gif)) throw new Error('GIF ausente: ' + gif);
      await sharp(gif, { animated: true }).resize(LADO, LADO, { fit: 'cover' }).webp({ quality: 70, effort: 4 }).toFile(webp);
      convertidos++;
    }
    if (!ids.has(n.id)) { cat.push({ ...n, origemMidia: 'exercises-gifs' }); novos++; }
  }
  fs.writeFileSync(CATALOGO, JSON.stringify(cat, null, 1));
  console.log('novos:', novos, '| GIFs convertidos:', convertidos, '| total:', cat.length);
})().catch((e) => { console.error(e); process.exit(1); });
