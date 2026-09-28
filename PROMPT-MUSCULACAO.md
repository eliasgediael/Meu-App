# Meu Ritmo — Nova paleta + musculação completa

Este documento **complementa** o `PROMPT-LAYOUT.md`.
- Onde os dois conflitarem, **vale este**: cores e tudo de musculação.
- O resto do PROMPT-LAYOUT continua valendo: estrutura das abas, corrida, GPS, esteira, Turma e Perfil.

**Regras gerais (as mesmas de sempre):**
- Não migrar framework.
- Não apagar dados.
- Uma etapa por vez, esperando minha aprovação.
- Checklist ✓/✗ ao fim de cada etapa.

---

## PARTE A — NOVA PALETA (substitui as cores do PROMPT-LAYOUT no app inteiro)

Tema escuro com destaque turquesa. **Não usar azul como cor principal.**

### Cores

| Uso | Cor |
|---|---|
| Fundo | #0E1113 |
| Card | #171B1E |
| Card interno/elevado | #1F2427 |
| Borda sutil | #2A3034 |
| Texto | #F2F5F5 |
| Texto secundário | #8E999C |
| **Turquesa principal** (botões, seleção, aba ativa, progresso, músculos acesos no mapa) | #2DD4BF |
| Turquesa claro (texto/ícone sobre turquesa escuro, gráficos) | #99F6E4 |
| Musculação | #2DD4BF |
| Corrida | #60A5FA |
| Sucesso | #34D399 |
| Atenção | #FBBF24 |
| Perigo | #F87171 |

A modalidade aparece em ponto, ícone, barra e chip. Nunca em fundo inteiro.

### Estilo

**Botões**
- Principal: turquesa cheio, texto #0E1113, cantos 14, altura 52, brilho turquesa suave embaixo.
- Secundário: card interno com texto branco.

**Cards e chips**
- Cards raio 20, sem borda.
- Chips pílula com fundo #2DD4BF a 15% e texto #99F6E4.

**Rótulos**
- Rótulos pequenos em caixa alta, cor secundária.

**Fonte**
- Plus Jakarta Sans (a mesma do PROMPT-LAYOUT).

---

## PARTE B — LÓGICA DA MUSCULAÇÃO (motor)

Implementar como **módulo separado de força** (ex.: `strengthEngine`), com funções puras e testes.

- A integração com a corrida continua pelas regras de interferência que já existem (Viada).
- O módulo decide o que acontece **dentro** dos dias de musculação.
- Os números abaixo são o ponto de partida. Deixe todos em um arquivo de configuração para eu ajustar.

### B1. Entradas (vêm do quiz)

- **Local e equipamento:** academia grande · academia pequena · academia em casa · só halteres · só peso do corpo. Pode ser refinado na minha seção Equipamentos.
- **Nível:** iniciante · intermediário · avançado.
- **Dias de musculação por semana** e **duração** por sessão (30/45/60/75 min).
- **Objetivo:** hipertrofia · força · definição.
- **Prioridades musculares:** até 2 grupos, escolhidos tocando no mapa do corpo.
- **Limitações/dor:** chips de região (ombro, joelho, lombar…).

### B2. Divisão da semana

| Dias de musculação | Divisão |
|---|---|
| 2 | Corpo inteiro A / B |
| 3 | Corpo inteiro A / B / C, ou Superior / Inferior / Corpo inteiro |
| 4 | Superior / Inferior ×2 |
| 5 | Superior / Inferior / Empurrar / Puxar / Pernas |
| 6 | Empurrar / Puxar / Pernas ×2 |

- Dia de perna pesada respeita as regras de interferência com a corrida que já existem.

### B3. Seleção de exercícios

- **Base:** a minha biblioteca, com os MEUS DESENHOS.
- **Cada exercício precisa ter:**
  - músculo principal e secundários;
  - padrão de movimento (empurrar horizontal/vertical, puxar horizontal/vertical, agachar, dobradiça de quadril, isolador);
  - equipamento necessário;
  - nível mínimo;
  - regiões que sobrecarrega.
