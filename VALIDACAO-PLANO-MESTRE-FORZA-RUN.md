# Validação do Plano Mestre do Motor — Forza Run

Data: 06/10/2026 · Base analisada: `treino-app.html` no commit `7ddb2e4` (18.452 linhas), `src/native-bridge.js`, `plugins/aviso-descanso/`, `scripts/` e os testes usados até aqui.

Este relatório só compara o `PLANO-MESTRE-MOTOR-FORZA-RUN.md` com o código real. Nenhum arquivo do app foi alterado.

As referências `linha N` apontam para `treino-app.html` nesse commit.

---

## 0. Resumo em uma página

- O Forza Run **já tem um motor estruturado** (o “Motor V2”, linhas 3354–4530). Ele segue um pipeline parecido com o do plano mestre:
  - **Funções:** `lerEstado → definirPrioridade → definirFrequencias → distribuirSessoes → montarSessoes → validarPlano`.
  - **Recursos:** níveis separados para corrida e musculação, registro de decisões (`est.log`), validação com 10 regras (V1–V10), correção automática e parâmetros centralizados (`MOTOR_PARAMS`).
  - **Conclusão:** o plano mestre parte de um diagnóstico mais pessimista do que a realidade. Vários módulos existem e só precisam ser **extraídos e formalizados**, não criados do zero.
- **Lacunas reais:**
  - A atividade realizada depende do plano. Não existe corrida livre nem mais de uma corrida por dia.
  - Não há versão do motor, e o log de decisões não é salvo.
  - O check-in semanal regera a semana em vez de aplicar uma camada de ajuste (overlay) versionada.
  - A progressão de força é calculada na hora, sem um estado salvo por exercício.
  - **Não existe nenhum teste automatizado dentro do repositório.** Os testes usados até aqui (`matriz.js`, `e2tests.js`, `e3tests.js`, `e4tests.js` etc.) estão numa pasta temporária, fora do Git.
- **Problema de gravação encontrado:** quando a última etapa do treino termina, a corrida é **encerrada sozinha** (`gpsAdvanceStep`, linha 7164). Isso contraria o princípio 10 do plano mestre e é a correção mais urgente da Fase 1.
- **Maior risco:** o plano mestre propõe regras novas, como deload adaptativo, orçamento de séries por músculo e progressão sem percentual fixo. Elas mudariam os planos gerados, e o usuário já decidiu que **as regras estabelecidas não podem mudar sem aprovação**. Toda regra nova precisa entrar desligada, ser comparada com a atual e só depois ser aprovada. O próprio plano mestre prevê isso na Entrega 6.

---

## 1. Componentes propostos que já existem

