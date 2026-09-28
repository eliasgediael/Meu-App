# Meu Ritmo — NOVA CARA (só estética)

## REGRA PRINCIPAL: NÃO MEXER NO MOTOR

**Fica exatamente como está:**
- Motor V2;
- catálogo de 349 exercícios;
- regras de treino, progressão e geração de plano;
- Questionário V2 (a lógica);
- cálculos, GPS, voz, esteira, check-in;
- armazenamento e dados salvos.

**Este trabalho é SÓ visual:** cores, fontes, ícones, cards, botões, espaçamento, organização das telas e navegação.

**Regras:**
- As telas leem os mesmos dados e chamam as mesmas funções de hoje.
- Se uma tela abaixo pedir um dado que o motor não fornece, **não crie lógica nova**. Use o equivalente que já existe (ex.: PSE no lugar de RIR) ou deixe o elemento de fora e liste no fim da etapa.
- Não migrar framework. Manter o formato atual do projeto.
- Ícones lucide (web). Fonte Plus Jakarta Sans via Google Fonts.

## POR QUE AS TENTATIVAS ANTERIORES FALHARAM

Duas vezes o resultado foi o mesmo layout só com outra cor. **Isso é proibido.** Em cada tela:
1. apague o layout antigo daquela tela;
2. monte do zero seguindo o esqueleto abaixo, de cima para baixo;
3. mantenha só a ligação com os dados e funções.

Não pode sobrar nada do visual atual:
- grafite com coral;
- caixinhas quadradas dos dias;
- pílula "Tudo/Musculação/Corrida" com fundo colorido;
- formulário no topo do Perfil;
- lista com setinha › para tudo;
- barrinha "0 de 2 treinos · 0%".

---

## 1. PALETA E ESTILO

### Cores

| Uso | Cor |
|---|---|
| Fundo | #0E1113 |
| Card | #171B1E |
| Card interno/elevado | #1F2427 |
| Borda sutil (só quando precisar) | #2A3034 |
| Texto | #F2F5F5 |
| Texto secundário | #8E999C |
| Turquesa principal (botões, seleção, aba ativa, progresso, músculos acesos) | #2DD4BF |
| Turquesa claro (texto sobre turquesa escuro, gráficos) | #99F6E4 |
| Musculação | #2DD4BF |
| Corrida | #60A5FA |
| Sucesso | #34D399 |
| Atenção | #FBBF24 |
| Perigo | #F87171 |

A modalidade aparece em ponto, ícone, barra e chip. Nunca em fundo inteiro.

### Botões
- **Principal:** turquesa cheio, texto #0E1113, cantos 14, altura 52, brilho turquesa suave embaixo.
- **Secundário:** card interno com texto branco.
- **Perigo:** vermelho cheio.

### Cards, chips e rótulos
- Cards com raio 20, **sem borda**, padding 16–20, espaço de 12 entre eles.
- Chips em pílula, com fundo #2DD4BF a 15% e texto #99F6E4.
- Rótulos pequenos em CAIXA ALTA com espaçamento (ex.: "CORRIDA · T1", "TIRO 1 DE 4"), na cor secundária.

### Números
- Plus Jakarta Sans 800, grandes, com largura fixa (tabular).

### Navegação
- Barra inferior fixa, com ícone + rótulo: **Início · Turma · Treino · Perfil**.
- Aba ativa em turquesa.
- Some nas telas de execução.

### Marca
- Nomes, logo e textos são do Meu Ritmo.

---

## 2. TELAS (uma por vez, nesta ordem)

### 2.1 TREINO

1. **Cabeçalho**
   - Título "Treino" + subtítulo "Sua semana de treinos".
   - À direita, só um botão redondo ⋯ com um menu das ações que já existem hoje: gerar, criar manual, editar, modelos salvos.
   - Nada de varinha, lápis ou + soltos na tela.
2. **Linha de 2 cards contadores:** "Musculação x/y" e "Corrida x/y", com ícone, número grande e mini barra.
3. **Semana**
   - 7 colunas SEM CAIXA: letra do dia em cima, círculo embaixo.
   - O círculo fica preenchido se tem treino, vazio se descanso, com ✓ se concluído.
   - Dia selecionado com círculo turquesa maior + data.
4. **Nome do dia selecionado** à esquerda.
5. **Seletor de 2 opções:** Musculação | Corrida, com a ativa em turquesa.
6. **Navegação de semana:** "‹ Anterior · Semana X de Y · Próxima ›" + nome da fase (se o motor já tiver).
7. **Card de musculação**
   - Rótulo "MUSCULAÇÃO · SEMANA X" + nome do treino.
   - À esquerda, **mapa do corpo frente e costas** (SVG simples) com os músculos do treino acesos em turquesa. Usar o músculo que o catálogo já informa em cada exercício.
   - À direita, 3 linhas com ícone: duração · séries · volume.
   - Botão **Iniciar treino**.
   - Abaixo, a lista dos exercícios em cards: MEU DESENHO à esquerda, nome, chip do músculo, séries × reps.
   - Editar um exercício: toque longo, com a mesma função de editar que já existe.