- **Filtros:**
  - só entram exercícios possíveis com o equipamento escolhido;
  - saem os que sobrecarregam regiões marcadas com dor.
- **Ordem na sessão:**
  1. compostos;
  2. músculos prioritários;
  3. isoladores.
- **Troca de exercício:** mostrar alternativas com o mesmo músculo principal e o mesmo padrão, que caibam no equipamento.

### B4. Volume semanal por músculo

**Séries por semana, ponto de partida:**

| Nível | Séries por músculo/semana |
|---|---|
| Iniciante | 8–10 |
| Intermediário | 10–14 |
| Avançado | 12–18 |

- **Prioridade muscular:** +25% de séries, e o músculo vem mais cedo na sessão.
- **Limite:** respeitar a duração da sessão. Se não couber, cortar primeiro os isoladores não prioritários.

**Ajuste pelo check-in semanal** (recuperação por grupo muscular, escala 1–5):

| Nota | Ajuste na semana seguinte |
|---|---|
| 1–2 | −2 séries daquele músculo |
| 3 | mantém |
| 4–5 com desempenho subindo | +1 série, até o teto do nível |

### B5. Progressão (por série, com RIR)

**Faixas de reps por objetivo:**

| Objetivo | Compostos | Isoladores |
|---|---|---|
| Força | 4–6 | 8–12 |
| Hipertrofia | 6–10 | 10–15 |
| Definição | igual à hipertrofia | igual à hipertrofia |

**RIR alvo por semana do mesociclo de 4 semanas:**

| Semana | RIR alvo | Observação |
|---|---|---|
| 1 | 3 | |
| 2 | 2 | |
| 3 | 1 | |
| 4 | 3 | descarga, com −40% de séries |

**Regra de carga, na sessão seguinte do mesmo exercício:**
- **Sobe:** todas as séries atingiram o topo da faixa com RIR ≤ alvo → sobe a carga pelo menor incremento disponível (barra 2,5 kg; halter 1–2 kg; máquina 1 placa) e volta ao fundo da faixa.
- **Mantém a carga:** reps dentro da faixa → mantém a carga e busca +1 rep.
- **Reduz:** reps abaixo do mínimo, ou RIR bem abaixo do alvo (falha) → reduz cerca de 5%.

**Primeira vez no exercício:** pedir "use uma carga que você faria com 2 reps sobrando". A primeira série calibra as seguintes.

**Regras fixas:**
- **Nunca** mudar carga ou reps de uma série em andamento. O ajuste vale só para a próxima série ou a próxima sessão.
- **Integração:** RIR vira PSE internamente (PSE = 10 − RIR), para integrar com o que já existe.

### B6. Recordes e 1RM estimado

- **1RM estimado por série** (Epley, usando as reps possíveis): `e1RM = carga × (1 + (reps + RIR) / 30)`.
- **Recordes por exercício:**
  - maior e1RM;
  - maior carga;
  - maior volume numa sessão.
- **Novo recorde:** marcar no resumo pós-treino.

### B7. Descarga automática

- Toda 4ª semana do mesociclo.
- Antecipar se o check-in der média ≤ 2 em duas semanas seguidas.

---

## PARTE C — TELAS DA MUSCULAÇÃO

### C1. Quiz (acréscimos)

**"Onde você treina?"**
- Cards grandes com ícone: Academia grande · Academia pequena · Academia em casa · Só halteres · Só peso do corpo.
- Barra de progresso no topo.

**"Quer dar prioridade a algum músculo?"**
- Mapa do corpo (frente e costas) tocável; até 2 grupos acendem em turquesa.
- Botão "Sem prioridade".

**"Tem alguma dor ou limitação?"**
- Chips de região + "Nenhuma".

### C2. "Montando seu plano"