| Proposto | O que já existe no código | Onde |
|---|---|---|
| Diagnóstico com eixos separados | `lerEstado` gera `capacidade.corrida` e `capacidade.musc` separados, além de `confianca`, `cautela`, `restricoes`, `recuperacao.prontidao`, `calibracao` e `objetivo` | 3585–3772 |
| Perfil versionado com origem e confiança | `athleteProfile` com `ATHLETE_SCHEMA_VERSION = 3`. Cada campo é um “Dado” com `{valor, origem, confianca, atualizadoEm, validoAte}`. Inclui migração do que o app já guardava | 2780–3352 |
| Disponibilidade por dia e minutos | `disponibilidade` por dia (`disponivel`, `minutos`, `periodos`, `preferencia`, `restricao`) | 2861–3008 |
| Equipamentos reais | `motorLerEquipamentos`, `equipItens`, `EQUIP_PERFIS`, validação V7 | 3498, 2540 |
| Regra decide, treinador explica | Os textos do treinador saem de funções de regra: `porQueHoje`, `justificativaDoDia`, `annotateHybridJustifications`. Nenhum texto decide carga | 4806–4853 |
| Limites configuráveis | `MOTOR_PARAMS`, `MOTOR_BLOQUEIO_REGIAO`, `HYBRID_FADIGA_*` e `SETREPS` ficam em tabelas próprias | 3360, 8665 |
| Solver de agenda com custo | `distribuirSessoes` faz busca com custo e penalidades (dobros, fadiga de pernas, adjacência longão/qualidade). Existe também o `hybridScheduleCost` do motor anterior | 3956–4058, 8679 |
| Restrições duras híbridas | `validarPlano`: V3 (duas sessões duras no dia, pernas pesadas + corrida, longão + pernas), V6 (dias livres, recuperação reduzida), V9 (estímulos altos consecutivos, longão perto de musculação para iniciante, run/walk em dias seguidos) | 4269–4347 |
| Conflito sem solução vira aviso | O plano reprovado nunca é entregue: o motor reduz sessões e revalida. As sessões cortadas viram `alertas` (`sessao_descartada`, `modalidade_fora_da_semana`) | 4404–4436, 4450–4458 |
| Papéis de sessão de corrida | Códigos estáveis `RUN_EASY_Z2`, `RUN_INTERVALS_VO2MAX`, `RUN_TEMPO_THRESHOLD`, `RUN_LONG_RUN`. Na musculação: `LEG_DAY_HEAVY`, `UPPER_BODY`, `FULL_BODY_LIGHT` | 3954, 8665 |
| Sessões de corrida com aquecimento, principal e volta à calma | Construtores `hb*` do motor híbrido, com ritmos do VDOT | 8658+ |
| Trajetória do bloco | `motorTrajetoria`: base, construção, descarga a cada 4ª semana (75%), polimento por distância de prova, calibração nas 2 primeiras semanas | 4383–4403 |
| Gravação GPS offline-first | `gpsRun` como máquina de estados (intro, permissão, aguardando, contagem, correndo, pausado, finalizado). Checkpoint `activeRun` no IndexedDB, em blocos, com restauração ao reabrir. Pausa automática, segmentos (`seg`) ao retomar e GPX com trechos | 6367–7400, 5656 |
| Pipeline único de filtro | `gpsCleanTrack` alimenta parciais, gráficos, mapa e artes | 6747+ |
| Tempo total e tempo em movimento | `movingMs` ao vivo e `gpsTempoEmMovimento` no resumo | — |
| Salvamento local antes da nuvem | Corridas no IndexedDB, depois `sincronizarCorridasGps` com índice e exclusões pendentes | 7396+ |
| Substituições que preservam função | `alternativasDoExercicio`: mesmo padrão de movimento, mesmo músculo, nível, equipamento, contraindicações e bloqueios para iniciante | 2521 |
| Dor bloqueando intensidade | `motorLerDor`, `motorLerCautela` (sinais de alerta bloqueiam o plano), `MOTOR_BLOQUEIO_REGIAO`, regra de dor muscular no check-in diário (dor forte → regenerativo e −25% de séries de perna no dia) | 3451–3497, 4736, 9212 |

## 2. Componentes que existem parcialmente

