# Questionário / Onboarding v2 — VERSÃO FINAL (CONGELADA)

**Status: CONGELADO.** Não há mais revisões estruturais do questionário. O próximo trabalho é o motor que transforma o `athleteProfile` em primeiro treino/plano. **Nada foi implementado ainda** (nem telas, nem código, nem alterações no `athleteProfile`).

**Decisões que valem para toda a versão**
- Só "os dois" (corrida + musculação). Modalidade única fica para o motor novo.
- 5 km é fallback técnico do gerador legado; nunca aparece como objetivo do atleta.
- Camada 1 só tem perguntas com função clara em segurança, primeiro plano ou motor novo.
- Nível não é perguntado, exibido nem editado: é derivado internamente.

**Legenda de função:** **Seg** = segurança · **1º plano** = entra no gerador atual via `toLegacyDraft` ou na derivação do nível · **Motor** = estrutura do perfil já criada.

---

## 1. Fluxo final

```
Boas-vindas
 → Objetivo (Q1–Q3)
 → Corrida (Q4–Q10)
 → Musculação (Q11–Q16)
 → Sua semana (Q17–Q18)
 → Restrições e segurança (Q19–Q22)
 → Sono (Q23)
 → "O que entendi"
 → [Fluxo de cautela — só se houver sinal de alerta]
 → Primeiro plano (gerador atual, via toLegacyDraft)
        ↓ depois, sem bloquear
   Camada 2: "Completar perfil"        Camada 3: coleta passiva pelo uso
```

- Uma pergunta por tela; perguntas relacionadas agrupadas (Q5–Q7, Q12–Q13, Q20–Q21). **9 a 15 telas.**
- Modalidades: sempre corrida + musculação (`objetivos.modalidadesNoPlano` com valor padrão fixo, não perguntado).

---

## 2. Camada 1 — perguntas

**"Não sei"** existe como opção explícita em todas as perguntas de fato: Q5, Q6, Q7, Q8, Q10, Q12, Q13, Q15, Q23 (e "varia" em Q17, "não tenho" em Q9).

