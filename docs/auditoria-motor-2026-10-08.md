# Auditoria da qualidade do motor — 08/10/2026

Somente leitura. Nenhuma regra, plano dourado ou teste foi alterado. As propostas no fim aguardam aprovação.

**Método:** os 20 perfis de referência de `tests/harness/perfis.js` foram gerados pelo fluxo real (`qv2Aplicar` → `gerarPrimeiroPlanoV2` → `gerarSemanaV2` para cada semana). Todas as 8 semanas de cada plano foram registradas: dia, tipo, descrição principal, exercícios, séries e descanso.

**Visão geral:**

| Área | Situação |
|---|---|
| Corrida | Pouquíssima variedade. O planejado nunca muda de forma de uma semana para outra. |
| Musculação | Sessões idênticas nas 8 semanas, sem progressão de séries na maioria dos perfis. |
| Descanso | Quantidade de folgas adequada. Descanso entre séries fixo por papel do exercício. |
| Combinação híbrida | Coerente: dobros só com rodagem leve e nenhum treino de pernas ao lado de longão ou tiro. Mas a correção de conflito retira a qualidade em silêncio. |

---

## 1. Corrida — falta de variedade (prioridade)

### 1.1 O que sai hoje

**Perfil 08 — prova 10k, intermediário, 4 corridas por semana.** O intervalado é sempre o mesmo, inclusive nas semanas de descarga:

| Semana (fase) | Qualidade | Leves | Longão |
|---|---|---|---|
| S1 (Base) | 4 × 800 m em Z5, trote 2' | 2 × 3,5 km contínuos Z2 | 8 km contínuos Z2 |
| S2 (Base) | 4 × 800 m em Z5, trote 2' | 2 × 3,5 km contínuos Z2 | 8 km contínuos Z2 |
| S3 (Base) | 4 × 800 m em Z5, trote 2' | 2 × 3,5 km contínuos Z2 | 8 km contínuos Z2 |
| S4 (Descarga) | 4 × 800 m em Z5, trote 2' | 2 × 2 km contínuos Z2 | 5,5 km contínuos Z2 |
| S8 (Descarga) | 4 × 800 m em Z5, trote 2' | 2 × 2 km contínuos Z2 | 5,5 km contínuos Z2 |

**Perfil 03 — corrida avançada, 5 corridas.** A S1 e a S5 têm o mesmo "Limiar 21 min contínuos". As outras quatro sessões são rodagens contínuas em Z2.

**Perfil 19 — saúde, 3 corridas.** Em todas as semanas há 1 longão e 2 rodagens leves, todos contínuos em Z2. Só a distância muda (S1 4 / 2,5 / 2,5 km; S8 4,5 / 3 / 3 km).

**Perfil 05 — retorno de pausa, trote e caminhada.** A S1 e a S8 são idênticas: 5×, 7× e 6× (3' trote + 1' caminhada). O trote não cresce.

**Em números, nos 20 perfis × 8 semanas:**
- 16 dos 20 perfis não recebem nenhuma sessão de qualidade no plano inteiro.
- Os 4 que recebem (03, 07, 08, 09) têm sempre o mesmo tipo e a mesma estrutura.
- Cada perfil tem de 1 a 3 estruturas de sessão distintas em 8 semanas.

### 1.2 Regras responsáveis

**A. A rotação de variantes nunca acontece (defeito).**
- `hbQualidadeIntervalo` e `hbQualidadeTempo` escolhem a variante por `lista[(ctx.weekNumber-1) % lista.length]` (treino-app.html, por volta das linhas 7994 e 8016).
- O `ctx` da corrida é criado com `weekNumber:1` fixo (`src/motor/motor-v2.js:368`) e não é atualizado ao gerar a semana N.
- Resultado: sempre a 1ª variante. As listas `HB_INTERVALO_VARIANTS` e `HB_TEMPO_VARIANTS` (treino-app.html:7907–7915) têm 4 variantes cada, e só a primeira é usada.
- O mesmo `weekNumber` congelado trava a progressão do trote/caminhada em `hbRunWalk` (`2 + floor((weekNumber-1)/2)` minutos de trote). Por isso o perfil 05 fica em 3'+1' para sempre.

**B. O tipo de qualidade é fixo pela distância da prova.**
- `motor-v2.js:612` define `qualidadeKind = goal<=10 ? 'intervalado' : 'limiar'`.
- Não existe alternância entre intervalado, limiar, fartlek e progressivo ao longo do ciclo, nem por fase (Base × Construção).
- `hbQualidadeFartlek` existe, mas o motor V2 não a usa.