| Proposto | O que já existe | O que falta |
|---|---|---|
| `AssessmentEngine` / `Assessment` | `lerEstado` e as avaliações do `athleteProfile` | Objeto `Assessment` próprio, salvo e com `engineVersion` e `measuredAt`. Hoje o estado é recalculado a cada geração e não é guardado. Também faltam `strengthConfidence` e `runConfidence` expostos e a inferência posterior a partir das atividades |
| `StrengthPlanEngine` | `motorSessoesMusc`, `motorMontarMusc`, `motorEsquema`, `motorCompletar`, padrões `ATHLETE_PADROES`, duração estimada (`minutosPorExercicio`) | Orçamento de séries por grupo muscular (direto e indireto), proximidade de estímulos, volume de pernas somado à carga da corrida dentro da prescrição, RIR explícito |
| `StrengthProgressionEngine` | `suggestedForExercise` (reduz com PSE ≥ 9 ou repetições < 80% da meta; sobe quando cumpre), `direcaoProximaCarga`, `verificarRecorde` | Estado salvo por exercício. Hoje é derivado do último registro. Faltam `reasonCode` estável (hoje o motivo é só texto), confiança, regra de consolidação em várias sessões, detecção de sessão parcial, incremento real do equipamento e ação `vary` |
| `RunPlanEngine` | `motorSessoesCorrida`, `motorMontarCorrida`, `hb*`, `motorTrajetoria`, `MOTOR_PARAMS.volumeRef` / `passoSemanal` / `fracaoRetomada` | Ações semanais fechadas (`hold`, `increase_duration`, `repeat_week` etc.). Hoje a progressão é a trajetória fixa de +8% por semana com descarga na 4ª, mais o fator do check-in |
| `RunZoneEngine` | `motorVdot` com `vdotFonte` e `validadeDesempenhoDias`, `computeVdotPaces`, chave `zonas` | Histórico de mudanças de zona, confiança visível, aceite do usuário e faixa na interface em vez de segundo exato |
| `HybridScheduler` | `distribuirSessoes` + `validarPlano` + `conflitosDoDia` (regra de 24 h no dia a dia) | Objeto `SessionLoad` normalizado (hoje são códigos e pontos de fadiga de pernas), saída `ScheduleDecision` com `compromises` e `score`, e um modo “só auditoria” separado da geração |
| `RecoveryModel` | `cargaReal` (aguda/crônica, pontos de pernas com recuperação de 25/dia), `checkinDiario`, dor muscular, `prontidao` (sono) | Consolidar tudo num modelo só. Hoje são três fontes, usadas em lugares diferentes |
| `AdaptationEngine` | `aplicarCheckinSemanalV2` (fadiga ≥ 4 ou dor → volume 0,8; dor → aliviar pernas; fadiga ≥ 5 → sem qualidade; “fácil” → 1,05), escada `opcoesAjuste` do dia a dia, `treinosPerdidos` / `resolverPerdido` | `WeeklyCheckin` → `WeekDecision` como objetos. Prioridade explícita de decisões e lista fechada de ações |
| `OverlayEngine` | `hybridPlanData.ajusteProximaSemana`, `muscAjusteOrig` (ajuste de musculação vale só na semana e volta sozinho), `e.ajuste.original` nas corridas ajustadas | Overlay versionado e idempotente aplicado sobre um plano-base imutável. Hoje o check-in regera a semana futura e os ajustes do dia alteram a agenda diretamente (ver seção 4) |
| `RecordingSession` | `gpsRun` com checkpoint, restauração e pausa automática | Separar da sessão planejada. Hoje `openGpsIntro(day)` exige um treino de corrida no dia (linha 6970). Também falta tratar e marcar lacuna após falha. Hoje a retomada marca segmento (`seg`), não uma lacuna explícita |
| `ActivityRepository` | Corridas GPS no IndexedDB; `corridaProgress` (resultado por dia do plano); `workoutSessionsLog` (musculação, já com `id`, `seriesExecutadas`, `exerciseId`); `historicoCarga` | Um repositório único de atividades, independente do plano, com mais de uma corrida no mesmo dia, `syncState` e `clientGeneratedId` |
| `CoachExplanation` | `porQueHoje`, `justificativaDoDia`, diário do treinador, `nextWorkoutAdjustmentText` | Tradução a partir de `reasonCode`. Hoje cada função monta seu texto a partir de regras próprias |
| `DecisionLog` | `est.log` (etapa, regra, motivo, dados), `validacao.historico`, `diarioTreinador` | Salvar, versionar e incluir entradas e origem. Hoje `est.log` é devolvido por `gerarPlanoSemanal` e **não é salvo** em `hybridPlanData` |
| Questionário | Questionário V2 com telas condicionais (“só as que se aplicam”), “O que entendi” e dor / sinais de alerta | Confirmar se pergunta as modalidades primeiro, se permite “só quero registrar”, e se o onboarding só termina depois de o plano ser salvo |
| Deload | Descarga fixa na 4ª semana; `muscSeriesFator` 0,85 na calibração; DOMS reduz pernas no dia | Deload antecipado, parcial (só pernas) e por desempenho |

## 3. Componentes que precisam ser criados

1. **Modelo `Activity` independente**, com `PlannedSession` e `SessionCompletion`. Inclui corrida livre (sem plano), várias atividades no mesmo dia e o estado “concluído sem registro”.
2. **`WorkoutMatcher`**: vincula uma atividade a uma sessão planejada, com nível de confiança. Hoje esse vínculo é implícito, pela chave do dia (`"Seg 05/10"`).
3. **Versão do motor** (`engineVersion`) em planos, decisões, overlays e `Assessment`. Não existe hoje.
4. **`DecisionLog` salvo**, com instantâneo das entradas, regra vencedora, regras recusadas, origem e chave de idempotência.
5. **Contratos `WeeklyCheckin` → `WeekDecision` → `WeekOverlay`**, versionados e idempotentes.
6. **`SessionLoad` normalizado**: estresse sistêmico, de pernas e de impacto; horas de recuperação; se a sessão pode ser movida; prioridade.
7. **Estado de progressão por exercício** (`ProgressionDecision` salvo) e regras de consolidação.
8. **Estados de semana e fase separados para força e corrida.** Hoje existe um único `currentWeekIndex` e uma única `phaseLabel`.
9. **Painel interno de auditoria** das decisões.
10. **Infraestrutura de testes dentro do repositório**: `npm test` hoje só imprime “no test specified”.
11. **Configuração versionada** dos parâmetros. `MOTOR_PARAMS` existe, mas não tem versão nem histórico.

