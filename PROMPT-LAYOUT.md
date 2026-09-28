# Meu Ritmo — novo layout tela por tela (estilo de referência + o que já é meu)

## Leia primeiro: por que as tentativas anteriores falharam

Duas vezes o resultado foi o MESMO layout só com outra cor. Isso é proibido.

Desta vez, em cada tela:
- APAGUE o layout antigo daquela tela e monte do zero seguindo o esqueleto abaixo, de cima para baixo, na ordem escrita.
- Mantenha SÓ as funções de dados, armazenamento e lógica. Todos os meus dados, desenhos e regras continuam.

## Formato do projeto

NÃO migrar para React, Vite ou Expo. Manter o formato atual do projeto.
- Onde este documento fala em "componente", use o equivalente do projeto atual (HTML/CSS/JS).
- Ícones: lucide (versão web).
- Fonte: Plus Jakarta Sans via Google Fonts.

## O que NÃO muda

- Dados, histórico, cálculos, motor de geração de plano (Viada/VDOT), GPS, voz, esteira, check-in, progressão.
- Meus desenhos/imagens dos exercícios.
- A minha forma de registrar séries continua igual (só muda o layout).
- A geração do plano passa a seguir o fluxo da seção "COMO O PLANO É GERADO". O motor de cálculo continua o meu (Viada/VDOT); só muda a entrada e a apresentação.
- Criar treino manual, editar treino e modelos salvos continuam existindo, mas SAEM DA TELA PRINCIPAL e ficam no menu ⋯ (ver seção Treino).
- Minhas seções do Perfil: Progresso, Comparativo, Medidas corporais (com cálculo de % de gordura), Equipamentos, Personal Trainer.

## Estilo visual (tema escuro azulado)

### Cores
- Fundo: #070B14
- Card: #0F1626
- Card interno/elevado: #16203A
- Borda sutil (só quando precisar): #1E2A44
- Texto: #F3F6FB
- Texto secundário: #8B97AD
- Azul principal (botões, seleção, progresso, aba ativa): #3B82F6
- Azul claro (texto sobre azul escuro, ícones ativos): #60A5FA
- Sucesso (selo "certo", concluído): #22C55E
- Atenção: #F59E0B
- Perigo (desconectar, erro): #EF4444

### Botões
- Principal: azul cheio, cantos 14, altura 52, com brilho suave azul embaixo (sombra azul difusa).
- Secundário: fundo do card interno, texto branco.
- Perigo: vermelho cheio.

### Rótulos
- Rótulos pequenos em CAIXA ALTA com espaçamento (ex.: "CORRIDA · T1", "AQUECIMENTO", "TIRO 1 DE 4"), cor secundária.

### Fonte e números
- Plus Jakarta Sans (800 números/títulos, 700 destaques, 500 texto).
- Números grandes e grossos, com largura fixa (tabular).