**C. A qualidade fica bloqueada para a maioria dos perfis.**
- `motorQualidadePermitida` (`motor-v2.js:542–551`) devolve falso se qualquer uma destas condições valer:
  - nível iniciante;
  - situação diferente de "regular";
  - calibração;
  - prontidão reduzida;
  - restrição de dor;
  - regime trote/caminhada.
- `motorSessoesCorrida` (`motor-v2.js:556`) exige ainda 3 ou mais corridas por semana.
- A calibração é recalculada do perfil a cada semana (`motor-v2.js:394–403`). Situação "nunca", "parado" ou "ocasional" mantém `calC=true` nas 8 semanas, e por isso a qualidade não é liberada nem depois do período de retomada.

| Perfis | Motivo do bloqueio |
|---|---|
| 01, 02 | Iniciante / trote e caminhada |
| 05, 06 | Retorno de pausa (situação "parado") |
| 11 | Só 2 corridas por semana |
| 15, 17 | Dor no joelho / tornozelo |
| 18 | Prontidão reduzida |
| 19, 20 | Correção de conflito — ver item 4 |

**D. Leve e longão são sempre contínuos em Z2.**
- `hbSessaoLeve` e `hbSessaoLongo` (treino-app.html:7956–7978) só geram "X km contínuos em Z2".
- A exceção é a maratona, com os 30% finais em ritmo de prova.
- Não há leve com acelerações (strides), longão progressivo, final em ritmo de prova para 10k/21k, nem rodagem regenerativa mais curta.
- Para quem não pode fazer qualidade, este é todo o cardápio.

**E. A descarga só reduz volume.**
- A semana de descarga corta a distância das leves e do longão, mas mantém a mesma sessão de qualidade (perfil 08, S4 e S8).

---

## 2. Musculação

### 2.1 O que sai hoje

**Perfil 08 (3 sessões, suporte à corrida):**
- Ter (superiores): Supino reto com barra, Barra fixa neutra, Desenvolvimento na máquina, Remada cavalinho — 3x8, 3x10, 3x10, 3x10.
- Qua (inferiores): Agachamento livre com barra, Ponte de glúteo, Leg press 45° — 3x8, 3x10, 3x10.
- Sex (corpo inteiro): Agachamento livre, Mesa flexora, Panturrilha no leg press, Prancha.
- As 8 semanas são idênticas: mesmos exercícios, mesmas séries e repetições.

**Perfil 19 (2 sessões de corpo inteiro):**
- 3x10 e 3x12 do começo ao fim. As 8 semanas são idênticas.

**Perfil 04 (musculação avançada, 4 sessões):**
- Tem 27 exercícios distintos porque as duas sessões de superiores e as duas de inferiores se diferenciam dentro da semana.
- Mesmo assim, a S1 é igual à S8.
- A única mudança é 3 → 4 séries a partir da S3, quando sai da fase de retomada.

**Perfil 13 (casa, halteres):** 3 sessões de corpo inteiro quase iguais entre si (Flexão de braço, Wall sit e Hiperextensão nas três), repetidas nas 8 semanas.

**Contagem:** em todos os perfis, 7 de 7 trocas de semana repetem exatamente as mesmas sessões.

### 2.2 Regras responsáveis

- **A escolha dos exercícios é determinística.**
  - `buildHybridMuscSession` (treino-app.html:8148) percorre os slots e pega o primeiro exercício compatível.
  - `weekTaken` (`motor-v2.js:877`) só evita repetir dentro da mesma semana. Nada considera a semana anterior nem roda variações por bloco.
- **Iniciante faz só corpo inteiro** (`motor-v2.js:585`): com 2 ou 3 sessões, todas repetem os mesmos padrões.
- **Séries e repetições não progridem por semana.**
  - A prescrição vem do papel do exercício (`motor-v2.js:796–806`) e muda só pelo fator de fase.
  - Nos perfis 08 e 19 a fase não altera nada. Não há progressão de repetições, de séries ou de RPE ao longo do bloco.
  - A progressão de carga depende só do registro do usuário (sugestão de carga). O plano em si não evolui.

---

## 3. Descanso

| Perfil | Folgas por semana | Maior sequência de dias de treino | Descanso entre séries |
|---|---|---|---|
| 01 iniciante, 3 dias | 4 | 1 | 90 s em tudo |
| 04 musculação avançada | 2 | 4 | base 90 s, auxiliar 75 s, isolado 60 s |
| 08 10k intermediário | 1 | 6 | 75 s em tudo |
| 10 força, 4 dias | 3 | 2 | base 120 s, auxiliar 90 s, isolado 60 s |
| 18 baixa recuperação | 2 | 4 | 90 s em tudo |
| 20 exige separar | 2 | 4 | 90 s em tudo |

