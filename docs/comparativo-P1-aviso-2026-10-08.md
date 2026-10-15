# Comparativo — P1 (número da semana) e aviso de treino forte removido — 08/10/2026

Rodada aprovada: P1 e a parte informativa da P6. Nenhuma outra regra do motor mudou.

Situação desta rodada:
- Planos dourados **não** atualizados: aguardam aprovação deste comparativo.
- Nenhum plano ativo regenerado.
- Sem commit, push ou IPA.
- Testes no iPhone pendentes.

Backup: `backups/antes-P1-weeknumber-2026-10-08/` (treino-app.html, src/motor, tests).

---

## 1. O que foi alterado

### 1.1 Rastreio de `ctx.weekNumber` (antes de alterar)

O contexto da corrida (`est.corrida.ctx`) nascia com `weekNumber:1` (`src/motor/motor-v2.js:368`) e não mudava ao gerar a semana N.

| Uso de `ctx.weekNumber` | Onde | Efeito real no motor V2 |
|---|---|---|
| Variante do intervalado `(weekNumber-1) % 4` | `hbQualidadeIntervalo` (treino-app.html) | **Afetado.** Antes, sempre a 1ª variante. |
| Variante do limiar/ritmo de maratona | `hbQualidadeTempo` | **Afetado.** Antes, sempre a 1ª variante. |
| Minutos de trote na alternância trote/caminhada | `hbRunWalk` | **Não afetado.** No V2, toda corrida em trote/caminhada tem `ctx.runWalk` definido pelo perfil (`motor-v2.js:312–322`), e esse valor tem prioridade sobre a fórmula por semana. |
| Repetições do fartlek | `hbQualidadeFartlek` | **Não afetado.** O V2 não usa essa função. |

**Correção da auditoria anterior.** A auditoria atribuiu ao `weekNumber` a falta de progressão do trote/caminhada (perfil 05). Isso está errado. O trote/caminhada fica parado porque `runWalk` (`t`, `w`) é calculado uma vez a partir do perfil e repetido em todas as semanas. A P1 não muda isso. É um achado separado e continua em aberto.

### 1.2 Correção (P1)

`gerarPlanoSemanal` passa a usar o número da semana do alvo da trajetória (`opcoes.alvoSemana.semana`). Isso vale para a geração normal (`gerarSemanaV2`) e para a retomada depois da pausa (`gerarSemanaRetomada`). Sem alvo, continua a semana 1.

Nenhuma regra de segurança mudou:
- `motorQualidadePermitida` decide quem pode fazer treino forte;
- o teto de tempo do dia rebaixa o tiro que não cabe;
- a validação V1–V10 continua igual.

### 1.3 Aviso (parte informativa da P6)

Ao montar o comparativo apareceram **dois caminhos** em que o treino forte some em silêncio, e o aviso cobre os dois:

1. **Tempo do dia** (`causa: 'tempo'`, perfis 12 e 19). O tiro planejado não cabe no tempo do dia, sobretudo no dia combinado com musculação, e vira rodagem leve (`motorMontarCorrida`).
2. **Correção da distribuição** (`causa: 'distribuicao'`, perfil 20). V6/V9 levam `motorAjustar` a ligar `semQualidade` depois de `aliviarInferior`.

O que foi feito:
- A semana guarda `avisoQualidade` (`{ motivo:'agenda', causa, texto, erros }`). O log ganha `qualidade_removida_pela_agenda` e os alertas também.
- A aba Treino mostra só o texto, num cartão cinza sem botão, abaixo da lista de dias da semana exibida.
- A ordem das tentativas não mudou e nada força a manutenção do treino forte.

Textos exibidos:
- "Sem treino forte nesta semana: no dia em que ele caberia, não sobra tempo junto com a musculação."
- "Sem treino forte nesta semana: nos seus dias, a musculação ficaria em dias seguidos ou colada ao longão."
- Outras variações, para estímulos seguidos, falta de descanso e recuperação reduzida, ficam prontas em `motorTextoQualidadeRemovida`.

Sem aviso quando o treino forte nunca foi permitido (iniciante, dor, retorno, calibração, prontidão) ou quando ele ficou na semana.