## 4. Propostas em conflito com o motor atual

| Proposta | Como o app funciona hoje | Impacto |
|---|---|---|
| “Plano prescrito não é atividade realizada” | A corrida feita é guardada em `corridaProgress[chave do dia do plano]`, com um único `gpsRunId`. O GPS só abre a partir de um treino planejado. Excluir a corrida apaga o “feito” do dia | Mudança estrutural na gravação, na aba Treino, no Progresso, nos recordes, no tênis, na carga real e na nuvem |
| “Mudança semanal é overlay; plano-base intacto” | O check-in marca as semanas futuras como `pendente` e as regera com `ajustesIniciais`. Os ajustes do dia gravam direto em `state.treinos` / `state.musculacao` (com `ajuste.original` e `muscAjusteOrig` para desfazer) | O plano-base não existe como objeto imutável. Hoje o “base” é recalculado do perfil a cada semana. Para ter overlay, é preciso guardar a semana-base gerada |
| “Força e corrida têm estados próprios” | Uma só semana do plano, uma fase e uma trajetória (que mede só o volume de corrida). Na musculação só existe o fator de séries da calibração | Muda `hybridPlanData`, a materialização da semana e a prévia de semanas futuras |
| “Deload não é só semana 4” | `motorTrajetoria` faz descarga fixa a cada 4 semanas | **Regra estabelecida.** Mudar exige aprovação do usuário |
| “Não usar aumento percentual fixo universal” | `passoSemanal: 0.08` (+8% por semana) com teto pelo `volumeRef` | **Regra estabelecida.** Mudar exige aprovação |
| “Volume e intensidade não sobem juntos” | V10 bloqueia progressão sem justificativa. A trajetória sobe volume enquanto a qualidade fica fixa pela frequência | Compatível em grande parte; falta deixar a regra explícita |
| “Métricas como tela padrão; mapa secundário” (8.6) | Por pedido do usuário (06/10), a corrida ativa mostra o **mapa no topo**, com o painel embaixo | Conflito de **interface** com decisão recente do usuário. Prevalece o que o usuário aprovou |
| “Última etapa nunca encerra a atividade” | **Conflito confirmado.** `gpsAdvanceStep` (linha 7160) chama `finishGpsRun()` quando a última etapa termina: ao bater a distância ou o tempo da etapa (linhas 7208–7209), ao tocar “Pular” ou ao marcar “Lap” na última etapa. A corrida se encerra sozinha, e quem continua correndo perde o resto | Corrigir isso (seguir gravando em “etapa livre” depois da última) é a mudança de gravação mais urgente. Precisa de teste de caracterização antes |
| Arquitetura em módulos (`AssessmentEngine` etc.) | O app é um único arquivo HTML. O `npm run build` só empacota `src/native-bridge.js` e copia os arquivos para `www/` | Extrair módulos exige definir como o HTML carrega esse código: um script empacotado pelo esbuild ou uma seção isolada. Sem isso, “extrair” só reorganiza dentro do arquivo |
| “Não copiar nomenclatura proprietária” | Os códigos `RUN_INTERVALS_VO2MAX`, `LEG_DAY_HEAVY`, `RUN_EASY_Z2` etc. vêm da especificação do próprio usuário (memória “engine-hibrido-regras-futuras”) | Confirmar com o usuário a origem desses códigos; se forem dele, ficam |
| Histórico ilimitado / “refazer plano não apaga atividades” | `workoutSessionsLog` é cortado em **200 registros** (`slice(-200)`); `checkinDiario` guarda ~60 dias; `diarioTreinador` guarda 200 | Perda silenciosa de histórico. O próprio plano mestre não tolera isso |

## 5. Regras atuais que o plano mestre não contempla

Todas estão no código hoje e precisam aparecer nos testes de caracterização e no novo catálogo de regras. Muitas são decisões do próprio usuário.