| # | Pergunta e opções | Aparece quando | Campo(s) | Função |
|---|---|---|---|---|
| Q1 | **Objetivo principal:** correr uma prova · melhorar na corrida (sem prova) · ganhar massa · ganhar força · emagrecer · saúde e condicionamento · voltar à rotina após pausa | sempre | `objetivos.principal.tipo` | 1º plano |
| Q2 | **Prova:** distância (5 / 10 / 21 / 42 km) e data ("ainda sem data") | Q1 = prova | `objetivos.distanciaAlvoKm`, `objetivos.prova.data` | 1º plano |
| Q3 | **Distância de referência** (5 / 10 / 21 / 42 km, ou "sem preferência") | Q1 = melhorar na corrida | `objetivos.distanciaAlvoKm` | 1º plano |
| Q4 | **Você corre hoje?** regularmente · de vez em quando · já corri e parei · nunca corri | sempre | `estadoAtual.corrida.situacao` | 1º plano |
| Q5 | **Há quanto tempo corre regularmente?** (parado: "por quanto tempo correu antes de parar?") menos de 3 meses · 3–6 meses · 6–12 meses · 1–3 anos · mais de 3 anos · **não sei** | Q4 ≠ nunca | `historico.corrida.experienciaFaixa` | 1º plano |
| Q6 | **Vezes por semana nas últimas 4 semanas:** 1 a 7 · **não sei** | regularmente ou de vez em quando | `estadoAtual.corrida.carga.declarada.frequenciaSemana` | 1º plano |
| Q7 | **Maior corrida dos últimos 30 dias:** km ou minutos · não sei | ativo | `carga.declarada.maiorSessaoRecenteKm` ou `.maiorSessaoRecenteMin` | 1º plano |
| Q8 | **Quanto tempo corre sem parar?** menos de 5 min · 5–10 · 10–20 · 20–30 · 30–60 · mais de 60 · **não sei** | de vez em quando, ou Q7 = "não sei" | `estadoAtual.corrida.corridaContinuaFaixa` | 1º plano |
| Q9 | **Prova ou teste nos últimos 3 meses:** distância (1600 m / 3 km / 5 km / 10 km), tempo mm:ss, data, se foi prova ou treino; ou "não tenho" | ativo **e** Q1 ∈ {prova, melhorar na corrida} | `estadoAtual.corrida.ultimoDesempenho.*` (VDOT pela conta atual) | 1º plano |
| Q10 | **Há quanto tempo está sem correr?** menos de 1 mês · 1–3 meses · 3–6 · 6–12 · mais de 1 ano · **não sei** | Q4 = já corri e parei | `estadoAtual.corrida.semanasSemTreinoFaixa` | 1º plano |
| Q11 | **Você treina musculação hoje?** regularmente · às vezes · já treinei e parei · nunca | sempre | `estadoAtual.musculacao.situacao` | 1º plano |
| Q12 | **Há quanto tempo treina de forma consistente?** (parado: "por quanto tempo treinou?") mesmas faixas de Q5 · **não sei** | Q11 ≠ nunca | `historico.musculacao.experienciaFaixa` | 1º plano |
| Q13 | **Dias por semana nas últimas semanas:** 1 a 7 · **não sei** | regularmente ou às vezes | `estadoAtual.musculacao.carga.declarada.frequenciaSemana` | 1º plano |
| Q14 | **Movimentos que faz (fazia) com segurança** (múltipla): agachamento livre · terra/stiff · supino livre · barra fixa/puxada · remada livre · afundo/unilateral · desenvolvimento · nenhum | Q11 ≠ nunca | `historico.musculacao.padroesDominados` | 1º plano |
| Q15 | **Há quanto tempo está sem treinar?** mesmas faixas de Q10 · **não sei** | Q11 = já treinei e parei | `estadoAtual.musculacao.semanasSemTreinoFaixa` | 1º plano |
| Q16 | **Onde treina musculação?** academia · condomínio · casa com halteres · casa sem equipamento | sempre; pula se Equipamentos já está configurado | `equipamentos.local` + `equipamentos.itens.halteres` | 1º plano |
| Q17 | **Dias e minutos:** 7 linhas (liga/desliga + minutos; "varia" = sem minutos) | sempre | `disponibilidade.dias[d].disponivel`, `.minutos` | 1º plano + Motor |
| Q18 | **Corrida e musculação no mesmo dia?** prefiro separar · separo mas combino se precisar · prefiro combinar · tanto faz | sempre | `disponibilidade.combinacao.preferencia` | Motor (preferência) |
| Q19 | **Tem dor ou lesão que atrapalhe o treino agora?** sim / não | sempre | gate (cria `restricoesTreino.dorAtual`) | Seg + 1º plano |
| Q20 | **Onde?** regiões (múltipla) | Q19 = sim | `restricoesTreino.dorAtual[].regiao` | Seg + 1º plano |
| Q21 | **Intensidade** (leve / moderada / forte) e **"também dói em repouso?"** (sim / não) | Q19 = sim | `dorAtual[].intensidade`, `.emRepouso` | Seg |
| Q22 | **Marque se se aplica:** dor no peito, tontura forte ou falta de ar incomum ao se esforçar · gestação ou pós-parto recente · cirurgia recente · um profissional de saúde já me orientou a limitar esforço ou impacto · nenhuma | sempre | `sinaisDeAlerta.itens[]` | Seg |
| Q22b | **O que foi orientado?** (evitar impacto, esforço intenso, peso acima da cabeça, outro) | Q22 marcou "profissional me orientou" | `restricoesTreino.vindasDeOrientacao[]` | Seg |
| Q23 | **Sono:** menos de 6 h · 6 a 7 h · 7 h ou mais · **não sei** | sempre | `recuperacaoHabitual.sono` | Motor |