- Anel turquesa girando até 100% + frase curta.
- Depois, resumo em cards 2×2:
  - Objetivo;
  - Divisão;
  - Treinos por semana;
  - Duração média.
- Abaixo, o **mapa do corpo com os músculos em foco** acesos.
- Botão **Começar**.

### C3. Card de musculação (aba Treino e Início)

**Topo do card**
- Rótulo pequeno ("MUSCULAÇÃO · SEMANA 3").
- Nome do treino ("Superior A").
- Selo de concluído no canto quando feito.

**Corpo do card**
- À esquerda, **mapa do corpo frente + costas** com os músculos do treino acesos.
- À direita, 3 linhas com ícone: **duração · séries · volume** (kg).
- Botão **Iniciar treino**.

### C4. Execução

1. **Topo:** ✕ · cronômetro do treino · **Finalizar**.
2. **Carrossel horizontal de miniaturas** (MEUS DESENHOS) de todos os exercícios. O atual tem borda turquesa, os concluídos um ✓. Tocar pula para o exercício.
3. **Card do exercício:** meu desenho, nome, equipamento, 📌 e timer de descanso (ex.: 02:00, editável).
4. **Tabela:**
   - Colunas: **# · Reps · Carga (kg) · RIR · ✓**.
   - Vem preenchida com o prescrito; o campo em edição fica destacado.
   - Série concluída com ✓ turquesa e linha levemente preenchida.
   - Chip "↑ subir carga" quando a regra B5 indicar, com o porquê num toque.
5. **Controles de série:** botões **− Séries +**.
6. **"Detalhes do exercício"** recolhível: técnica, músculos e o meu desenho grande.
7. **Painel de RIR:**
   - Abre ao tocar na coluna RIR.
   - Título "Quantas reps você ainda conseguiria?" e frase dinâmica ("eu faria mais 2 reps limpas").
   - Botões em grade: **4+ · 3 · 2 · 1 · 0** e **OK**.
8. **Descanso:**
   - Ao marcar ✓, inicia a contagem com o número grande no painel inferior, +15s e Pular.
   - Vibração quando acabar.
9. **Troca de exercício:** toque longo no exercício abre as alternativas da regra B3.

### C5. Resumo pós-treino

1. Logo do Meu Ritmo, data, nome do treino, "Semana X".
2. Frase de destaque: **"Novo recorde pessoal!"** (se houver) ou "Treino concluído".
3. **Cards 2×2:** nº do treino ("12º treino") · tempo · séries feitas/total · volume total.
4. **"Conquistas":** lista dos recordes do dia, com o exercício e o valor.
5. **"O que muda no próximo":** 1–2 linhas vindas da regra B5.
6. Botão **Concluir**.

### C6. Progresso por exercício (Perfil › Progresso)

- **Lista de exercícios** com mini-gráfico. Tocar abre o detalhe.
- **Detalhe do exercício:**
  - desenho + nome;
  - dois números: **e1RM melhor de todos** e **e1RM atual**;
  - gráfico de linha turquesa;
  - filtros: 1 mês · 3 meses · tudo;
  - lista **"Recordes"**: maior e1RM, maior carga, maior volume, cada um com data.

### C7. Check-in semanal (acréscimo)

- Uma tela "Recuperação por músculo".
- Cada grupo treinado na semana aparece com uma fila de botões **1 · 2 · 3 · 4 · 5**.
- A escolha fica turquesa.
- Tudo alimenta a regra B4.

---

## ORDEM

1. **Parte A.** Aplicar a nova paleta no app inteiro. Me mandar print de 2 telas.
2. **B1 a B7.** Motor, com testes. Me mandar o resumo dos testes e o arquivo de configuração dos números.
3. **C4 e C5.** Execução + pós-treino.
4. **C3.** Card com mapa do corpo.
5. **C6.** Progresso por exercício.
6. **C1, C2 e C7.** Quiz, montagem do plano e check-in.

Pare e espere minha aprovação ao fim de cada item.