1. **Regra bilateral de 24 h:** nunca pernas pesadas no dia antes ou no dia depois de corrida intensa (`conflitosDoDia`, `hybridScheduleCost` com custo 5000).
2. **Teto diário de fadiga de pernas:** 50 pontos por dia, recuperação de 25 por dia, pontos por tipo de sessão (`HYBRID_FADIGA_PERNA`).
3. **Corrida antes da musculação** no dia duplo, com justificativa por período (`annotateHybridJustifications`, `periodos`).
4. **Dobros proibidos no modo conservador** (`motorProibeDobro`).
5. **Iniciante:**
   - sem musculação em dias seguidos;
   - sem longão colado à musculação;
   - mínimo de dias livres;
   - sem barra fixa, saltos ou variações difíceis nas trocas.
6. **Regime run/walk** e restrição de impacto. Run/walk nunca em dias seguidos; o tempo contínuo máximo define o regime (`tetoRunWalk`).
7. **Bloqueio de exercícios por região de dor** (`MOTOR_BLOQUEIO_REGIAO`, `LESAO_EXERCICIO_EVITAR`).
8. **Sinais de alerta bloqueiam o plano inteiro** (`cautela.bloqueado` → “avaliação em andamento”).
9. **Dor muscular do check-in diário:** dor forte equivale a DOMS 7, que vira corrida regenerativa e −25% de séries de perna só naquele dia (`aplicarDomsDeHoje`).
10. **Semana 1 parcial:** um plano criado no meio da semana redistribui as sessões só nos dias que restam.
11. **Sessões-chave (★):** só as sessões-chave perdidas são oferecidas para remarcar; as outras seguem sem repor.
12. **Ajuste de musculação dura só a semana** e volta sozinho na segunda (`muscAjusteOrig`).
13. **Polimento por distância de prova** (`VDOT_TAPER_WEEKS_BY_GOAL`, `VDOT_TAPER_PCT`) e **retomada por tempo parado** (`fracaoRetomada`).
14. **Arredondamento de distância** a 0,5 km nos planos (`roundToHalf`); distância medida pelo GPS truncada em 2 casas.
15. **Carga real aguda/crônica** em três estados (baixa, moderada, alta) e fator “Como foi?” (0,85 a 1,4).
16. **Corrigir corrida vale para o plano** (decisão do usuário em 06/10). O dado corrigido entra nos cálculos.
17. **Recordes de corrida e de musculação**; quilometragem do tênis creditada e devolvida.
18. **Regras de interface já decididas:**
    - sem volume ou tonelagem visível;
    - sem “Ajustar” genérico no Início e no Treino;
    - laranja só nos músculos e na rota;
    - telas com pouco texto.

## 6. Partes que exigiriam migração de dados

| Dado atual (chave) | Para onde iria | Cuidados |
|---|---|---|
| `corridaProgress` (chave `"Seg 05/10"`; `done`, `km`, `tempo`, `pace`, `data`, `gpsRunId`, `shoeCredit`, `comoFoi`, `obs`, `kmOriginal`, `corrigidaEm`) | `Activity` (corrida) + `SessionCompletion` | Corridas manuais sem gravação viram “concluído sem registro”. Os campos de correção precisam ser preservados |
| Corridas GPS no IndexedDB (`pontos_gps`, `distancia_total_km`, `tempo_total_seg`, `foto`, `corrigidaEm`) e na nuvem (`gpsRun__<id>`, `gpsRunsIndex`) | `Activity.route` / `metrics` | Manter os ids (a nuvem usa o mesmo id) e a fila de exclusões `__gpsExcluidas` |
| `workoutSessionsLog` (formato antigo e novo: `id`, `seriesExecutadas`, `exerciseId`, `muscleMap`, `calories`, `editHistory`) | `Activity` (força) + `SessionCompletion` | Remover o limite de 200 **antes** de migrar. Os registros antigos sem séries continuam válidos |
| `historicoCarga` (por chave de exercício e data) | Base do estado de progressão por exercício | As chaves misturam id do catálogo, `repdbId` e nome. Normalizar para o id canônico (`MIDIA_REMAP_*` já remapeia parte) |
| `hybridPlanData` (`plan[]` com semanas `pendente`, `trajetoria`, `ajusteProximaSemana`, `currentWeekIndex`, `materializadaSeg`, `checkins`, `draft` antigo, `motorV2`) | `PlanBlock` + semanas-base imutáveis + overlays + estados separados de força e corrida | Planos antigos do motor anterior (sem `motorV2`) e do VDOT puro (`corridaVdotData.plan`) também precisam de rota de migração |
| `treinos`, `musculacao`, `muscDayOrigin`, `muscAjuste`, `muscAjusteOrig`, `perdidosTratados` | `PlannedSession` materializada + overlays do dia | Hoje é a agenda “viva” que a interface lê. A migração não pode mudar o que aparece na tela |
| `athleteProfile` (versão 3) | `Assessment` versionado | Já tem migração própria. Basta subir a versão de esquema |
| `checkinDiario`, `domsPernas`, `diarioTreinador`, `zonas`, `corridaVdotData`, `recordesCorrida`, `equipamentos` | `RecoveryModel`, `DecisionLog`, `RunZoneEngine` | `diarioTreinador` vira parte do `DecisionLog` |
| Backup (`BACKUP_KEYS`, linha 11272) e nuvem (Firebase, por chave) | Todas as chaves novas | Backups antigos precisam continuar importando. A migração precisa ser idempotente e não pode rodar duas vezes em dois aparelhos com a mesma conta |
| Contexto personal ↔ aluna (`viewingClient`) | — | A migração precisa respeitar quem é o dono dos dados (`ownerUid`) |

