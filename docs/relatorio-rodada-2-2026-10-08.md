# Relatório da rodada 2 — motor, estrelas, foto do perfil e artes — 08/10/2026

Continuação de `docs/comparativo-P1-aviso-2026-10-08.md`.

**Estado desta rodada:**
- Tudo está local: sem commit, push nem IPA.
- Planos dourados **não** atualizados e planos ativos **não** regenerados.
- Nada em `ios/`, `www/` ou `node_modules/`.

**Backups:**
- `backups/antes-rodada2-2026-10-08/` — `treino-app.html`, `src/motor`, `tests`, `docs`, mais `treino-app-antes-artes.html` (cópia antes da parte 4).
- `backups/antes-P1-weeknumber-2026-10-08/` — estado antes da P1.

---

## 1. Arquivos alterados nesta rodada

| Arquivo | O que mudou |
|---|---|
| `src/motor/motor-v2.js` | Revisão dos cortes de dose depois da correção (parte 1.1). P1 e aviso continuam da rodada anterior. |
| `treino-app.html` | Favoritos no menu de três pontos e Biblioteca sem estrela (parte 2). Foto do perfil pelo avatar (parte 3). Escala, posição e margens das artes, mais o marcador da galeria (parte 4). |
| `tests/node/semana-do-plano.test.js` | +5 verificações (cortes revistos e mantidos). Total: 30. |
| `tests/navegador/favoritos-foto-perfil.test.js` | Novo: 17 verificações. |
| `tests/navegador/artes-escala.test.js` | Novo: 7 verificações. |
| `docs/relatorio-rodada-2-2026-10-08.md` | Este relatório. |

**Material de conferência (não vai para commit):**
- `ARTES-EXPORTADAS-FICTICIAS-2026-10-08/`: 27 PNGs exportados com dados fictícios, prefixo `FINAL-FICTICIO-`.
- `prints-motor-P1/`: prints do aviso de treino forte.

---

## 2. Parte 1 — Motor

### 2.1 Correção feita: corte de dose causado por sessão removida

**Defeito.**
- Na semana 4 do perfil 20, o tiro planejado entrava nos primeiros ciclos de validação e gerava erros V4/V10.
- `motorAjustar` ligava `volumeFator 0,81` e `semProgressao`.
- Depois a correção V9 tirava o tiro, mas os cortes ficavam.
- Resultado: rodagens de 21 min e longão de 26 min, motivados por uma sessão que não estava mais na semana.

**Correção** (`gerarPlanoSemanal`, depois da redução forçada):
- Com a semana aprovada, cada corte de dose ligado durante a correção (`volumeFator`, `semProgressao`) é testado de novo sem ele.
- O teste usa as sessões que realmente ficaram.
- O corte só sai se a semana continuar passando em **todas** as regras (V1–V10) e o treino forte não voltar.
- Cortes que vieram do check-in, da pausa ou de lesão (`ajustesIniciais`) nunca são revistos.
- Cada revisão fica no log como `corte_revisto`.

**Antes/depois (cenário de teste fictício do perfil 20, semana 4):**

| | Rodagens | Longão | Ajustes |
|---|---|---|---|
| Antes da P1 | 24 / 24 min | 33 min | `volumeFator 1` |
| Com P1, sem esta correção | 21 / 21 min | 26 min | `volumeFator 0,81`, `semProgressao` |
| **Agora** | 24 / 24 min | 33 min | `volumeFator 1`, log `corte_revisto` |

**Testes que garantem o comportamento:**
- O volume do perfil 20 na semana 4 é igual com qualquer variante de tiro.
- O corte necessário do perfil 06 na semana 4 **continua** (`volumeFator 0,81`).
- O corte do check-in (`0,9`) não é desfeito.

**Outro efeito da mesma correção (perfil 07) — precisa de decisão:**
- O perfil 07 tinha o mesmo defeito antes da P1. No ciclo 1 o volume passava do limite, o fator de volume reduzia o próprio limite, e a escada cortou sessões até sobrarem 2 corridas.
- Com o corte revisto:
  - S1: o longão vai de 35 para 39 min.
  - S4 (descarga): rodagem de 25 → 38 min e longão de 32 → 45 min. A semana passa a bater exatamente o alvo de descarga da trajetória (83 min).