---

## 3. Camada 2 — completar perfil

Não bloqueia o primeiro plano. Aparece na tela "Completar meu perfil" e em momentos oportunos.

| Grupo | Perguntas | Campos |
|---|---|---|
| Identidade | Nome; data de nascimento (ou idade); sexo; peso; altura | `identidade.*` (o app usa o nome do login quando existir) |
| Objetivo | Objetivo secundário; modalidade prioritária (pré-preenchida pelo principal); tempo-alvo; meta corporal; ritmo de progresso | `objetivos.secundario`, `.modalidadePrioritaria`, `.prova.tempoAlvoSeg`, `.corpo`, `.ritmoProgresso` |
| Corrida | Tamanho típico da sessão; rotina de antes de parar; melhor resultado que lembra; tipos de treino já feitos; provas concluídas; pace confortável; FC máxima e de repouso; onde corre; relógio/GPS e monitor de FC | `carga.declarada.distanciaTipicaKm/duracaoTipicaMin`, `historico.corrida.*`, `estadoAtual.corrida.paceConfortavelSeg`, `historico.corrida.fcMax`, `recuperacaoHabitual.fcRepouso`, `preferencias.corrida.terreno`, `equipamentos.relogioGPS/monitorFC` |
| Musculação | Como treina hoje; cargas conhecidas ou testes de força; divisão preferida; ênfase | `historico.musculacao.tipoProgramacao/forcaConhecida`, `preferencias.split`, `preferencias.enfase` |
| Semana | Períodos e horário por dia; preferência de modalidade por dia; "prefiro descansar" / "não posso"; ordem ao combinar; dia preferido do longão | `dias[d].periodos/horario/preferencia/restricao`, `combinacao.ordem`, `diaLongaoPreferido` |
| Recuperação | Estresse; trabalho; qualidade do sono; fadiga habitual; alimentação | `recuperacaoHabitual.*` |
| Ambiente | Itens de equipamento; halter máximo; esteira | `equipamentos.*` |
| Restrições | Quando a dor aparece (gatilhos); lesões dos últimos 12 meses; exercícios a evitar; restrição de impacto | `dorAtual[].gatilhos`, `restricoesTreino.historicoRelevante/evitar*/restricaoImpacto` |
| Preferências | Tipos de corrida que gosta ou evita; exercícios favoritos ou evitados; variedade; duração preferida; mobilidade/core | `preferencias.*` |

---

## 4. Camada 3 — aprendido pelo uso (nunca vira pergunta de onboarding)

| Dado | Fonte | Campo |
|---|---|---|
| Treinos realizados e pulados | contagem semanal (pulados: novo) | `estadoAtual.aderencia.*` |
| Distância, ritmo, maior sessão e frequência reais de corrida | `corridaProgress` | `carga.observada` (substitui Q6–Q7) |
| Cargas, repetições, séries, volume por grupo | `historicoCarga` | `carga.observada` (musculação) |
| Tempo sem treinar (do último registro) | registros de treino | `semanasSemTreino` (o observado vence a faixa) |
| RPE/PSE e dificuldade percebida | existe | `respostaAosTreinos` |
| Sono, fadiga, dor, energia atual | check-in semanal e DOMS | `estadoAtual.recuperacao`, `dorAtual` |
| FC | integração (se houver) | prontidão e zonas |
| Exercícios trocados ou pulados; horário real | marca de troca (pulados e horário: novos) | preferências e disponibilidade real |

**Regra:** dado `observado` vence dado `informado`.

---

## 5. Condicionais