## 7. Dependências entre as fases

```
Fase 0 (testes de caracterização + harness no repositório)
   └─► tudo o mais depende dela
Fase 1 (Activity / RecordingSession / corrida livre)
   ├─► Fase 2 (PlannedSession, SessionCompletion, WorkoutMatcher)
   │      └─► Fase 5 (check-in usa o realizado vinculado ao planejado)
   └─► migração de corridaProgress e workoutSessionsLog + nuvem + backup
Fase 2 (modelos: Assessment, estados separados, DecisionLog, engineVersion)
   └─► Fase 3 (motores extraídos produzem objetos versionados)
Fase 3 (SessionLoad, progressão por exercício, zonas)
   └─► Fase 4 (solver precisa de SessionLoad normalizado)
Fase 4 (solver: auditoria → sugestão → aplicação)
   └─► Fase 5 (overlay recalcula a carga híbrida com o solver)
Fase 5 (WeeklyCheckin → WeekDecision → WeekOverlay)
   └─► Fase 6 (telas de antes/depois do ajuste, semana em duas pistas)
Fase 6 (telas) depende de 1–5 estáveis e das decisões da seção 9
```

Dependências cruzadas:
- A carga real (`cargaReal`) lê `corridaProgress` e `workoutSessionsLog`. Mudar o modelo de atividade (Fase 1) altera a carga, que altera o treinador e os ajustes. Por isso o teste de caracterização de `cargaReal` precisa existir antes da Fase 1.
- Corrigir corrida e excluir atividade (já implementados) gravam direto em `corridaProgress`. Eles precisam ser migrados junto com a Fase 1.
- A nuvem e o backup precisam mudar na mesma entrega do modelo, senão um aparelho com versão antiga sobrescreve dados novos.

## 8. Testes a escrever antes de qualquer alteração

**Primeiro passo obrigatório:** trazer para o repositório os testes que hoje vivem fora do Git e ligá-los ao `npm test`:
- `matriz.js` (20 perfis);
- `b1tests`, `e2tests`, `e3tests`, `e4tests`;
- `descansotest`, `bibtest`;
- `v13test`, `v14artes`, `v17test`.

Hoje eles estão numa pasta temporária, que pode sumir.

Testes de caracterização (registram o comportamento atual; não julgam se está certo):

**Motor V2 (com data e perfil fixos)**
1. “Planos dourados”: saída completa de `gerarPlanoSemanal` para os 20 perfis, com dias, tipos, minutos, exercícios, séries, alertas e o log de decisões.
2. `validarPlano`: um caso que dispara cada código V1–V10, e as correções de `motorAjustar` e da redução forçada.
3. `motorTrajetoria`: semanas 1–16 com descarga, polimento por distância e calibração.
4. `gerarSemanaV2(n)` para n = 2…N, com e sem `ajusteProximaSemana`.
5. Semana 1 parcial, criada em cada dia da semana (segunda a domingo).
6. Bloqueio por sinais de alerta e modo conservador.

**Plano vivo e treinador**