- **Problema:** o longão da descarga (45 min) fica maior que o da semana 3 (39 min). Nenhuma regra atual limita isso.
- O volume concentra porque a semana ficou com só 2 corridas: a redução forçada tirou sessões por causa do mesmo defeito.
- **Decisão pendente:**
  - (a) aceitar;
  - (b) limitar a sessão mais longa da descarga ao tamanho dela na semana anterior (regra nova);
  - (c) revisar primeiro a redução forçada, que tira sessão quando o problema era o corte em cascata.

### 2.2 Comparativo dos 20 perfis × 8 semanas (antes da P1 → agora)

**Sem mudança:** 13 perfis — 01, 02, 04, 05, 06, 10, 11, 13, 14, 15, 16 (bloqueado), 17 e 18. Isso inclui os de retorno (05, 06) e os de dor (15, 17).

**Com mudança:** 7 perfis.

| Perfil | Origem da mudança | O que muda |
|---|---|---|
| 03, 08, 09 | Correção P1 (rotação de formato) | Tiro/limiar varia por semana. Detalhes no comparativo anterior, seção 2. |
| 07 | Correção P1 + correção 2.1 | Tiro varia. S1: longão 35→39 min. S4: 25/32 → 38/45 min (ver 2.1). |
| 12, 19 | Aviso (P6 informativa) | Sessões iguais; aparece "Sem treino forte nesta semana: no dia em que ele caberia, não sobra tempo junto com a musculação." |
| 20 | Aviso + correção 2.1 | Sessões iguais às de antes da P1; aparece o aviso de distribuição. |

**Planos dourados que mudam:** plano-03, plano-07, plano-08, plano-09, plano-12, plano-19, plano-20 e `motor-checkin-semanal`. São as mesmas 8 falhas conhecidas, esperando aprovação.

### 2.3 Formato × dose do treino forte (proposta, nada implementado)

A P1 hoje só alterna o **formato** (800/1000/1200/600 m). Mas cada formato da lista tem uma **dose** diferente, então a rotação muda a intensidade da semana sem nenhuma regra dizer isso.

Medição: todas as variantes na mesma semana 2, pelo motor real.

| Prova (perfil) | Variante | Repetições/estrutura | km intensos | Duração | Recuperação |
|---|---|---|---|---|---|
| 5k (07) | V1 | 7 × 400 m | 2,8 | 42 min | 9 min |
| | V2 | 5 × 600 m | 3,0 | 42 min | 8 min |
| | V3 | 10 × 300 m (ritmo R) | 3,0 | 44 min | 11,3 min |
| | V4 | 12 × 200 m (ritmo R) | 2,4 | 41 min | 11 min |
| 10k (08) | V1 | 4 × 800 m | 3,2 | 39 min | 6 min |
| | V2 | 4 × 1000 m | 4,0 | 44 min | 7,5 min |
| | V3 | 4 × 1200 m | **4,8** | 50 min | 9 min |
| | V4 | 6 × 600 m | 3,6 | 42 min | 7,5 min |
| 21k (03) | V1 | 21 min contínuos | 4,9 | 41 min | — |
| | V2 | 2 × 2000 m | 4,0 | 39 min | 2 min |
| | V3 | 20 min contínuos | 4,7 | 40 min | — |
| | V4 | 2 × 3000 m | **6,0** | 48 min | 2,5 min |
| 42k (09) | V1/V2 | 2 × 3 km em ritmo de maratona | 6,0 | 51 min | 1 km Z2 |
| | V3 | 3 × 3 km | **9,0** | 70 min | 2 × 1 km Z2 |
| | V4 | 5 km contínuos | 5,0 | 41 min | — |

**Por que os construtores atuais não conseguem igualar a dose:**
- Simulei pedir a mesma dose da V1 a todas as variantes. Não deu:
  - o intervalado tem mínimo de 4 repetições (4 × 1200 m nunca fica abaixo de 4,8 km);
  - os blocos do 21k e do 42k têm número fixo de repetições (o fator de escala não age sobre eles).

