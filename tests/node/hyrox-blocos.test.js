// Treino Hyrox em blocos: texto do coach -> blocos -> mensagem compacta para o relógio.
const { carregarApp, ok } = require('../harness/carregar.js');
const C = require('../../src/relogio/garmin-contrato.js');

(async () => {
  const T = await carregarApp(['state', 'hyroxParseTexto', 'hyroxFmtBloco', 'abrirEditorHyrox', 'abrirTreinosHyrox']);
  const p = T.hyroxParseTexto;
  const b = p('SkiErg 5 min\nDescanso 1:30\nCorrida 1 km\nSled Push\n3x Wall Balls 45 s\nBurpee Broad Jump 80 m\n\n- Remo livre');
  const nomes = b.map(x => x.nome + '|' + x.tipo + '|' + x.valor);
  ok(nomes[0] === 'SkiErg|t|300', 'SkiErg 5 min = 300 s: ' + nomes[0]);
  ok(nomes[1] === 'Descanso|t|90', 'Descanso 1:30 = 90 s: ' + nomes[1]);
  ok(nomes[2] === 'Corrida|d|1000', 'Corrida 1 km = 1000 m: ' + nomes[2]);
  ok(nomes[3] === 'Sled Push|o|0', 'sem tempo = livre: ' + nomes[3]);
  ok(b.filter(x => x.nome === 'Wall Balls').length === 3 && b[4].valor === 45, '3x repete 3 blocos de 45 s');
  ok(nomes[7].startsWith('Burpee Broad Jump') && nomes[7].endsWith('|o|0'), 'estação com metros fica livre: ' + nomes[7]);
  ok(nomes[8] === 'Remo|o|0', 'bullet e "livre" limpos: ' + nomes[8]);
  ok(T.hyroxFmtBloco({ tipo: 'd', valor: 1500 }) === '1,5 km' && T.hyroxFmtBloco({ tipo: 't', valor: 300 }) === '5 min', 'formatação dos blocos');

  const t = { id: 'hx1', nome: 'Aula de terça', blocos: b };
  const item = C.hyroxCompacto(t);
  ok(item && item.y === 'h' && item.b.length === b.length && item.b[0][1] === 't' && item.b[2][1] === 'd' && item.b[3].length === 2, 'item compacto {y:h, b:[[nome,tipo,valor]]}');
  const paginas = C.mensagensTreinos([], [], undefined, 'abc', [item]);
  ok(paginas.length === 1 && paginas[0].hv === 1 && paginas[0].w[0].y === 'h', 'mensagem leva hv:1 e o treino Hyrox');
  ok(JSON.stringify(paginas[0]).length < 3000, 'página cabe em 3000 bytes (' + JSON.stringify(paginas[0]).length + ')');
  const vazia = C.mensagensTreinos([], [], undefined, 'abc', []);
  ok(vazia[0].hv === 1 && vazia[0].w.length === 0, 'lista vazia limpa os treinos Hyrox do relógio');
  const antiga = C.mensagensTreinos([], [], undefined, 'abc');
  ok(antiga[0].hv === undefined, 'sem hyrox o formato é o de sempre');
  ok(C.hyroxCompacto({ id: 'x', nome: 'n', blocos: [] }) === null, 'sem blocos = inválido');
})().catch(e => { console.log('FALHOU', e); process.exit(1); });