| # | Regra |
|---|---|
| R1 | **Situação.** *Ativo* = "regularmente" ou "de vez em quando". Ativo pergunta carga recente; parado pergunta tempo parado; nunca pula experiência, carga e tempo parado. |
| R2 | **Distância.** Q2 só se Q1 = prova; Q3 só se Q1 = melhorar na corrida. Nos demais objetivos não há pergunta de distância (o legado usa o fallback técnico de 5 km, invisível). |
| R3 | Q5 vale para regular, ocasional e parado; "nunca" pula. |
| R4 | Q8 só se ocasional ou Q7 = "não sei". Q9 só se ativo **e** Q1 ∈ {prova, melhorar na corrida}. Q10 só se parado. |
| R5 | Q12 e Q14 valem para regular, ocasional e parado; Q13 só se ativo; Q15 só se parado. "Nunca treinou" pula Q12–Q15. |
| R6 | Q16 pula se Equipamentos já está configurado. |
| R7 | Q20–Q21 só se Q19 = sim. Intensidade **forte** ou "dói em repouso = sim" cria o sinal de alerta `dor_forte_ou_em_repouso`. |
| R8 | Q22b só se Q22 marcou "profissional me orientou". Qualquer sinal de alerta aciona o fluxo de cautela **antes** do plano. |
| R9 | **Não repetir pergunta.** A unidade é o **campo**: só pergunta o ausente, expirado, estimado por inferência ou migrado de baixa confiança. Dado `informado`/`observado` válido nunca é reperguntado. |
| R10 | **"Não sei"** grava estimativa conservadora **e** marca o campo como respondido (`naoSei`). Não é reperguntado. Na regra de nível, o eixo com "não sei" é ignorado. |
| R11 | Usuário existente: modo atualização (só campos pendentes, R9). Nenhum plano novo é gerado por causa do questionário. |

---

## 6. Campos do `athleteProfile` envolvidos

**Preenchidos pela Camada 1**
```js
objetivos.principal.tipo · objetivos.distanciaAlvoKm · objetivos.prova.data
historico.corrida.experienciaFaixa · historico.musculacao.experienciaFaixa · historico.musculacao.padroesDominados
estadoAtual.corrida.{ situacao, corridaContinuaFaixa, semanasSemTreinoFaixa, ultimoDesempenho,
                       carga.declarada.{ frequenciaSemana, maiorSessaoRecenteKm, maiorSessaoRecenteMin } }
estadoAtual.musculacao.{ situacao, semanasSemTreinoFaixa, carga.declarada.frequenciaSemana }
equipamentos.local · equipamentos.itens.halteres
disponibilidade.dias[d].{ disponivel, minutos } · disponibilidade.combinacao.preferencia
restricoesTreino.dorAtual[] { regiao, intensidade, emRepouso } · restricoesTreino.vindasDeOrientacao[]
sinaisDeAlerta = { itens[], cautela:{ estado, registradoEm } }
recuperacaoHabitual.sono
```

**Derivados (calculados, nunca perguntados)**
- Semanas sem treino e experiência em meses (das faixas; o observado vence).
- `carga.volumeEstimado` (só se a Camada 2 trouxer sessão típica) e `carga.referencia`.
- `disponibilidade.derivado` (dias, minutos semanais, maior e menor janela, média, sequências, dias isolados, candidatos a longão — candidatos, não decisão).
- `objetivos.modalidadePrioritaria` (do objetivo principal, até a Camada 2).
- `avaliacao.*` e **`avaliacao.compat`** (`nivelCorrida`, `nivelMusc`, VDOT padrão; temporários, internos, invisíveis).
- `calibracao.ativa` e motivos; lacunas e confiança; estado inicial da cautela.

**Convenções:** `*Faixa` guarda a escolha informada; o campo numérico correspondente é derivado. `naoSei` marca a resposta "não sei". `estadoAtual.recuperacao` guarda só o estado de agora; o habitual fica em `recuperacaoHabitual`.

---

## 7. Migração necessária

### 7.1 Esquema 3 → 4 (campos já implementados que mudam)