**Proposta: variante com dose planejada.**
- A fase define a dose (km intensos ou minutos em Z4/Z5) e a variante define só o formato.
- As repetições são calculadas a partir da dose: `reps = dose ÷ distância do tiro`, com um mínimo por formato (3 para tiros ≥ 1000 m).
- Exemplo na mesma semana, para o 10k com dose de 3,2 km: 4 × 800 m · 3 × 1000 m (3,0) · 3 × 1200 m (3,6) · 5 × 600 m (3,0).
- Recuperação proporcional à duração do tiro, como hoje.
- Aumento de dose só por regra explícita da trajetória, e nunca na descarga.
- **Não implementado:** depende da sua aprovação dos valores de dose por fase.

### 2.4 Descarga: alternativas comparadas na sessão e na semana inteira (nada implementado)

S3 é a semana anterior (referência). Intenso = km em Z3–Z5 da semana.

| Perfil | Alternativa para a S4 | Treino forte da S4 | Semana S4 (corridas · min · intenso · maior sessão) |
|---|---|---|---|
| 08 (S3: 179 min, 4,8 km intensos) | A. atual (variante 4) | 6 × 600 m · 3,6 km (75% da S3) | 4 · 137 min · 3,6 km · 47 min |
| | B. variante da semana 1 | 4 × 800 m · 3,2 km (67%) | 4 · 134 · 3,2 · 47 |
| | C. variante da S3 com 60% da dose | **não conseguiu**: 4 × 1200 m (mínimo de 4 repetições) | 4 · 145 · 4,8 · 50 |
| | D. variante da S4 com 60% da dose | 5 × 600 m · 3,0 km (63%) | 4 · 133 · 3,0 · 47 |
| | E. sem treino forte | — | 4 · 134 · 0 · 47 |
| 03 (S3: 265 min, 4,7 km) | A. atual | 2 × 3000 m · **6,0 km (128%)** | 5 · 235 · 6,0 · 73 |
| | B. semana 1 | 21 min · 4,9 km (**104%**) | 5 · 228 · 4,9 · 73 |
| | C. S3 com 60% | 15 min · 3,5 km (74%) | 5 · 222 · 3,5 · 73 |
| | D. S4 com 60% | **não conseguiu** (blocos fixos) | 5 · 235 · 6,0 · 73 |
| | E. sem treino forte | — | 5 · 237 · 0 · 73 |
| 09 (S3: 362 min, 15 km) | A. atual | 5 km contínuos (56% da sessão da S3) | 5 · 275 · 9,0 · 84 |
| | B. semana 1 | 2 × 3 km · 6 km (67%) | 5 · 285 · 10,0 · 84 |
| | C. S3 com 60% | **não conseguiu** (3 × 3 km fixo) | 5 · 304 · 13,0 · 84 |
| | D. S4 com 60% | 5,5 km | 5 · 277 · 9,5 · 84 |
| | E. sem treino forte | — (o longão mantém o final em ritmo de prova) | 5 · 284 · 4,0 · 84 |
| 07 | Todas as alternativas | Na S4 atual o tiro já não fica: a semana tem 2 corridas (ver 2.1) | A/B: 2 · 83 min · maior **45**. C/D: 3 · 86–88 min. E: 4 · 83 · 29 min |

**Conclusões:**
- **A variante da semana 1 (B) não garante redução:** no perfil 03 ela mantém 104% da dose da S3.
- Reduzir a dose só funciona com o construtor obedecendo a uma dose planejada (2.3). Hoje C e D falham em metade dos casos.
- A semana inteira importa:
  - E (sem treino forte) é a única que garante queda de intensidade em todos os perfis.
  - No 07, só E mantém 4 corridas curtas, com a maior sessão de 29 min.
- **Recomendação para decisão:** na descarga, usar a dose planejada (2.3) com 50–60% da dose da semana anterior e o formato mais curto da lista. Para iniciante, retorno e perfis com 2–3 corridas, sem treino forte (E).
- **Aguarda aprovação:** nada foi mudado na descarga.

### 2.5 Trote/caminhada (tratado à parte)

**Correção da conclusão anterior.**
- A falta de progressão do trote/caminhada **não** vem do `weekNumber`.
- O `runWalk` (minutos de trote e de caminhada) é calculado uma vez a partir do perfil (`motor-v2.js:312–322`) e repetido em todas as semanas.
- A P1 não muda isso. O teste confirma que o perfil 05 continua em trote/caminhada.

