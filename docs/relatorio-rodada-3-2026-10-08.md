# Relatório da rodada 3 — perfil 07, descarga da musculação, dose planejada — 08/10/2026

Continuação de `docs/relatorio-rodada-2-2026-10-08.md`.

**Estado desta rodada:**
- Estrelas, foto do perfil e artes ficam como entregues: não foram mexidas, com validação no iPhone pendente.
- Planos dourados não atualizados; planos ativos não alterados.
- Sem commit, push nem IPA.

**Backup:** `backups/antes-rodada3-2026-10-08/` (`src/motor`, `treino-app.html`, `tests`).

---

## 1. Perfil 07 — investigação da redução forçada

### 1.1 Sequência das decisões na semana 4 (descarga), motor como estava

Alvo de corrida da semana: **83 min** (descarga = 75% do volume do bloco). Limite de validação (V4/V10) = `volume × 1,10 + 2`.

| Passo | Ajustes | Semana construída | Validação |
|---|---|---|---|
| Ciclo 1 | fator 1,00 | 106′: Seg leve 18 · Ter tiro 41 · Qui leve 18 · Sáb longão 29 · musc Seg, Qui | V4 106 > **96** · V10 |
| Ciclo 2 | fator 0,90 · semProgressao | 89′: Seg 18 · Ter tiro 41 · Sáb 30 · musc Seg, Qui | V4 89 > **84** · V10 |
| Ciclo 3 | fator 0,81 | 86′: Seg 18 · Ter 41 · Sáb 27 · musc Seg, Qui | V4 86 > **76** · V10 |
| Redução forçada 1 | fator 0,73 · reduzir 1 | 83′ (igual) · musc Seg, Qui | V4 83 > **72** |
| Redução forçada 2 | reduzir 2 | 83′ (igual) | V4 83 > 72 |
| Redução forçada 3 | reduzir 3 | 83′ · **musc só Qui** | V4 83 > 72 |
| Redução forçada 4 | reduzir 4 | 83′ · **sem musculação** | V4 83 > 72 |
| Redução forçada 5 | reduzir 5 | 57′: Seg leve 25 · Sáb longão 32 · **sem tiro, sem musculação** | OK |
| Revisão do corte (rodada 2) | fator 1,00 | 83′: Seg leve 38 · Sáb longão **45** · sem musculação | OK |

### 1.2 Causas

1. **O limite encolhia junto com o corte (defeito).**
   - O limite do V4 era calculado sobre `alvo × fator de correção`. Cada corte de 10% baixava também o limite: 96 → 84 → 76 → 72.
   - As sessões têm duração mínima (tiro de 41 min; rodagem de 18 min), então a semana para de encolher em ~83 min e nunca alcança o limite, que continua caindo.
   - A partir daí só a redução forçada "resolve".
2. **A redução forçada tira sessões que não têm relação com o erro (defeito secundário, não corrigido nesta rodada).**
   - O erro era de volume de **corrida**, mas as reduções 1 a 4 tiraram as duas sessões de **musculação** sem mudar nada na corrida.
   - Só a 5ª tirou o tiro e uma rodagem.
3. **V10 repete a conta do V4.** "Aumento de volume sem justificativa" usa exatamente a mesma fórmula. Por isso todo excesso de volume vira dois erros e liga `semProgressao`. Registrado, não alterado.
4. **Isso já acontecia no motor commitado, antes da P1:** a semana 4 do perfil 07 saía com 2 corridas (25 e 32 min) e **sem musculação**. A revisão do corte da rodada 2 só deixou o efeito visível (longão de 45 min).

### 1.3 Correção aplicada (local, aguardando sua avaliação)

O limite de volume (V4 e V10) passa a medir a semana contra o **volume planejado** e não contra o corte que a própria correção aplicou.
- Volume planejado = alvo da trajetória × reduções pedidas de fora (check-in, pausa, lesão).
- O corte da correção continua reduzindo a semana construída; só não move mais a régua.
- Nenhuma regra nova de limite, de longão ou de descarga.

**Sequência depois da correção (semana 4):**

| Passo | Semana | Validação |
|---|---|---|
| Ciclo 1 (fator 1,00) | 106′ (4 corridas + musc Seg, Qui) | V4 106 > 96 · V10 |
| Ciclo 2 (fator 0,90, semProgressao) | 89′: leve 18 · tiro 41 · longão 30 · musc Seg, Qui | **OK** |
| Revisão do corte → fator 1,00 | 93′: leve 18 · tiro 41 · longão 34 · musc Seg, Qui | OK (93 ≤ 96) |