| Campo atual | Destino |
|---|---|
| `estadoAtual.corrida.cargaRecente.*` | `estadoAtual.corrida.carga.declarada.*` |
| `estadoAtual.musculacao.cargaRecente.frequenciaSemana` / `volumePorGrupo` | `carga.declarada.frequenciaSemana` / `carga.observada.volumePorGrupo` |
| `estadoAtual.recuperacao.sono`, `.estresse` | `recuperacaoHabitual.sono`, `.estresse` |
| `estadoAtual.limitacoesAtivas[]` | `restricoesTreino.dorAtual[]` |
| `estadoAtual.limitacoesTexto` | lido para extrair regiões; texto original em `restricoesTreino.textoLegado` (somente leitura) |
| `saude.restricaoImpacto` / `saude.triagem` | `restricoesTreino.restricaoImpacto` / `sinaisDeAlerta.itens` (nenhuma tela preenchia a triagem) |
| `restricoesDuras.*` | `restricoesTreino.evitarPadroes/evitarExercicios` |
| `historico.*.lesoes` | `restricoesTreino.historicoRelevante` |
| `objetivos.prova.distanciaKm` | `objetivos.distanciaAlvoKm` (fonte única; se ambos existirem, vale `distanciaAlvoKm`) |
| `objetivos.duracaoPlanoSemanas` | derivado (legado) |
| `equipamentos.material` | `equipamentos.local` + `itens.halteres` (academia → academia; halteres → casa + halteres; corpo → casa sem halteres); `material` vira derivado |
| `disponibilidade.sessaoMaxMin.musculacao` | permanece como valor migrado usado no fallback de `tempoMaxMin` |
| `avaliacao.historica.*.resumo` | removido (o compat usa `avaliacao.compat`) |
| `historico.*.autoavaliacao` | só fonte de migração, último recurso; nunca perguntado nem exibido |
| `metaSessoes`, `eventos`, `preferencias.gosto` | ficam sem uso, sem remoção |

Depois de convertido, o campo antigo é apagado. A conversão roda ao carregar o perfil, sem perda de dados.

### 7.2 Usuários existentes
- Estado migrado entra **vencido** e é reperguntado (R9).
- Dias só estimados ou sem minutos fazem Q17 aparecer.
- Objetivo, distância e equipamento já migrados com confiança suficiente **não** são reperguntados.
- Se já há região de dor, só falta Q21.
- Sempre pendentes: Q4–Q15 (situação e carga, novos), Q22 e Q23.
- Nenhum plano é gerado ou regenerado por causa do questionário.

---

## 8. Compatibilidade com o gerador atual

O gerador continua recebendo o mesmo `hybridDraft`, produzido por `toLegacyDraft(perfil)`.

### 8.1 Nível (`nivelCorrida`, `nivelMusc`) — regra fechada
Ordem de precedência: **situação atual > carga recente > histórico de experiência.** Sem score. As faixas abaixo são provisórias (ajustáveis na calibração); a estrutura da regra é fixa. Eixos com "não sei" são ignorados; sem nenhum eixo utilizável → **iniciante** (pouca evidência = conservador).

**Corrida**
1. **Situação (Q4):**
   - nunca corri → **iniciante**.
   - de vez em quando → **iniciante**.
   - já corri e parei: parado **6 meses ou mais** (ou "não sei") → **iniciante**; parado **1 a 6 meses** → no máximo intermediário; parado **menos de 1 mês** → sem teto. O nível-base vem do passo 3.
   - regularmente → o nível-base vem do passo 2.
2. **Carga (só quem corre regularmente)** — vale o **mais baixo** entre os eixos informados:
   - frequência (Q6): 1–2 → iniciante · 3–4 → intermediário · 5–7 → avançado.
   - maior corrida (Q7): até 5 km ou 30 min → iniciante · até 12 km ou 75 min → intermediário · acima → avançado.
   - corrida contínua (Q8, se perguntada): até 20 min → iniciante · 20 a 60 min → intermediário · mais de 60 min → avançado.
3. **Histórico (Q5):** menos de 3 meses → iniciante · 3 meses a 1 ano → intermediário · mais de 1 ano → avançado.
   - Para quem corre regularmente, o histórico é só **limite superior**: nível = mínimo(carga, histórico).
   - Para o parado, o histórico é a **base**: nível = mínimo(histórico, teto da parada).