**O que sai hoje** (8 semanas):

| Perfil | Estrutura fixa | Como o volume muda |
|---|---|---|
| 01, 02, 14 (iniciantes) | 1' trote + 2' caminhada | Só o número de ciclos: 7 → 10 no longão; na descarga 6 e 4 |
| 04 (corrida iniciante) | 1' + 2' | 5 → 8 ciclos |
| 05 (retorno curto) | 3' + 1' | **Idêntico nas 8 semanas, descarga incluída** (31/39/35 min) |
| 06 (retorno longo) | 3' + 1' | 3 → 7 ciclos. A S8 (descarga) tem 93 min, contra 101 min na S7 |

**Proposta: progressão por desempenho e recuperação, não pelo calendário.**
- **Evidência para avançar um degrau** (ex.: 1'+2' → 2'+1' → 3'+1' → 5'+1' → 8'+1' → contínuo):
  - as 2 últimas sessões de trote/caminhada concluídas inteiras (etapas executadas no GPS/esteira, não só "marcadas");
  - esforço registrado ≤ 6;
  - check-in da semana sem dor e com fadiga ≤ 3.
- **Sem evidência** (sem registro ou sem check-in): mantém o degrau. A passagem do tempo não conta.
- **Recuar um degrau:** dor relatada, fadiga ≥ 4 ou sessão interrompida.
- **Descarga:** mesmo degrau com menos ciclos (hoje o perfil 05 não tem descarga nenhuma).
- O teto de minutos por sessão e as regras de dias não consecutivos continuam iguais.
- **Exige validação profissional:** os degraus e os limites de esforço são prescrição.

### 2.6 Musculação: progressão preservada, três pontos analisados

A sugestão de carga (`suggestedForExercise`) e o histórico por exercício **não foram alterados**.

A simulação de 8 sessões (perfil 08) mostrou:
- carga subindo 2,5% por sessão quando a meta é batida;
- carga parada quando estagna;
- −10% por sessão quando o esforço vem alto.

Exercícios iguais entre semanas **são o que permite** essa progressão, porque o histórico é por exercício. Por isso P7 e P8, como estavam escritas, ficam descartadas.

| Ponto | É bug? | Por quê | Resposta proposta (com base em registros e check-in) |
|---|---|---|---|
| **Estagnação persistente** (`quase_la` sessão após sessão) | Não | A regra faz o que diz. Falta uma resposta para estagnação, e isso é prescrição. | Detectar 3 sessões seguidas do mesmo exercício sem subir carga nem repetições. Mostrar a informação e oferecer opções que a pessoa escolhe: manter, trocar por variação do mesmo padrão (levando a carga de referência) ou outra faixa de repetições. Nada automático. **Precisa de validação profissional.** |
| **Reduções sucessivas** (−10% a cada sessão com esforço ≥ 9 ou repetições < 80%) | Não (regra) | A regra reage à sessão isolada e não olha a sequência nem o check-in. | Depois de 2 reduções seguidas no mesmo exercício, não reduzir de novo sem antes perguntar sobre sono, dor e fadiga (ou cruzar com o check-in). Com dor, seguir o fluxo de lesões existente. Sem piso de carga inventado. **Precisa de validação profissional.** |
| **Carga sobe na descarga** | **Em parte, sim** | O motor antigo (V1) reduzia o volume de musculação na semana 4 (`muscF × 0,75`, `buildHybridProgressionFactors`). O V2 perdeu isso: `muscSeriesFator` só existe na calibração. A sugestão de carga nunca olhou a fase. | Bug a restaurar com aprovação: na descarga, o fator de séries que o V1 já tinha. Regra nova (validação): na semana de descarga, a sugestão mantém a carga em vez de subir. |

---

## 3. Parte 2 — Estrelas dos exercícios

**O que eram:** favoritos da Biblioteca. Havia uma estrela sobre o GIF de cada cartão da lista e um botão-estrela no detalhe, em dourado, fora do padrão monocromático.