7. `aplicarCheckinSemanalV2`: cada combinação de fadiga, dor e resposta.
8. `cargaReal`: sequências de atividades, com e sem “Como foi?” e check-in diário.
9. `conflitosDoDia` e `opcoesAjuste` / `moverSessao`. A interface removeu o “Ajustar”, mas o código continua sendo usado pelo treino perdido.
10. `treinosPerdidos` / `resolverPerdido` (remarcar só sessões-chave).
11. Regra de dor muscular do check-in diário (−25% em pernas e corrida regenerativa).
12. `restaurarAjustesMuscAntigos` na virada da semana.

**Força**

13. Tabela de `suggestedForExercise`: PSE alto, repetições abaixo, todas cumpridas, registro de hoje, sem histórico.
14. `verificarRecorde`, `alternativasDoExercicio` (iniciante, dor, equipamento, filtros).

**Gravação e atividade**

15. Pipeline GPS (a base é `e4tests`): filtro de precisão, pausa automática, segmentos, splits, GPX, contagem regressiva.
16. Checkpoint e restauração depois de fechar o app no meio da corrida; corrida sem pontos (esteira).
17. Encerramento: registrar o comportamento atual (a última etapa encerra a corrida sozinha, linha 7164), para que a correção prevista no Passo 3 seja comprovada por teste.
18. Finalizar, descartar, corrigir (distância, tempo, data) e excluir, com efeito no tênis, nos recordes e no plano.
19. `workoutSessionsLog`: formato antigo e novo, correção, exclusão, limite de 200.

**Dados**

20. Ida e volta do backup (exportar e importar) com todas as `BACKUP_KEYS` e as corridas do IndexedDB.
21. Sincronização com a nuvem simulada: idempotência por id, exclusão pendente, corrida feita sem login.
22. Migração do `athleteProfile` rodando duas vezes sem duplicar nada.
23. Datas nos limites: depois das 21h (fuso), virada de semana, `weekOffset` passado e futuro.

## 9. Decisões pendentes antes do design das telas

1. **Corrida livre e várias atividades por dia:** como aparecem na aba Treino e no Progresso? O que conta como “feito” quando há duas corridas no mesmo dia?
2. **Conclusão manual “sem registro”:** continua com o botão de marcar? Como aparece?
3. **Deload:** manter o fixo a cada 4 semanas (regra atual) ou adotar o adaptativo? (Muda o plano; precisa da aprovação do usuário.)
4. **Progressão de corrida:** manter +8% por semana com teto (regra atual) ou adotar as ações fechadas do plano mestre?
5. **Orçamento de séries por grupo muscular** e números de recuperação por tipo de sessão: precisam de calibração profissional (o plano mestre reconhece na seção 17).
6. **Duas pistas (força e corrida avançando separadas):** o usuário vê duas fases ou uma só?
7. **Overlay do check-in:** aplicar sozinho ou mostrar “antes / depois” e pedir confirmação?
8. **Solver:** quando passa de auditoria para sugestão e de sugestão para aplicação automática? Como os conflitos aparecem na tela (com a preferência por pouco texto)?
9. **Zonas:** mudança de VDOT e ritmos é aceita automaticamente ou pedida ao usuário? A interface mostra faixa de ritmo?
10. **Mapa ou métricas como padrão na corrida ativa:** o plano mestre diz métricas; o usuário aprovou o mapa no topo em 06/10.
11. **“Só quero registrar”:** existe no onboarding?
12. **Retenção de histórico:** remover os limites de 200 registros e 60 dias?
13. **Início:** o pacote “04-INICIO” estava reservado para uma etapa própria. A nova tela de Início depende das decisões 6, 7 e 8.
14. **Comunidade:** modelo de dados e privacidade (fase 2, ainda não iniciada).
15. **Códigos de sessão** (`RUN_*`, `LEG_DAY_HEAVY` etc.): confirmar que podem continuar.

## 10. Ordem segura e detalhada de implementação

Cada passo termina com testes passando, commit próprio e IPA só quando houver mudança visível. Nenhum passo muda um plano gerado sem relatório de diferenças e aprovação do usuário.

**Passo 0 — Rede de segurança (sem mudar comportamento)**
1. Criar `tests/` no repositório e trazer os testes da pasta temporária. Ligar `npm test` (Node + Puppeteer, que já são usados).
2. Congelar o relógio nos testes (o `RELOGIO` já existe) e gerar os “planos dourados” dos 20 perfis (item 8.1).
3. Escrever os testes 8.2 a 8.23. Todos precisam passar contra o código atual.
4. Criar um script de comparação que mostra o plano antes e depois de cada mudança, por perfil.