**Musculação** (mesma lógica)
1. **Situação (Q11):** nunca → **iniciante** · às vezes → **iniciante** · já treinei e parei: 6 meses ou mais (ou "não sei") → **iniciante**; 1 a 6 meses → no máximo intermediário; menos de 1 mês → sem teto · regularmente → base pela carga.
2. **Carga (regularmente):** frequência (Q13): 1–2 → iniciante · 3–4 → intermediário · 5–7 → avançado.
3. **Histórico:** o **mais baixo** entre experiência (Q12, mesmas faixas) e movimentos seguros (Q14: 0–2 → iniciante · 3–5 → intermediário · 6–7 → avançado). Limite superior para quem treina regularmente; base para o parado.

*Q9 (desempenho recente) não entra no nível; só define o VDOT.* O nível derivado é interno e nunca é exibido ou editável.

### 8.2 VDOT — regra fechada
- **Existe teste ou desempenho válido** (Q9 respondida, dentro dos últimos 3 meses): usa o resultado (mesma conta atual: 1600 m, 3 km, 5 km, 10 km).
- **Não existe** (não respondeu, "não tenho", não perguntado, fora da validade): **VDOT padrão do nível** — iniciante 30 · intermediário 40 · avançado 50. Calculado internamente, sem pergunta e fornecido pela camada de compatibilidade (não pelo botão do quiz antigo).
- **Exceção:** com "seguir por conta própria" após um alerta (8.6), usa o VDOT padrão de iniciante.

### 8.3 `tempoMaxMin` — regra fechada
1. Primeiro a distribuição das modalidades pelos dias é definida (mesma função de distribuição do gerador atual, sobre os dias disponíveis).
2. Entre os dias destinados à **musculação**, `tempoMaxMin` = a **maior janela** com minutos conhecidos.
3. Sem minutos conhecidos nesses dias → fallback: valor migrado, senão 60.

### 8.4 `mesmoDia` — regra fechada
Q18 é **só preferência**, guardada em `combinacao.preferencia`. Nenhuma das quatro opções coloca as duas modalidades em todos os dias: `mesmoDia` é sempre `false` no gerador legado. Quando e onde combinar é decisão do motor novo.

### 8.5 `weeksChoice` — regra fechada
- **Com prova e data:** semanas até a prova → maior opção do gerador legado que caiba (**16, 12 ou 8**); se nem 8 couberem, usa 8.
- **Sem prova ou "ainda sem data":** 8.

### 8.6 Alertas — comportamento fechado
| Resposta | Efeito |
|---|---|
| **Já fui liberado(a)** | Continua. Registra as limitações (`vindasDeOrientacao`) → `liberado` ou `liberado_com_restricoes`. Geração normal com as restrições. |
| **Vou procurar avaliação** | Estado `em_andamento`: **o primeiro plano não é gerado**. Ao voltar, a pessoa vê a tela de cautela de novo e pode mudar a resposta. |
| **Prefiro continuar assim mesmo** | Registra `seguir_por_conta_propria` com reconhecimento explícito. **Não é liberação médica.** Geração **conservadora**: nível iniciante nas duas modalidades e VDOT padrão de iniciante. |

O item "profissional me orientou" entra pela primeira opção (coleta as orientações em Q22b). O app não faz diagnóstico.

### 8.7 Carga declarada disponível para o primeiro plano
Ficam disponíveis, sem nova pergunta: frequência de corrida (Q6), maior sessão recente (Q7), tempo parado (Q10/Q15, faixa e derivado) e frequência de musculação (Q13). Na fase de compatibilidade entram **só** na regra de nível (8.1) e em `corridaCurrentLong`. O motor novo poderá usá-los para evitar regressões e saltos absurdos.

### 8.8 Campo a campo