### 1.4 Testes

`tests/node/semana-do-plano.test.js` tem 25 verificações. Reproduz o defeito: antes da correção, o perfil 08 tinha 800 m nas 8 semanas e havia 4 falhas. Depois, todas passam.

Cobre:
- rotação da variante por semana;
- semana sem alvo;
- 8 perfis bloqueados continuam sem treino forte;
- retorno continua em trote/caminhada;
- aviso nos perfis 19/20 e na aba Treino;
- ausência de aviso nos perfis 01, 15, 18 e 08.

---

## 2. Comparativo dos 20 perfis × 8 semanas

**Sem mudança:** 13 perfis — 01, 02, 04, 05, 06, 10, 11, 13, 14, 15, 16, 17 e 18 (o 16 é bloqueado antes e depois). Isso inclui os dois perfis de retorno (05, 06) e os de dor (15, 17): tipo, blocos, duração, distância e trote/caminhada idênticos.

**Com mudança:** 7 perfis — 03, 07, 08 e 09 (sessão de qualidade), 12 e 19 (só aviso), 20 (aviso + efeito indireto, ver 3c).

"Intenso" = km somados dos trechos em Z3–Z5. "Rec." = recuperação entre os trechos.

### 03 — corrida avançada, prova 21k (limiar)

| Semana | Antes | Depois |
|---|---|---|
| S1, S5 | 21 min contínuos em limiar · 9 km/41 min · intenso 4,9 km | igual |
| S2 (Retomada) | igual a S1 | 2 × 2000 m em Z4, rec. trote 2' · 8,5 km/39 min · intenso 4,0 km |
| S3 (Base), S7 | igual a S1 | 20 min contínuos · 8,5 km/40 min · intenso 4,7 km |
| **S4, S8 (Descarga)** | igual a S1 | **2 × 3000 m em Z4, rec. trote 2'30" · 10,5 km/48 min · intenso 6,0 km** |
| S6 | igual a S1 | 2 × 2000 m · intenso 4,0 km |

### 07 — prova 5k intermediário (intervalado)

| Semana | Antes | Depois |
|---|---|---|
| S1, S5 | 7 × 400 m, rec. 1'30" · 7 km/42 min · intenso 2,8 km | igual |
| S2, S6 | igual | 5 × 600 m, rec. 2' · intenso 3,0 km |
| S3, S7 | igual | 10 × 300 m (ritmo R), rec. 1'15" · 7,5 km/44 min · intenso 3,0 km |
| S4 (Descarga) | igual | sem qualidade antes e depois (semana já era assim) |
| S8 (Descarga) | igual | 12 × 200 m (ritmo R), rec. 1' · 7 km/41 min · intenso 2,4 km |

### 08 — prova 10k intermediário (intervalado)

| Semana | Antes | Depois |
|---|---|---|
| S1, S5 | 4 × 800 m, rec. 2' · 6,5 km/39 min · intenso 3,2 km | igual |
| S2, S6 | igual | 4 × 1000 m, rec. 2'30" · 7,5 km/44 min · intenso 4,0 km |
| **S3, S7** | igual | **4 × 1200 m, rec. 3' · 8,5 km/50 min · intenso 4,8 km** |
| S4, S8 (Descarga) | igual | 6 × 600 m, rec. 1'30" · 7 km/42 min · intenso 3,6 km |

### 09 — maratona avançado (ritmo de maratona)

| Semana | Antes | Depois |
|---|---|---|
| S1, S2, S5, S6 | 2 × 3 km em ritmo de maratona, 1 km Z2 entre · 10,5 km/51 min · intenso 6 km | igual |
| **S3, S7** | igual | **3 × 3 km, 1 km Z2 entre · 14,5 km/70 min · intenso 9 km** |
| S4, S8 (Descarga) | igual | 5 km contínuos em ritmo de maratona · 8,5 km/41 min · intenso 5 km |

### 12, 19, 20 — aviso