### 1.4 Semana inteira — antes e depois (perfil 07)

| Semana | Motor commitado (antes da P1) | Motor da rodada 2 (P1 + revisão do corte) | **Agora (com 1.3)** |
|---|---|---|---|
| S1 Base | 95′ · leve 18, tiro 42, longão 35 · musc 2 · 3 folgas | 99′ · leve 18, tiro 42, longão 39 · musc 2 | 99′ · igual à rodada 2 |
| S3 Base | 117′ · 4 corridas, longão 39 · musc 2 | 119′ · 4 corridas, longão 39 · musc 2 | 119′ · igual |
| **S4 Descarga** | **57′ · leve 25, longão 32 · sem tiro · sem musculação · 5 folgas** | **83′ · leve 38, longão 45 · sem tiro · sem musculação · 5 folgas** | **93′ · leve 18, tiro 12 × 200 m (41′), longão 34 · musc 2 · 3 folgas** |
| S8 Descarga | 115′ · 4 corridas · musc 2 | 114′ · 4 corridas · musc 2 | 114′ · igual |

**Leitura:**
- Agora a descarga tem 78% dos minutos da S3 (93 de 119).
- O longão (34′) é menor que o da S3 (39′) e a musculação continua.
- O tiro (41′) continua do mesmo tamanho: isso é a questão da dose (seções 3 e 4), não deste defeito.
- **A S8 (descarga) tem 114′, quase igual à S3.** A trajetória define a descarga como 75% do volume do bloco, que cresce. Não é efeito desta correção; fica registrado.

### 1.5 Outros efeitos da correção nos 20 perfis

- **Só um outro perfil muda: 06 (retorno longo), semana 4.**
  - O corte em cascata ia a 0,81 (longão em trote/caminhada de 23′); agora para em 0,90 (27′).
  - A semana fica com 73′ para um alvo de 68′ (dentro da tolerância de 10%), contra 85′ na S3.
- **Redução forçada restante:** perfis 12 e 20, uma vez por semana, por V9 (conflito de agenda). Não tem relação com volume.
- **Testes** (`tests/node/semana-do-plano.test.js`, +5):
  - 07 S4 sem redução forçada;
  - musculação mantida;
  - longão da descarga ≤ longão da S3;
  - volume dentro do alvo;
  - com check-in de −20%, a semana respeita o volume reduzido.
- **Diagnóstico:** `gerarPlanoSemanal` aceita `opcoes.rastrear`, que só observa cada construção/validação (usado para montar a tabela 1.1; não muda decisões).

---

## 2. Musculação — a descarga que existia no motor antigo

### 2.1 Regra original (`treino-app.html`, motor híbrido V1)

`buildHybridProgressionFactors` + `buildHybridMuscPlan`:
- O fator de séries começa em **0,75** (`HYBRID_CONFIG.muscVolumeFactor`, "desconto de interferência").
- Nas semanas 2 de cada bloco ("semana da musculação"), sobe em direção a 1.
- Na **semana 4 de cada bloco (Descarga)**: `muscF = max(0,75, muscF × 0,75)`.
- Séries do exercício = `max(3, round(séries do esquema × muscF))`, com **piso de 3**.
- Check-in "difícil" segura a subida; fadiga alta ou dor corta 20% só na semana seguinte.

**Efeito real no V1 (8 semanas):** fator 0,75 · 0,875 · 0,875 · **0,75** · 0,75 · 0,875 · 0,875 · **0,75**.
- Com o piso de 3, só mudava exercício de 4 séries ou mais: 4 → 3 na descarga.
- Exercícios de 3 séries nunca mudavam. Iniciante e todos os auxiliares/isolados de nível intermediário ficavam em 3.

### 2.2 Quando desapareceu

- **Commit `6c4e23b` (28/09/2026):** novo motor (`gerarPrimeiroPlanoV2`) para planos novos. O V2 não leva fator de séries por fase.
- **`muscSeriesFator`** existe na trajetória do V2 só para a calibração (0,85 nas semanas 1–2) e é aplicado em `gerarSemanaV2` e na retomada da pausa.
- **Planos antigos** (`motorV2` falso) ainda usam o V1 com a descarga. Planos novos não.

### 2.3 Interação com a sugestão de carga