| Campo legado | Origem | Sem dado |
|---|---|---|
| `nivelCorrida`, `nivelMusc` | regra 8.1 | iniciante |
| `objetivo` | Q1: prova→prova · melhorar na corrida→performance · massa e força→massa · emagrecer→emagrecer · saúde e voltar à rotina→saúde | `massa` |
| `corridaGoal` | `objetivos.distanciaAlvoKm` | 5 km (fallback técnico, invisível) |
| `corridaCurrentLong` | Q7 em km | vazio (minutos não são convertidos) |
| `availableDays` | dias efetivamente disponíveis em Q17 | Seg–Sex |
| `mesmoDia` | sempre `false` (8.4) | `false` |
| `tempoMaxMin` | regra 8.3 | 60 |
| `lesao` | nomes das regiões de `dorAtual` (o gerador só reconhece 6) | vazio |
| `equip` | Q16: academia e condomínio → `academia`; casa com halteres → `halteres`; casa sem equipamento → `corpo` | `academia` |
| `weeksChoice` | regra 8.5 | 8 |
| VDOT | regra 8.2 | padrão do nível |
| `temRelogio`, `localCorrida` | Camada 2, se respondidas | não definidos |
| `muscFreqChoice` | não fornecido | — |

### 8.9 Deliberadamente para o MOTOR (não resolvido por perguntas)
Distribuição das sessões por modalidade e frequência de musculação · uso da carga recente além da regra de nível · escolha do longão (a maior janela é só candidata) · limite de minutos da corrida · plano com um único dia disponível (o gerador atual entrega uma só modalidade) · restrições por padrão de movimento e por impacto · equipamento além dos 3 grupos · progressão · polimento/taper · adaptação e calibração · quando combinar corrida e musculação no mesmo dia.

---

## 9. Tela "O que entendi"

Linguagem natural, **sem nível, sem score e sem botão para corrigir nível**. Cada frase leva à resposta original (corrige o **fato**). Omite o que não se aplica; dado "não sei" não vira frase.

- **Corrida, parado:** "Você correu por cerca de *[experiência]* e está sem correr há *[tempo]*. Vamos retomar aos poucos."
- **Corrida, ativo:** "Você corre *[N]* vezes por semana e sua maior corrida recente foi *[valor]*."
- **Corrida, nunca:** "Vamos começar a correr do zero, alternando caminhada e trote."
- **Musculação, ativo:** "Você treina *[N]* vezes por semana há *[tempo]*."
- **Musculação, parado:** "Você treinou por *[tempo]* e está parado há *[tempo]*. Vamos retomar com cuidado."
- **Musculação, nunca:** "Na musculação vamos começar do básico, com exercícios guiados."
- **Objetivo:** "Seu foco é *[objetivo]*."
- **Semana:** "Você tem *[N]* dias, cerca de *[H]* no total. O dia mais longo é *[dia]*."
- **Restrições:** "Vamos evitar *[o que se aplica]* por causa do *[região]*."
- **Ajuste:** "Como ainda temos pouca informação, começamos de forma conservadora e ajustamos conforme você treina."

Sinais de alerta **não** aparecem aqui: têm tela própria (fluxo de cautela, seção 8.6), com texto sem diagnóstico ("o app não avalia saúde; recomendamos conversar com um profissional antes de treinar com intensidade").

---

## 10. Situação final

**Todos os itens do checklist estão fechados.** Os que estavam "precisa de decisão" foram resolvidos: tabela de faixas → nível (8.1), `tempoMaxMin` (8.3), `weeksChoice` (8.5), comportamento da cautela (8.6). Os demais ficam **fora desta versão** ou **para o motor** (8.9): modalidade única, uso da idade, validade de dados de estado, regra estimado → observado, critérios de calibração, ranqueamento de candidatos a longão, metadados do catálogo, avanço de semana, backup dos demais dados, regeneração do plano, `metaSessoes` / `eventos` / `preferencias.gosto`.