| Perfil | Semanas | Causa | Texto |
|---|---|---|---|
| 12 dias consecutivos (Seg–Qua) | S1–S8 | tempo | "…no dia em que ele caberia, não sobra tempo junto com a musculação." |
| 19 prefere combinar | S1–S8 | tempo | idem |
| 20 exige separar | S1–S8 | distribuição | "…nos seus dias, a musculação ficaria em dias seguidos ou colada ao longão." |

As sessões dos perfis 12 e 19 não mudaram. A rodagem que aparece no lugar do tiro já existia antes.

**Perfil 20, S4 (Descarga), efeito indireto:**
- Antes: leves de 4 km/24 min e longão de 5,5 km/33 min.
- Depois: leves de 3,5 km/21 min e longão de 4 km/26 min.

---

## 3. Pontos que precisam da sua decisão

**a) Descarga mais pesada no perfil 03.**
- A 4ª variante da lista do 21k (3 × 3000 m, reduzida a 2 × 3000 m) cai justamente nas semanas 4 e 8, que são de descarga.
- Intenso 6,0 km, contra 4,9 km antes e 4,0–4,7 km nas semanas normais.
- Nos perfis 07, 08 e 09 a descarga ficou igual ou mais leve que a S3.
- A causa é a rotação simples `(semana-1) % 4`, sem olhar a fase.

**b) Saltos de intensidade entre semanas normais.**
- 08: S2→S3 sobe de 4,0 para 4,8 km em Z5. O pico é 50% acima do que era fixo (3,2 km).
- 09: S3 e S7 têm 9 km em ritmo de maratona e 70 min, 50% acima dos 6 km.
- As listas de variantes foram escritas com volumes diferentes entre si. O teto de tempo do dia e o mínimo de 4 repetições continuam valendo, mas não existe teto de "km intensos" por semana.

**c) Efeito indireto no perfil 20 (S4).**
- Na descarga, a variante da semana 4 entra nos primeiros ciclos de validação e gera erros extras (volume/progressão).
- `motorAjustar` aplica `volumeFator 0,81` e `semProgressao`. Depois o tiro sai pela correção V9, mas a redução de volume fica.
- O resultado é mais conservador, mas a causa é um artefato da escada de correção: ajustes motivados por uma sessão que não ficou na semana.

**d) Retorno e trote/caminhada.** Sem mudança, e a P1 não resolve a falta de progressão (ver 1.1).

**Opções para (a) e (b):**
1. Aprovar como está.
2. **Na descarga, usar a variante da semana 1**, como antes da correção. É uma limitação da própria P1, sem regra nova. Resolve (a). **Recomendo esta.**
3. Teto de km intensos por semana em relação à semana anterior (ex.: no máximo +15%). Resolve (b), mas é regra nova e entra na rodada P2/P3.

**Planos dourados que mudam ao aprovar:** plano-03, plano-07, plano-08, plano-09, plano-12, plano-19, plano-20 e o snapshot `motor-checkin-semanal`. No checkin-semanal, a semana 2 do perfil 08 passa de 39 para 44 min.

**Planos ativos:** nada é regenerado.
- Semanas já geradas ficam como estão.
- Só as semanas ainda pendentes, geradas depois da atualização, usam a variante da semana e o aviso.
- Uma semana antiga não ganha aviso.

---

## 4. Musculação — progressão simulada com treinos realizados

Simulação com o perfil 08 e a função real de sugestão de carga (`suggestedForExercise`, `src/motor/forca.js`). São 8 sessões semanais, seguindo sempre a carga sugerida. Exercícios: Supino reto com barra 3x8, Agachamento livre com barra 3x8 e Leg press 45° 3x10.

| Cenário | Supino | Agachamento | Leg press | Decisão do app |
|---|---|---|---|---|
| Melhorando (bate a meta, PSE 7) | 40 → 47 kg | 50 → 60 kg | 100 → 118,5 kg | sobe 2,5% por sessão (`meta_esforco_controlado`) |
| Sem anotar PSE, bate a meta | 40 → 47 kg | 50 → 60 kg | 100 → 118,5 kg | sobe igual (`meta_cumprida`) |
| Estagnando (acima de +5% faz meta −1, PSE 8,5) | sobe até 43 kg e fica 5 sessões | fica em 54 kg | fica em 107,5 kg | `quase_la` indefinidamente |
| Piorando (a partir da 3ª sessão, reps 70% e PSE 9,5) | 42 → 25 kg | 52,5 → 31 kg | 105 → 62 kg | −10% em toda sessão (`pse_alto`) |