- `suggestedForExercise` olha só o histórico do exercício e a meta de **repetições**. Não olha séries nem fase, nem no V1, nem no V2.
- Com séries reduzidas na descarga, quem bate a meta continua recebendo **+2,5% de carga**. O teste mostra a mesma sugestão com 4 ou 3 séries.
- Restaurar a regra antiga reduz volume (séries), mas **não** segura a carga. Segurar a carga na descarga seria regra nova, não incluída.

### 2.4 Restauração proposta (implementada **desligada**)

- `MOTOR_DESCARGA_MUSC = { ativa:false, fator:0.75, piso:3 }` em `src/motor/motor-v2.js`.
- `fatorSeriesDaSemana(alvo)` é usada por `gerarSemanaV2` e pela retomada da pausa.
- Desligada, o comportamento é idêntico ao atual, incluindo a calibração (0,85, piso 2).

**Impacto se for ligada** (20 perfis, séries por semana de descarga):

| Perfil | S4 | S8 | Motivo |
|---|---|---|---|
| 04 musculação avançada | 112 → 84 | 112 → 84 | Todos os exercícios com 4 séries (4 → 3) |
| 10 força | 70 → 66 | 70 → 66 | Só o exercício-base de força (5 → 4) |
| Os outros 18 | sem mudança | sem mudança | O V2 já prescreve 3 séries (piso 3) |

**Teste de regressão** (`tests/node/descarga-musculacao.test.js`, 11 verificações):
- desligada, nada muda;
- ligada, só as semanas de descarga mudam, com séries × 0,75 e piso 3;
- 3 séries continuam 3;
- calibração intacta;
- sugestão de carga não muda.

**Para decidir:** ligar a restauração como está ou não. Nenhuma outra regra de progressão entrou junto.

---

## 3. Protótipo da dose planejada (isolado, desligado no app)

**Arquivo:** `src/motor/prototipos/dose-planejada.js`. Não é importado pelo `index.js` do motor nem pelo app; só o script de comparação o instala, no próprio processo.

**O que separa:**
- **Formato** = qual variante da semana (400 m, 2 × 2000 m, ritmo de maratona…), girando pela semana como a P1.
- **Quantidade** = km nos trechos intensos.

**Dose de referência:**
- É o que a variante da semana 1 já prescreve para a pessoa, no mesmo contexto de nível, ritmos e espaço da sessão.
- Nenhum aumento ou redução por fase: isso seria regra nova.

**Como a quantidade se ajusta à dose:**
- repetições (intervalado: mínimo 4, ou 3 para tiros ≥ 1000 m);
- minutos (limiar contínuo, mínimo 12);
- número/comprimento dos blocos (limiar em blocos: mantém o bloco da variante se a dose ficar a ±15%; senão ajusta em múltiplos de 500 m);
- comprimento do bloco (ritmo de maratona, recuperação proporcional).

### 3.1 Comparativo nos 20 perfis × 8 semanas

**Sem diferença:** 16 perfis (01, 02, 04, 05, 06, 10–20). Eles não têm treino forte.

**Com diferença:** 03, 07, 08, 09. O resto da semana muda só pelo tamanho do treino forte.

| Perfil | Semanas | Motor atual (km intensos por semana do plano) | Protótipo | Observação |
|---|---|---|---|---|
| 08 (10k) | S1–S8 | 3,2 · **4,0 · 4,8** · 3,6 · 3,2 · 4,0 · 4,8 · 3,6 | 3,2 · 3,0 · 3,6 · 3,0 · 3,2 · 3,0 · 3,6 · 3,0 | 4 × 1000 m vira 3 × 1000 m; 4 × 1200 m vira 3 × 1200 m (−9 min na sessão) |
| 03 (21k) | S1–S8 | 4,9 · 4,0 · 4,7 · **6,0** · 4,9 · 4,0 · 4,7 · **6,0** | 4,9 · 4,0 · 4,9 · 4,0 · 4,9 · 4,0 · 4,9 · 4,0 | Na descarga, 2 × 3000 m vira 2 × 2000 m (48 → 40 min) |
| 09 (maratona) | S1–S8 | 6 · 6 · **9** · 5 · 6 · 6 · **9** · 5 | 6 · 6 · 6 · 6 · 6 · 6 · 6 · 6 | 3 × 3 km vira 3 × 2 km (70 → 56 min) |
| 07 (5k) | S1–S8 | 2,8 · 3,0 · 3,0 · 2,4 · 2,8 · 3,0 · 3,0 · 2,4 | 2,8 · 3,0 · 2,7 · 2,6 · 2,8 · 3,0 · 2,7 · 2,6 | Variantes já próximas; o arredondamento de repetições dá ±0,3 km |