**O que foi feito:**
- Estrela removida da lista e do detalhe. Nenhum outro selo no lugar.
- Favoritar/remover agora fica no **menu de três pontos**:
  - no detalhe da Biblioteca (botão ⋯ cinza no lugar da estrela);
  - no menu ⋯ do exercício na aba Treino (item "Adicionar aos favoritos" / "Remover dos favoritos").
- O filtro "Favoritos" da Biblioteca continua funcionando.
- **Favoritos salvos preservados:** mesma chave `favoritos`, mesmos nomes.
- Nomes, GIFs, músculos, séries, repetições e cargas não mudaram.

**Alinhamento:** em 320 px os cartões da Biblioteca tinham colunas de larguras diferentes (um nome longo alargava a coluna), e os nomes ficavam desnivelados. Agora as duas colunas têm a mesma largura (`minmax(0, 1fr)`).

**Prints:** `scratchpad/shots/antes-biblioteca-*`, `depois-biblioteca-*`, `depois-bibdetalhe-*`, `depois-bibmenu-*`, `depois-exmenu-*`.

## 4. Parte 3 — Foto do perfil

**O que havia:** o fluxo de foto existia só na tela antiga de Perfil (`fotoOptions` + `drawerFotoInput`). O avatar do Perfil novo (arte 04) não tinha ação.

**O que foi feito:**
- O avatar virou botão e abre a folha "Foto do perfil" com: **Escolher da galeria**, **Tirar foto**, **Remover foto** (só quando há foto, com confirmação) e **Cancelar**.
- O recorte e o armazenamento são os mesmos do fluxo antigo: `readAndResizeImage` 160 px e `state.perfil.foto` via `savePerfil`. Fotos já salvas continuam.

**Casos tratados:**

| Situação | Comportamento |
|---|---|
| Cancelar a folha | Nada muda |
| Cancelar a escolha do arquivo | Nada muda |
| Arquivo inválido ou falha de leitura | Aviso "Não consegui carregar essa foto"; a foto atual fica |
| "Tirar foto" | Usa `capture="user"` (câmera frontal) |
| Câmera ou galeria negada | O iOS não entrega arquivo e nada muda. Permissões já declaradas no workflow (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) |

**Teste de navegador:** a foto continua depois de fechar e reabrir o app.

**Pendente no iPhone:** câmera, galeria e permissões.

**Prints:** `depois-fotosheet-*`, `depois-fotoperfil-*`.

## 5. Parte 4 — Artes de compartilhamento

**Referências:**
- `FORZA-RUN-REVISAO-COMPLETA-REFERENCIAS/03-COMPARTILHAMENTO` (seletores aprovados de corrida e musculação);
- `NOVA-06` (galeria transparente).

**Método de conferência:**
- PNG exportado pela própria função do app, com dados fictícios;
- prancha lado a lado com a referência;
- medidas tiradas da referência com grade e convertidas (cartão de 320 px = 1080 px).

**O que já estava correto e não mudou:**
- Transparência real: canal alfa verdadeiro, canto com alfa 0, nenhum quadriculado gravado.
- Logo oficial: vetor da `LOGO-OFICIAL` na galeria, palavra "FORZA RUN" no seletor aprovado.
- Dados vindos da atividade.
- Sem GPS, nenhuma arte com rota (esteira: Recibo, Métricas laterais, Tabela, Métricas, Etiquetas, Números).
- "Ocultar início e fim" corta 200 m das coordenadas antes de desenhar.
- Composições e modelos: nenhum modelo novo.

**O que foi corrigido (só escala, posição, espaçamento e margens):**