8. **Card de corrida**
   - Rótulo "CORRIDA · …" + título grande.
   - 3 métricas em linha: Duração · Ritmo · Distância.
   - Botão principal **Iniciar corrida** e, abaixo, secundários **Esteira** e **Enviar ao Garmin** (só se a função já existir).
   - Linha "Foco: …".
   - "Estrutura do treino": blocos com chip do tipo, distância ou tempo e pace. Grupo "Repetir Nx" com os blocos dentro.
9. **Dia sem treino:** card de descanso com ícone, frase curta e o próximo treino.
10. **Modelos salvos:** só dentro do menu ⋯.

### 2.2 INÍCIO

1. Saudação + data, com avatar pequeno à direita.
2. **Card grande do treino de hoje:** rótulo, título, 3 métricas e botão Iniciar. O segundo treino do dia aparece compacto. Em dia de descanso: "Descanso" + próximo treino.
3. Linha com os 2 cards contadores da semana.
4. Card de check-in semanal, só se pendente.
5. Card do desafio da Turma (dados de exemplo enquanto não houver login).

### 2.3 EXECUÇÃO DE MUSCULAÇÃO

Mesma forma de registro de hoje; muda só o visual.

1. **Topo:** ✕ · cronômetro · **Finalizar**.
2. **Carrossel horizontal** com as miniaturas (MEUS DESENHOS) dos exercícios do treino. O atual tem borda turquesa e os feitos têm ✓. Tocar pula para o exercício.
3. **Card do exercício:** meu desenho, nome, equipamento e timer de descanso.
4. **Tabela de séries** com os MESMOS campos que eu uso hoje (ex.: # · Reps · Carga · PSE · ✓).
   - Vem preenchida como hoje.
   - Série concluída com ✓ turquesa e linha levemente preenchida.
5. **Painel inferior de PSE**, ao tocar na coluna: título com pergunta, uma frase explicando a opção escolhida, botões em grade e OK. Os valores são os que o app já usa.
6. **"Detalhes do exercício"** recolhível: técnica e desenho grande.
7. **Descanso:** o timer que já existe, mostrado em painel inferior com número grande, +15s e Pular.

### 2.4 RESUMO PÓS-TREINO

1. **Topo:** logo do Meu Ritmo, data, nome do treino.
2. **Frase de destaque:** "Treino concluído". Se o app já detectar recorde, mostrar "Novo recorde pessoal!".
3. **Cards 2×2:** nº do treino · tempo · séries feitas/total · volume. Só os que já existem nos dados.
4. **Corrida:** tabela Planejado × Feito com selo por linha, se esses dados já existirem.
5. Botão **Concluir**.

### 2.5 GPS E ESTEIRA

Visual novo sobre a lógica que já existe.

**Card do bloco**
- Chip do tipo ("TIRO 1 DE 4").
- **Número gigante** (restante do bloco) e barra de progresso.
- "Próximo: …".

**Grade 2×2**
- GPS: tempo · distância · pace atual · pace médio.
- Esteira: tempo · distância · pace · calorias.

**Controles específicos**
- GPS: mapa em card arredondado e chip de sinal.
- Esteira: card **Velocidade** com − e + grandes e número enorme no centro; card **Inclinação** com − e +.

**Rodapé:** Pausar (turquesa) / Finalizar.

**Aviso de nova velocidade na esteira:** se já existir, vira painel centralizado com contagem e botão Confirmar.

### 2.6 PERFIL

1. **Cabeçalho:** foto grande, nome, botão "Editar dados".
   - O formulário de nome, idade, peso, altura e sexo **sai do topo** e vira a subtela "Dados pessoais". Os campos e o salvamento são os mesmos.
2. **Grade de cards 2 colunas**, com ícone, título e 1 linha: Progresso · Comparativo · Medidas corporais · Equipamentos.
3. Card **Personal Trainer** em largura total.
4. **Integrações:** só as que já existem, em card com status.
5. **Lista final:** Preferências · Conta.

### 2.7 PROGRESSO

Visual novo para as telas de Progresso e Comparativo que já existem.

- Lista de exercícios com mini-gráfico em turquesa.
- Detalhe com gráfico de linha, filtro de período e os números que o app já calcula.

### 2.8 QUESTIONÁRIO V2 (só o visual)

- Uma pergunta por tela, barra de progresso no topo, opções em cards grandes.
- A opção selecionada ganha borda e ícone turquesa.
- Mesmas perguntas e mesma lógica do Questionário V2.

### 2.9 TURMA

Tela nova, só visual, com dados de exemplo e aviso discreto enquanto não houver login.

- Nome do desafio + "faltam X dias".
- 3 cards: Líder · Você · Restam.
- Top 3.
- Feed de check-ins.
- Botão flutuante +.

---

## 3. ORDEM E ENTREGA

1. **Paleta e estilo no app inteiro.** Print de 2 telas.
2. Treino.
3. Início.
4. Execução de musculação.
5. Pós-treino.
6. GPS e esteira.
7. Perfil.
8. Progresso.
9. Questionário V2.
10. Turma.

**Ao fim de cada etapa, me mande:**
- print da tela nova;
- checklist do esqueleto (✓/✗);
- lista do que ficou de fora por falta de dado no motor;
- confirmação de que o motor não foi alterado e de que os dados antigos aparecem.

**Pare e espere minha aprovação antes da próxima.** Resumo de no máximo 10 linhas.