**Leitura:**
- Com a dose separada do formato, a variação semanal de km intensos cai de até ±50% para ±10–20%. O que sobra vem do arredondamento por repetição inteira e dos mínimos.
- O protótipo **estabiliza** a dose, não só reduz.
  - Onde a variante atual passava da referência, a dose cai (08 S2/S3, 03 S4, 09 S3).
  - Onde ficava abaixo, ela **sobe até a referência**: 09 na descarga, 5 → 6 km; 07 na descarga, 2,4 → 2,6 km.
  - Por isso, com dose constante, a descarga do 09 fica com mais trabalho intenso que hoje. Isso reforça que a descarga precisa de regra própria de dose (seção 4) antes de qualquer ativação.
- Limitação: no 21k, "2 × 2000 m" só entrega 4,0 km (−18% da dose), porque 2 × 2500 m não cabe no espaço da sessão de referência.

**Para decidir:**
- se o protótipo segue para virar regra (desligado → ligado);
- se a dose de referência deve ser a da semana 1 ou uma tabela por nível/prova validada por profissional.

---

## 4. Descarga — fundamentação, o que se reduz e o efeito na semana

### 4.1 O que o motor faz hoje

- A trajetória (`motorTrajetoria`) reduz o **volume semanal de corrida em minutos** para 75% do bloco.
- Não reduz:
  - o treino forte, que mantém formato e quantidade da variante;
  - a musculação (seção 2);
  - o número de dias.
- Por isso a parte intensa pesa mais na semana de descarga em alguns perfis. No 07, o tiro é 44% dos minutos na S4, contra 37% na S3.

### 4.2 De onde vieram os "50–60%"

- **Não é regra aprovada.** Foi uma sugestão minha, inspirada na literatura de **polimento pré-prova**.
- A meta-análise de Bosquet e colaboradores (2007) encontrou melhor resultado reduzindo o **volume** em ~41–60%, **mantendo intensidade e frequência**.
- Isso é polimento antes de prova, não necessariamente a descarga de meio de bloco. A transposição precisa de validação profissional.
- A medida reduzida na proposta é a **quantidade de trabalho intenso** (km ou minutos em Z3–Z5 da sessão forte). O **ritmo/zona não muda**: a intensidade de cada trecho continua a mesma, e a quantidade de trechos cai.

### 4.3 Efeito de cada alternativa na semana inteira (descarga S4 × S3)

"Intensos" = minutos previstos nos trechos em Z3–Z5.

| Perfil | Alternativa | Treino forte | Semana: min · intensos (% ) · sessões duras · maior sessão |
|---|---|---|---|
| 08 | S3 (referência) | 4 × 1200 m (50′) | 179′ · 23′ (13%) · 3 · 63′ |
| | Atual | 6 × 600 m (42′) | 137′ · 17′ (12%) · 3 · 47′ |
| | Variante da semana 1 | 4 × 800 m (39′) | 134′ · 15′ (11%) · 3 · 47′ |
| | Protótipo, mesma dose | 5 × 600 m (38′) | 133′ · 14′ (11%) · 3 · 47′ |
| | Protótipo, 60% da dose | 4 × 600 m (34′), limitado pelo mínimo de 4 | 129′ · 11′ (9%) · 3 · 47′ |
| | Sem treino forte | — | 134′ · 0′ · 2 · 47′ |
| 03 | S3 | 20 min de limiar (40′) | 265′ · 20′ (8%) · 2 · 75′ |
| | Atual | 2 × 3000 m (48′) | 235′ · **26′ (11%)** · 2 · 73′ |
| | Variante da semana 1 | 21 min (41′) | 228′ · 21′ (9%) · 2 · 73′ |
| | Protótipo, mesma dose | 2 × 2000 m (40′) | 227′ · 17′ (7%) · 2 · 73′ |
| | Protótipo, 60% | 2 × 1500 m (35′) | 222′ · 13′ (6%) · 2 · 73′ |
| | Sem treino forte | — | 237′ · 0′ · 1 · 73′ |
| 09 | S3 | 3 × 3 km em ritmo de maratona (70′) | 362′ · 68′ (19%) · 2 · 112′ |
| | Atual | 5 km contínuos (41′) | 275′ · 41′ (15%) · 2 · 84′ |
| | Variante da semana 1 | 2 × 3 km (51′) | 285′ · 45′ (16%) · 2 · 84′ |
| | Protótipo, 60% | 3,5 km (34′) | 268′ · 34′ (13%) · 2 · 84′ |
| | Sem treino forte | — (o longão mantém o final em ritmo de prova) | 284′ · 18′ (6%) · 1 · 84′ |
| 07 | S3 | 10 × 300 m (44′) | 119′ · 13′ (11%) · 2 · 44′ |
| | Atual | 12 × 200 m (41′) | 93′ · 10′ (11%) · 2 · 41′ |
| | Protótipo, 60% | 8 × 200 m (34′) | 86′ · 7′ (8%) · 2 · 34′ |
| | Sem treino forte | — | 83′ · 0′ · 1 · 29′ |