**Passo 1 — Proteções de dados (mudança mínima, sem efeito no plano)**
5. Remover o corte de 200 em `workoutSessionsLog`, ou paginar sem apagar. Revisar os limites do `checkinDiario` e do `diarioTreinador`.
6. Adicionar `engineVersion` às saídas do motor e salvar `decisoes` + `validacao` junto da semana gerada (só registro).

**Passo 2 — Extração sem mudança de regra**
7. Decidir o formato dos módulos: arquivos em `src/motor/` empacotados pelo esbuild num `motor.js` que o HTML carrega, como já acontece com `native-bridge.js`.
8. Mover funções puras, sem alterar nada: `lerEstado` e auxiliares, `definir*`, `distribuirSessoes`, `montarSessoes`, `validarPlano`, `motorTrajetoria`, `suggestedForExercise`, `cargaReal`, `conflitosDoDia`, `aplicarCheckinSemanalV2`. Os planos dourados precisam continuar idênticos.

**Passo 3 — Modelo de atividade (Fase 1 do plano mestre)**
9. Corrigir o encerramento automático na última etapa: a gravação segue numa etapa livre até a ação explícita do usuário.
10. Criar `ActivityRepository` (IndexedDB) com `Activity` e `SessionCompletion`. A gravação passa a criar uma `Activity` e a conclusão do dia vira um vínculo.
11. Fazer uma migração idempotente de `corridaProgress` + corridas GPS + `workoutSessionsLog`. Durante a transição, manter as chaves antigas escritas em paralelo para que versões antigas do app e a nuvem não quebrem.
12. Ajustar `cargaReal`, recordes, tênis, Progresso, artes e nuvem para ler do repositório. Os testes 8.8 e 8.18–8.21 garantem que nada muda.
13. Liberar a corrida livre e várias atividades por dia (depende da decisão 9.1).

**Passo 4 — Contratos (Fase 2)**
14. Criar `Assessment` versionado a partir de `lerEstado` (só salva o que já é calculado).
15. Criar `PlannedSession` com ids estáveis na materialização da semana, e `WorkoutMatcher` vinculando por dia e modalidade (comportamento atual) e depois por horário.
16. Separar `currentWeekIndex` e fase em força e corrida, ainda andando juntos (mesmo resultado).

**Passo 5 — Motores (Fase 3)**
17. Introduzir `SessionLoad` derivado dos códigos atuais (`HYBRID_FADIGA_PERNA` vira `lowerBodyStress`).
18. Criar o estado de progressão por exercício, alimentado pelo histórico e com o mesmo resultado de `suggestedForExercise`, mais `reasonCode`.
19. Adicionar histórico, origem e confiança às zonas, sem mudar os ritmos.

**Passo 6 — Solver em auditoria (Fase 4)**
20. Criar o `HybridScheduler` em modo relatório: avalia a semana gerada e a agenda viva (incluindo mudanças manuais do usuário) e só registra os conflitos.
21. Comparar com os planos dourados e com casos reais. Só depois disso, com aprovação, habilitar sugestões.

**Passo 7 — Adaptação (Fase 5)**
22. Criar `WeeklyCheckin` → `WeekDecision` → `WeekOverlay` reproduzindo as regras atuais de `aplicarCheckinSemanalV2` (mesmo efeito, agora como overlay sobre uma semana-base salva).
23. Converter `muscAjusteOrig` e `e.ajuste.original` em overlays do dia.
24. Só então propor regras novas (deload adaptativo, ações semanais fechadas). Cada uma entra desligada, com relatório de diferenças nos 20 perfis e aprovação do usuário.

**Passo 8 — Validação global (Entrega 6)**
25. Rodar a matriz comparando: plano antigo × plano novo sem solver × plano novo com solver × 4 cenários de check-in. Gerar um relatório para o usuário aprovar.

**Passo 9 — Telas (Fase 6 / Entrega 7)**
26. Com as decisões da seção 9 tomadas: Início (pacote 04), semana em duas pistas, antes e depois do ajuste, atividades livres e Progresso. Tudo consumindo os contratos, sem regra de negócio na camada visual.

**Itens que só se confirmam no iPhone** (o build do iPhone já roda no GitHub; não há como testar no aparelho por aqui):
- GPS em segundo plano e restauração depois de o app ser fechado;
- abaixar a música durante o aviso de descanso;
- salvar e copiar arte com transparência;
- mapa da pré-corrida.