- **Folgas:** a quantidade é coerente com a disponibilidade informada. O ponto de atenção é o perfil 08: 6 dias seguidos de treino, com tiro na segunda e longão no sábado. Não é erro de regra, porque o usuário disponibilizou os 6 dias, mas o motor não força um dia livre no meio.
- **Descanso entre séries:** fixo pelo papel do exercício e pelo foco. Não muda por fase nem por proximidade da corrida dura.
- **Suporte à corrida:** 75 s até no exercício base (Agachamento livre com barra 3x8). É curto para um exercício pesado, embora seja coerente com o objetivo de manutenção.

---

## 4. Combinação híbrida

**Semana 1 de cada perfil:**
- Os dobros (corrida + musculação no mesmo dia) acontecem sempre com rodagem leve.
- Nenhum perfil teve sessão de pernas ao lado de longão ou tiro. As regras V6/V9 funcionam.

**Problema — correção de conflito apaga a qualidade sem aviso.**
- Perfis 19 e 20 (saúde, 3 corridas, qualidade permitida):
  1. A primeira distribuição gerou conflito V9 (custo ≥ 10000 das regras de musculação iniciante, `motor-v2.js:641–642` e `979–981`).
  2. `motorAjustar` (`motor-v2.js:1020`) aplica primeiro `aliviarInferior` e, se ainda houver conflito, `semQualidade`.
  3. O plano sai sem qualidade, embora o perfil permitisse.
- A escada de ajuste corta qualidade antes de tentar outra distribuição dos dias ou trocar a musculação de lugar.
- O log registra o ajuste, mas o usuário não fica sabendo.

**Outras observações:**
- O perfil 19 pediu "prefere combinar no mesmo dia". Recebeu 2 dobros (Qua e Sex) com rodagem leve, o que está correto.
- Perfil 12 ("dias consecutivos só"): longão na segunda e rodagem na terça. Está correto, mas a terça poderia ser regenerativa.

---

## 5. Propostas (aguardando aprovação — nada implementado)

Em ordem de impacto/risco.

| # | Proposta | Tipo | Efeito nos planos dourados |
|---|---|---|---|
| P1 | Passar o número real da semana para `ctx.weekNumber` ao gerar cada semana. Liga a rotação das 4 variantes de tiro/limiar e a progressão do trote/caminhada que já existem. | Correção de defeito | Muda todas as semanas 2+ com qualidade ou trote/caminhada |
| P2 | Alternar o tipo de qualidade por fase: Base = fartlek / progressivo curto; Construção = intervalado (5–10k) ou limiar (21–42k). Usa `hbQualidadeFartlek`, que já existe. | Regra nova | Muda perfis 03, 07, 08 e 09 |
| P3 | Na semana de descarga, qualidade mais curta (menos repetições) ou trocada por fartlek leve. | Regra nova | Semanas 4 e 8 |
| P4 | Leve e longão com variações seguras, sem intensidade alta: rodagem com 4–6 acelerações de 20 s (só não iniciante), longão com final progressivo moderado em Construção, rodagem regenerativa curta após o dia duro. Isto dá variedade também a quem não pode fazer qualidade. | Regra nova | Muda quase todos os perfis |
| P5 | Calibração com prazo: após 2–3 semanas sem sinais ruins no check-in, liberar qualidade leve (fartlek) para situação "parado"/"ocasional". Iniciante segue sem tiro. | Muda regra de segurança | Perfis 05, 06 e calibrados |
| P6 | Na correção de conflito, tentar redistribuir os dias antes de aplicar `semQualidade`, e avisar quando a qualidade for removida. | Muda escada de ajuste | Perfis 19 e 20 |
| P7 | Musculação: rodízio de variações por bloco de 4 semanas (ex.: Agachamento livre ↔ Goblet, Supino com barra ↔ com halteres), mantendo o padrão de movimento. | Regra nova | Todos com musculação |
| P8 | Musculação: progressão dentro do bloco (repetições sobem 8→10→12 ou +1 série) e volta ao início na descarga. | Regra nova | Todos com musculação |
| P9 | Descanso entre séries do exercício base ≥ 90–120 s também no foco suporte à corrida. | Ajuste de parâmetro | Perfis com suporte à corrida |
| P10 | Com 6 dias seguidos disponíveis, preferir deixar um dia livre no meio quando o volume couber em 5 dias. | Ajuste de custo | Perfil 08 e semelhantes |

Recomendação: aprovar primeiro a **P1**. É a causa direta da repetição na corrida e usa código que já existe. Em seguida, P2 + P3 + P4 para variedade e P7 + P8 para musculação. P5 e P6 mexem em regras de segurança e merecem decisão separada.

Cada proposta aprovada será implementada em unidade própria. Antes de alterar qualquer plano dourado, entra o relatório comparativo antes/depois.