**Como cada medida é afetada:**
- **Duração da semana:** quase não muda entre as alternativas (±5%). O volume vem da trajetória (75%), e os minutos que saem do treino forte voltam para as rodagens.
- **Intensidade** (ritmo/zona de cada trecho): igual em todas. O que muda é a **quantidade** de minutos intensos. Com 60% da dose, cai cerca de 45–55% em relação à S3 (08: 23 → 11′; 03: 20 → 13′; 09: 68 → 34′).
- **Recuperação:**
  - "Sem treino forte" é a única que tira uma sessão dura (3 → 2 no 08; 2 → 1 nos demais).
  - As outras mantêm as mesmas sessões duras e os mesmos dias livres; só encurtam a sessão forte e as pausas.
- **Carga semanal:** o app não tem número de carga (a função `cargaDaSessao` é categórica: alta/média/baixa). Por isso a comparação usa minutos totais e minutos intensos.

**Correção da minha recomendação anterior:** "sem treino forte para quem corre 2–3 vezes" foi retirada. O número de corridas não é critério. Se o treino forte sai ou não deve depender das regras de segurança que já existem (nível, dor, recuperação, calibração) e de sinais de recuperação registrados, nunca da contagem de sessões.

---

## 5. Propostas mantidas, sem ativar

As propostas de trote/caminhada, estagnação e quedas sucessivas de carga continuam só documentadas (`relatorio-rodada-2`, seções 2.5 e 2.6).

Em todas: **ausência de registro ou de check-in não conta como boa recuperação**. Sem dado, nada avança e nada sobe; o motor só mantém o que já está.

## 6. Planos dourados

**Não atualizados.** Agora são **9 diferenças**, pendentes de avaliação uma a uma; nenhuma deve ser aceita por já ser conhecida.

| Snapshot | Origem |
|---|---|
| plano-03, plano-08, plano-09 | P1 (formato por semana) |
| plano-07 | P1 + revisão do corte (S1 longão 35 → 39′) + correção do limite (S4) |
| **plano-06 (novo nesta rodada)** | Correção do limite: S4, longão em trote/caminhada 23 → 27′ |
| plano-12, plano-19, plano-20 | Aviso de treino forte removido; 20 também com a revisão do corte |
| motor-checkin-semanal | P1 (semana 2 do perfil 08: tiro de 39 para 44′) |

## 7. Testes

- **Novos ou ampliados:**
  - `semana-do-plano` — 35 verificações;
  - `descarga-musculacao` — 11 verificações.
- **Suíte completa** (`node tests/run.js`, Node + navegador): **603 verificações ok · 9 falhas**.
  - Nenhuma falha nova.
  - As 9 são os snapshots da seção 6: plano-03, 06, 07, 08, 09, 12, 19, 20 e `motor-checkin-semanal`.

## 8. Arquivos alterados nesta rodada

| Arquivo | O que mudou |
|---|---|
| `src/motor/motor-v2.js` | Limite V4/V10 contra o volume planejado; `volumeFatorPlanejado`; diagnóstico `opcoes.rastrear`; `MOTOR_DESCARGA_MUSC` desligado e `fatorSeriesDaSemana` |
| `src/motor/plano-vivo.js`, `src/motor/pausa.js` | Usam `fatorSeriesDaSemana` (sem mudança de comportamento com a restauração desligada) |
| `src/motor/prototipos/dose-planejada.js` | Novo, isolado |
| `tests/node/semana-do-plano.test.js` | +5 verificações (perfil 07) |
| `tests/node/descarga-musculacao.test.js` | Novo |
| `tests/run.js` | Registra o teste novo |