**O que isso mostra:**
- **A progressão existe e depende dos exercícios serem os mesmos.** O histórico é guardado por exercício (`repdbId`/nome), então repetir o exercício é o que permite subir a carga. Trocar o exercício a cada 4 semanas (P7 como escrita) zeraria a sugestão e voltaria à carga de partida. Por isso a P7 não deve ser aplicada como rodízio fixo.
- **Subir séries/repetições automaticamente (P8 como escrita) brigaria com a progressão dupla.** A sugestão compara as repetições feitas com a meta. Mudar a meta de 8 para 10 faria a pessoa "não bater a meta" e manteria ou reduziria a carga.
- **Lacunas reais encontradas:**
  1. **Estagnação sem resposta.** Depois de várias sessões seguidas em `quase_la`, nada muda: nem repetições, nem variação, nem aviso.
  2. **Queda sem limite.** Com PSE alto repetido, a carga cai 10% por sessão sem piso. Foram −40% em 6 sessões, sem nenhuma pergunta sobre recuperação, sono ou dor.
  3. **A descarga não toca a musculação.** Na semana 4/8 o volume de séries é o mesmo e a sugestão continua subindo a carga. O fator de séries só existe na calibração.
- A regra "pernas não sobem com corrida pesada" (`interferenciaCorridaNasPernas`) não disparou nesta simulação, porque depende do calendário real da semana. Ela será avaliada separadamente.

---

## 5. P2–P10 refinadas (não aprovadas — só proposta)

- **P2/P3/P4 — variedade sem intensidade.**
  - Variedade, para todos: mudar a estrutura com a mesma zona. Exemplos: leves com durações diferentes (uma curta, uma média), longão por tempo ou por distância, divisão do volume.
  - Intensidade (acelerações, final progressivo, fartlek): só quando `motorQualidadePermitida` for verdadeiro.
  - Bloqueio por dor, fadiga, retorno ou calibração impede também acelerações e progressivo.
  - A descarga reduz o treino forte (menos repetições ou variante mais curta) e nunca usa a variante mais longa.
- **P5 — saída da calibração só por evidência.** Exemplos:
  - 2 ou mais semanas consecutivas com check-in respondido;
  - sem dor, fadiga ≤ 3;
  - pelo menos 80% das sessões concluídas;
  - esforço registrado coerente.
  Passagem de semanas e ausência de check-in não contam: sem evidência, a calibração continua.
- **P6 — redistribuição.** Tentar outros arranjos só entre os dias marcados como disponíveis, dentro dos minutos de cada dia, sem violar V6/V9 e sem contrariar "combinar"/"separar". Sem arranjo válido, mantém o comportamento atual com o aviso.
- **P7 — variação de exercício.** Sem rodízio fixo. Trocar só por estagnação comprovada (ex.: 3 sessões seguidas sem progresso) ou a pedido, por exercício do mesmo padrão de movimento. Avaliar levar a carga de referência do exercício anterior.
- **P8 — resposta a estagnação e queda, sem mexer na progressão dupla:**
  - estagnação: propor mudar a faixa de repetições ou variação;
  - queda: piso por sessão e pergunta sobre recuperação depois de 2 reduções seguidas;
  - descarga: manter a carga e reduzir uma série.
- **P9 — descanso entre séries.** Critério por papel (base/auxiliar/isolado) × nível × foco. Impacto a medir: minutos a mais por sessão contra o tempo disponível do dia, porque mais descanso pode tirar um exercício da sessão.
- **P10 — dia livre no meio.** Critério: quando o volume da semana cabe em menos dias do que os disponíveis e haveria 5 ou mais dias seguidos. Impacto a medir: dobros a mais, concentração de volume e conflito com V9.

Cada uma, se aprovada, terá comparativo antes/depois como este.
