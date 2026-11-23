// Acrescenta ao catálogo as estações do Hyrox como exercícios (ids 9001-9008), cada uma com imagem.
// Fontes: GIFs 3D (SisuLift) em hyrox-sisulift e GIFs feitos pelo usuário (Sled Pull, Remo, Sandbag Lunges).
// Uso: node scripts/adicionar-estacoes-hyrox.js [pasta hyrox-sisulift] [pasta hyrox-src]. Pode rodar de novo: não duplica.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const HOME = process.env.USERPROFILE || '';
const GIF_DIR = process.argv[2] || path.join(HOME, 'hyrox-sisulift');
const IMG_DIR = process.argv[3] || path.join(HOME, 'hyrox-src');
// GIFs feitos pelo usuário (Sled Pull, Remo, Sandbag Lunges): pasta gifs do app local.
const MEUS_GIFS = process.argv[4] || path.join(HOME, 'Downloads', 'FORZA RUN', 'gifs');
const CATALOGO = path.join(RAIZ, 'data', 'exercicios.json');
const GIFS = path.join(RAIZ, 'gifs');
const LADO = 180;

const ESTACOES = [
  { id: '9001', fonte: path.join(GIF_DIR, 'ski-ergometer.gif'), nome: 'SkiErg', nomeEn: 'skierg', grupo: 'Cardio', musculoPrim: 'Dorsais', musculosSec: ['Tríceps', 'Core', 'Pernas'], equipamento: 'Máquina', apelidos: ['ski erg', 'ski'],
    passos: ['Fique de frente para a máquina, pés na largura dos ombros, e segure as duas alças no alto.', 'Puxe as alças para baixo com os braços e o tronco, flexionando quadril e joelhos.', 'Volte as mãos acima da cabeça de forma controlada e repita em ritmo constante.'] },
  { id: '9002', fonte: path.join(GIF_DIR, 'sled-push.gif'), nome: 'Sled Push', nomeEn: 'sled push', grupo: 'Pernas', musculoPrim: 'Quadríceps', musculosSec: ['Glúteos', 'Ombros', 'Core'], equipamento: 'Trenó', apelidos: ['empurrar trenó', 'sled'],
    passos: ['Segure o trenó nas hastes com os braços estendidos e o tronco inclinado à frente.', 'Empurre com passadas curtas e fortes, mantendo as costas retas.', 'Continue até completar a distância (50 m na prova).'] },
  { id: '9003', fonte: path.join(MEUS_GIFS, 'hyrox-sled-pull.gif'), nome: 'Sled Pull', nomeEn: 'sled pull', grupo: 'Costas', musculoPrim: 'Dorsais', musculosSec: ['Bíceps', 'Glúteos', 'Pernas'], equipamento: 'Trenó', apelidos: ['puxar trenó', 'sled drag'],
    passos: ['Fique de frente para o trenó e segure a corda com as duas mãos.', 'Puxe a corda mão sobre mão, inclinando o tronco para trás e mantendo os pés firmes.', 'Continue até o trenó chegar até você (50 m na prova).'] },
  { id: '9004', fonte: path.join(GIF_DIR, 'burpee-broad-jump.gif'), nome: 'Burpee Broad Jump', nomeEn: 'burpee broad jump', grupo: 'Cardio', musculoPrim: 'Corpo todo', musculosSec: ['Peito', 'Pernas', 'Core'], equipamento: 'Peso corporal', apelidos: ['burpee', 'salto em distância'],
    passos: ['Faça um burpee: agache, apoie as mãos, estenda as pernas e desça o peito ao chão.', 'Levante-se e salte para a frente o mais longe possível, com os dois pés.', 'Repita a sequência até completar a distância (80 m na prova).'] },
  { id: '9005', fonte: path.join(MEUS_GIFS, 'hyrox-remo.gif'), nome: 'Remo (ergômetro)', nomeEn: 'rowing machine', grupo: 'Costas', musculoPrim: 'Dorsais', musculosSec: ['Pernas', 'Bíceps', 'Core'], equipamento: 'Máquina', apelidos: ['remo', 'rowing', 'concept2'],
    passos: ['Sente na máquina, pés presos e joelhos dobrados, segurando o puxador.', 'Empurre com as pernas, incline o tronco para trás e puxe o puxador até o abdômen.', 'Volte na ordem inversa: braços, tronco e pernas. Repita em ritmo constante.'] },
  { id: '9006', fonte: path.join(GIF_DIR, 'farmers-walk.gif'), nome: 'Farmers Carry', nomeEn: 'farmers carry', grupo: 'Pernas', musculoPrim: 'Antebraço', musculosSec: ['Trapézio', 'Core', 'Pernas'], equipamento: 'Halteres', apelidos: ['farmers', 'caminhada do fazendeiro hyrox'],
    passos: ['Segure um implemento pesado em cada mão (24 kg cada na prova masculina).', 'Fique ereto, ombros para trás e abdômen firme.', 'Caminhe com passos rápidos e controlados até completar a distância (200 m na prova).'] },
  { id: '9007', fonte: path.join(MEUS_GIFS, 'hyrox-sandbag-lunges.gif'), nome: 'Sandbag Lunges', nomeEn: 'sandbag lunges', grupo: 'Pernas', musculoPrim: 'Quadríceps', musculosSec: ['Glúteos', 'Core'], equipamento: 'Peso adicional', apelidos: ['avanço com sandbag', 'lunges'],
    passos: ['Apoie o sandbag nos ombros (20 kg na prova masculina) e fique ereto.', 'Dê um passo à frente e desça até o joelho de trás quase tocar o chão.', 'Suba empurrando com a perna da frente e troque de perna. Siga até completar a distância (100 m na prova).'] },
  { id: '9008', fonte: path.join(GIF_DIR, 'wall-ball.gif'), nome: 'Wall Balls', nomeEn: 'wall balls', grupo: 'Pernas', musculoPrim: 'Quadríceps', musculosSec: ['Ombros', 'Glúteos', 'Core'], equipamento: 'Bola medicinal', apelidos: ['wall ball', 'arremesso na parede'],
    passos: ['Fique de frente para a parede segurando a bola junto ao peito.', 'Agache até a coxa ficar paralela ao chão.', 'Suba explosivamente e arremesse a bola no alvo (3 m). Pegue e repita (100 repetições na prova).'] },
];

(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const ids = new Set(cat.map((e) => e.id));
  let novos = 0, convertidos = 0;
  for (const { fonte, ...reg } of ESTACOES) {
    const webp = path.join(GIFS, reg.id + '.webp');
    if (!fs.existsSync(webp)) {
      if (!fs.existsSync(fonte)) throw new Error('Imagem ausente: ' + fonte);
      await sharp(fonte, { animated: true }).resize(LADO, LADO, { fit: 'contain', background: '#ffffff' }).webp({ quality: 70, effort: 4 }).toFile(webp);
      convertidos++;
    }
    if (!ids.has(reg.id)) { cat.push({ ...reg, origemMidia: 'Hyrox' }); novos++; }
  }
  fs.writeFileSync(CATALOGO, JSON.stringify(cat, null, 1));
  console.log('estações novas:', novos, '| imagens convertidas:', convertidos, '| total:', cat.length);
})().catch((e) => { console.error(e); process.exit(1); });
