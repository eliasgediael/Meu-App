// Treino Hyrox em blocos: texto do coach -> blocos -> mensagem compacta para o relógio.
const { carregarApp, ok } = require('../harness/carregar.js');
const C = require('../../src/relogio/garmin-contrato.js');

(async () => {
  const T = await carregarApp(['state', 'hyroxParseTexto', 'hyroxFmtBloco', 'abrirEditorHyrox', 'abrirTreinosHyrox', 'hyroxParseValor', 'hyroxImg', 'HYROX_ESTACOES', 'renderTreinoV2Content', 'renderTreinoV2Hyrox', 'aplicarPlanoHyrox', 'diaTemHyrox']);
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
  const pv = T.hyroxParseValor;
  ok(JSON.stringify(pv('5 min', false)) === '{"tipo":"t","valor":300,"det":""}', 'valor 5 min = 300 s');
  ok(JSON.stringify(pv('', false)) === '{"tipo":"o","valor":0,"det":""}' && pv('livre', false).tipo === 'o', 'vazio ou "livre" = livre');
  ok(pv('1 km', true).tipo === 'd' && pv('1 km', true).valor === 1000, 'corrida com km conta distância');
  ok(pv('50 m', false).tipo === 'o' && pv('50 m', false).det === '50 m', 'estação com metros fica livre e guarda o detalhe');
  ok(pv('100 reps', false).tipo === 'o' && pv('100 reps', false).det === '100 reps', '100 reps vira detalhe');
  ok(T.hyroxImg('Sled Pull') === 'gifs/9003.webp' && T.hyroxImg('Wall Balls') === 'gifs/9008.webp' && T.hyroxImg('Remo') === 'gifs/9005.webp' && T.hyroxImg('Descanso') === null, 'imagem de cada estação');
  const fs = require('fs');
  ok(T.HYROX_ESTACOES.every(e => fs.existsSync(__dirname + '/../../gifs/' + e.id + '.webp')), 'as 8 estações têm imagem no pacote');
  const det = C.hyroxCompacto({ id: 'h', nome: 'n', blocos: [{ nome: 'Wall Balls', tipo: 'o', valor: 0, det: '100 reps' }] });
  ok(det.b[0][0] === 'Wall Balls 100 reps', 'detalhe vai no nome do bloco livre: ' + det.b[0][0]);
  // Aba Hyrox no dia, ao lado de Musculação e Corrida
  const S = T.state; S.weekOffset = 0;
  T.aplicarPlanoHyrox();
  S.hyroxTreinos = [{ id: 'hxA', nome: 'Aula de terça', dias: ['Ter', 'Sex'], blocos: [{ nome: 'SkiErg', tipo: 't', valor: 300, det: '' }, { nome: 'Sled Pull', tipo: 'o', valor: 0, det: '' }] }];
  ok(T.diaTemHyrox('Ter') && T.diaTemHyrox('Sex') && T.diaTemHyrox('Dom') && !T.diaTemHyrox('Sáb'), 'dia tem Hyrox: WOD ou aula de Hyrox planejada');
  S.treinosSubTab = 'hyrox'; S.selectedDayMusc = 'Ter';
  const ter = T.renderTreinoV2Content();
  ok(/data-hxwod-edit="hxA"/.test(ter) && ter.includes('gifs/9001.webp') && ter.includes('gifs/9003.webp'), 'terça mostra o WOD com a imagem de cada estação');
  ok(!/data-mrtsub/.test(ter), 'terça só tem Hyrox: sem seletor');
  S.selectedDayMusc = 'Sex';
  const sex = T.renderTreinoV2Content();
  ok(/data-mrtsub="musculacao"/.test(sex) && /data-mrtsub="corrida"/.test(sex) && /data-mrtsub="hyrox"/.test(sex), 'sexta tem as 3 abas lado a lado: Musculação, Corrida e Hyrox');
  ok(/data-hxwod-edit="hxA"/.test(sex), 'aba Hyrox ativa mostra o WOD na sexta');
  S.treinosSubTab = 'corrida';
  ok(!/data-hxwod-edit/.test(T.renderTreinoV2Content()), 'aba Corrida não mostra o WOD');
  S.selectedDayMusc = 'Qui';
  ok(/Montar WOD do dia/.test(T.renderTreinoV2Content()), 'quinta (aula sem WOD) oferece montar o WOD');
})().catch(e => { console.log('FALHOU', e); process.exit(1); });