### Cards e chips
- Cards com raio 20, SEM borda (separação pelo tom), padding 16–20, espaço de 12 entre cards.
- Chips em pílula (raio total), fundo azul transparente (#3B82F6 a 15%) com texto azul claro.

### Navegação
- Barra inferior fixa, fundo do card.
- Ícone + rótulo: Início · Turma · Treino · Perfil. Ativa em azul.
- Espaço preparado (escondido) para "Dieta" entre Treino e Perfil.
- Some nas telas de execução.

### Nomes e marca
Os nomes, o logo e os textos são do Meu Ritmo. Não usar nomes, logo nem textos de outro app.

## COMO O PLANO É GERADO (fluxo novo)

O usuário não monta treino. O app gera e ajusta sozinho.

1. Quiz (uma pergunta por tela, barra de progresso no topo, opções grandes):
   - experiência em musculação;
   - experiência em corrida e tempo de prova recente (ou "não sei");
   - dias disponíveis por semana;
   - objetivo;
   - tem relógio GPS?;
   - corre na rua, na esteira ou nos dois;
   - (opcional) prova-alvo: distância 5k/10k/21k + data.

2. Tela de resultado:
   - dois cards lado a lado: Musculação (nível + score) e Corrida (nível + score);
   - card grande abaixo: Nível híbrido (nível + score);
   - bloco "Frequência de musculação": opções em cards (ex.: 3x "ideal para conciliar com corrida" / 5x "mais volume"), com a recomendada já marcada;
   - botão continuar só libera depois da escolha.

3. O app gera o ciclo completo com o meu motor:
   - 8 semanas, com corrida e musculação separadas por dia seguindo as regras de interferência;
   - fases do ciclo e progressão T1…Tn;
   - se tiver prova-alvo, periodiza até a data.

4. Tela "Sua semana está pronta": prévia dos 7 dias + botão "Começar".

5. Toda semana o check-in ajusta a semana seguinte sozinho (lógica existente).

6. Refazer o plano: pelo menu ⋯ do Treino ou em Perfil › "Meu plano", que roda o quiz de novo.

Quem já tem dados salvos NÃO passa pelo quiz obrigatoriamente: o plano atual continua e aparece um card no Início "Refaça seu diagnóstico" (opcional).

## Esqueleto das telas

Monte exatamente nesta ordem. ★ = o que é meu ou novo, somado à referência.

### 1. TREINO (fazer primeiro)

1. Cabeçalho
   - Título "Treino" + subtítulo "Sua semana de treinos".
   - À direita, SÓ um botão redondo ⋯ que abre um menu com:
     Editar treino do dia · Criar treino manual · Modelos salvos · Refazer meu plano.
   - Nada de varinha, lápis ou + na tela.
2. Linha de 2 cards contadores
   - "Musculação 1/3" e "Corrida 0/3".
   - Cada um com ícone, número grande e mini barra azul.
3. Semana
   - 7 colunas estreitas SEM CAIXA: letra do dia em cima, círculo embaixo.
   - O círculo fica preenchido azul se tem treino, vazio se descanso, com check se concluído.
   - Dia selecionado com círculo azul maior + data.
   - ★ Número de exercícios dentro do círculo quando tiver.
4. Nome do dia selecionado ("Quarta-feira") à esquerda.
5. Seletor de 2 opções: Musculação | Corrida. Fundo do card, opção ativa em azul.
6. Navegação de semana
   - "‹ Anterior" · "Semana 1 de 8" · "Próxima ›".
   - Abaixo, o nome da fase ("Semana da corrida").
7. Chips de progressão: T1 T2 T3 T4 T5, o atual em azul.
8. Conteúdo do dia: Musculação
   - Card resumo: título "Treino de quarta" + 3 métricas em linha (Duração · Exercícios · Volume) + botão principal "Iniciar treino".
   - Abaixo, lista simples dos exercícios JÁ ORDENADOS por prioridade (compostos primeiro), SEM títulos de grupo.
   - Cada exercício é um card com: MEU DESENHO à esquerda, nome, chip do músculo, séries × reps.
   - Editar um exercício: toque longo no card (abre painel inferior), não um lápis visível.
9. Conteúdo do dia: Corrida
   - Chip "Semana 1 · Base" + 1 linha de descrição.
   - ★ Selo "Garmin" se estiver sincronizado.
   - Card da corrida:
     - rótulo "CORRIDA · T1" + título grande ("Base com Z3");
     - à direita, botão redondo "Concluir";
     - 3 métricas em linha: Duração · Ritmo · Distância;
     - botão principal "Iniciar corrida" e, abaixo, 2 secundários lado a lado: "Esteira" · "Enviar ao Garmin".
   - Linha "Foco: …".
   - "Estrutura do treino": lista de blocos, cada um com chip do tipo (Aquecimento/Tiro/Recuperação/Desaquecimento), distância ou tempo e pace. Grupo de repetição com rótulo "Repetir 4x" e os blocos dentro.
   - ★ Mini gráfico de barras dos blocos acima da lista.
10. Dia sem treino: card de descanso com ícone, frase curta e o próximo treino da semana. Sem botões de criar.

### 2. INÍCIO

1. Saudação + data, e avatar pequeno à direita.
2. Card grande do treino de hoje: rótulo, título, 3 métricas e botão principal (Iniciar). Se houver 2 no dia, o segundo aparece compacto abaixo. Em dia de descanso, o card mostra "Descanso" + próximo treino.
3. Linha com 2 cards contadores da semana (igual ao Treino).
4. Card do desafio da Turma: posição, check-ins e dias restantes.
5. Card de check-in semanal, só se pendente, com botão azul.
6. ★ Card "Último treino": planejado × feito resumido.
7. Card "Refaça seu diagnóstico" (só para quem ainda não fez o quiz novo, some depois de feito).

### 3. EXECUÇÃO DE MUSCULAÇÃO (mantém a minha forma de registro)

1. Topo: ✕, nome do treino, "Semana X · força", botão Concluir.
2. Linha de 3 métricas: Tempo · Volume (kg) · Séries x/total.
3. Card do exercício atual: MEU DESENHO grande, nome, chip do músculo, botão "Ver execução".
4. Tabela de séries, com os mesmos campos que eu uso hoje: Série · Carga · Reps · PSE · ✓.
   - Linha concluída fica com fundo verde transparente.
   - ★ Chip "↑ subir carga" quando a progressão indicar.
5. Botão "+ Adicionar série".
6. Descanso: painel inferior com número gigante, "+15s" e "Pular".
7. Lista dos próximos exercícios em cards pequenos embaixo.

### 4. ESTEIRA

1. Topo: ✕, título do treino, ícone de voz.
2. Card do bloco:
   - chip do tipo (ex.: "AQUECIMENTO" ou "TIRO 1 DE 4");
   - número gigante "1,08 km" + "restantes";
   - barra de progresso azul;
   - linha "Próximo: Tiro 1 · 1,0 km" + botão "Pular".
3. Grade 2×2: Tempo · Distância · Pace atual · Calorias.
4. Card Velocidade: botão − grande, "9,4 km/h" enorme no centro, botão + grande. Selo "Certo" (verde) quando bate com o alvo.
5. Card Inclinação: − 0,0% +.
6. Rodapé: "Pausar" (azul) e "Finalizar" (secundário).
7. No início de cada tiro, modal centralizado: "TIRO 1 DE 4", "Coloque a esteira em 10,6 km/h", barra de contagem, "Ajusta sozinho em 15s", botão "Confirmar".

### 5. GPS (rua)

1. Topo: ✕, título, ícone de voz, chip de sinal ("GPS forte").
2. Card do bloco, igual ao da esteira: chip "TIRO 1 DE 2", número gigante "2,00 km restantes", barra, "Próximo: Recuperação · 500 m".
3. Grade 2×2: Tempo · Distância · Pace atual · Pace médio.
4. Mapa em card com cantos arredondados.
5. Rodapé: Pausar / Finalizar.
6. Voz com a música abaixando e pace suavizado: usar a lógica existente.
7. ★ Tocar no número gigante alterna distância, tempo e pace.

### 6. PÓS-CORRIDA

1. Cabeçalho da atividade: nome, data, linha de chips (km · min · pace · bpm).
2. Botão secundário "Compartilhar corrida".
3. Card "Planejado vs Realizado":
   - selo geral ("Bom");
   - linhas Distância / Duração / Ritmo médio, cada uma com Planejado, Realizado e selo "Certo" (verde) ou "Acima"/"Abaixo" (âmbar).
4. Linha de elevação e calorias.
5. Card "Avaliação do treino" com seções de ícone + título: Diagnóstico · Métricas · Ritmo por bloco · Recuperação. Gerado pelas regras do app.
6. ★ Gráfico de pace por bloco contra o alvo.
7. ★ "O que muda no próximo treino".

### 7. TURMA

1. Título + nome do desafio + "faltam X dias".
2. 3 cards em linha: Líder (foto + check-ins) · Você (foto + check-ins) · Restam (dias).
3. ★ Anel da meta coletiva do grupo.
4. "Top 3": lista com foto, nome e check-ins.
5. "Check-ins recentes": cards com foto, nome e horário.
6. Botão flutuante azul "+" (fazer check-in).
7. Sem login/backend ainda: dados de exemplo com aviso discreto.

### 8. PERFIL

1. Cabeçalho: foto grande, nome, chips de nível (Musculação · Corrida), botão "Editar dados".
   - O formulário de nome, idade, peso, altura e sexo SAI DO TOPO e vira subtela "Dados pessoais".
2. Grade de cards 2 colunas, cada um com ícone, título e 1 linha de resumo: ★ Progresso · ★ Comparativo · ★ Medidas corporais · ★ Equipamentos.
3. Card "Meu plano": nível híbrido atual, semana do ciclo, prova-alvo (se tiver) e botão "Refazer diagnóstico".
4. Card "Personal Trainer" (a minha seção atual) em largura total.
5. "Integrações":
   - card por serviço (Garmin, Strava) com logo, chip "Conectado", última sincronização e os botões "Sincronizar" (secundário) e "Desconectar" (vermelho);
   - bloco "Saúde do relógio": grade 2×2 (sono, estresse, FC repouso, HRV) + gráfico de sono. Se o dado não existir, deixar pronto com estado vazio.
6. Lista final simples: Preferências (voz, unidades, som) · Conta (sair, apagar).

## Regras

- UMA tela por vez. Ordem: Treino → Início → Musculação → Esteira → GPS → Pós-corrida → Perfil → Quiz/Resultado → Turma.
- Ao terminar cada tela, me mande:
  - print novo;
  - checklist do esqueleto marcado item por item (✓/✗);
  - confirmação de que os dados antigos aparecem.
- PARE e espere minha aprovação antes da próxima tela.
- Não explique demais (resumo de no máximo 10 linhas).
- Não leia o projeto inteiro.
- Não mexa em lógica.