| Arte | Antes | Agora (pela referência) |
|---|---|---|
| Recibo | Caixa 380 × 470, marca 70, dia 60 px | Caixa 655 × 802, marca 187, tênis/halter 225/190, dia 108, data 52 px |
| Métricas laterais (+ rota) | Pares "rótulo valor" de 26–30 px em uma linha | Rótulo e valor em duas colunas giradas (46/60 px), de baixo para cima a partir do Ritmo; marca 167 px; rota na caixa da referência |
| Tabela | 30 px, linhas a cada 56 px, marca 80 | 43 px, linhas a cada 65,5 px, marca 137, pontilhado proporcional |
| Rota e tabela | Rota estreita no topo | Rota centralizada até a marca; tabela 40 px a 101 px da margem |
| Métricas empilhadas | Rótulo 34, valor 64, marca 80 | Rótulo 43, valor 71, marca 189, bloco centralizado |
| Etiquetas | Pílulas de 72 px, texto 30 px, tudo em maiúsculas | Pílulas de 138 px, texto 40 px, rótulo em maiúsculas e valor com a unidade original (ex.: "DISTÂNCIA 5,03 km"); 3 linhas como na referência |
| Tempo (musculação) | Rótulo 40, valor 96, halter 180, marca 96 | Rótulo 71, valor 135, halter 300, marca 181 |
| Seletor: Trajeto / Números / Parciais | Logo 46–50, rótulos 36–40, barras de 30 px | Logo 56–58, rótulos 44–48, espaçamento dos números 290; barras de 50 px e números 42 px |
| Seletor: Músculos / Treino / Data / Concluído | Boneco 1120, halter 300, calendário 560 × 520, título espaçado 40 px | Boneco 1230, halter 360, calendário 630 × 700, título 54 px; textos e subtítulos nas alturas da referência |
| Galeria (tela) | Marcador de seleção embaixo à direita, cobrindo o "Ritmo" | Marcador em cima à direita, como no seletor aprovado de corrida |

**O formato quadrado** usa as mesmas composições, reduzidas (z = 0,7–0,85). Nas métricas laterais, o quadrado mostra só Ritmo, Distância e Tempo para caber.

**Arquivos exportados** (`ARTES-EXPORTADAS-FICTICIAS-2026-10-08/`, todos com `FICTICIO` no nome):
- Corrida story: Recibo, Métricas laterais, Rota e métricas laterais, Tabela, Rota e tabela, Métricas, Métricas e rota, Etiquetas, Rota e métricas, Trajeto, Números, Parciais.
- Corrida quadrado: Recibo, Métricas laterais, Rota e métricas laterais, Tabela.
- Corrida com privacidade (início e fim ocultos): Rota e tabela.
- Corrida com texto escuro: Tabela, Métricas.
- Musculação story: Recibo, Tempo, Etiquetas, Músculos, Treino, Data, Concluído.

**Pranchas de comparação** (scratchpad):
- `prancha-antes.png`, `prancha-depois.png`, `prancha-final.png` (NOVA-06);
- `prancha2-antes-1/2.png`, `prancha2-depois-1/2.png` (seletores aprovados);
- `grade-quadrado.png`.

**Diferenças que permanecem:**
- O ícone de tênis do app é o desenho atual (tênis de perfil), não o tênis inclinado da NOVA-06. Trocar seria um desenho novo.
- O seletor aprovado de musculação mostra a palavra "FORZARUN" em itálico; o app usa "FORZA RUN" (pesado + leve).
- A arte **Mapa** não foi gerada no teste: precisa da internet para o mapa de ruas. Conferir no aparelho.

---

## 6. Testes

- **Novos, passando:**
  - `semana-do-plano` — 30;
  - `favoritos-foto-perfil` — 17;
  - `artes-escala` — 7.
- **Suíte completa:** resultado na seção 7.
- **Falhas conhecidas e não aprovadas:** os planos dourados do item 2.2. Não foram atualizados para os testes passarem.

## 7. Resultado da suíte completa

`node tests/run.js`, com testes em Node e no navegador: **588 verificações ok · 8 falhas · 236 s**.

**Nenhuma falha nova.** As 8 falhas são todas diferenças de planos dourados já conhecidas e ainda não aprovadas:
- plano-03, plano-07, plano-08, plano-09, plano-12, plano-19 e plano-20;
- `motor-checkin-semanal`.

## 8. Pendências

**iPhone:**
- câmera e galeria da foto do perfil, incluindo permissões;
- arte Mapa com internet;
- salvar e compartilhar os PNGs nas Fotos/Instagram;
- favoritos pelo menu de três pontos;
- todos os fluxos das rodadas anteriores.

**Decisões do motor:**
1. Planos dourados (2.2).
2. Descarga do perfil 07 (2.1).
3. Dose planejada (2.3).
4. Regra de descarga (2.4).
5. Progressão do trote/caminhada (2.5).
6. Respostas da musculação (2.6), incluindo restaurar o fator de séries da descarga do V1.
