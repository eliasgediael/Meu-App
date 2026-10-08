# Forza Run — Revisão de uso real (08/10/2026)

> **Atualização (2ª etapa, mesmo dia):** as decisões do usuário sobre salvar/excluir, resumo e corrida ativa foram aplicadas — ver a seção **10** no fim. As seções 1–9 descrevem o que foi encontrado na 1ª etapa; os itens da seção 4 marcados como "inconsistência" foram resolvidos na seção 10.

Revisão prática do app atual, sem refazer telas e sem mudar regras do motor. Tudo abaixo foi verificado no navegador de testes (Chrome sem interface, 390–430 px). **Teste de navegador não equivale a validação no iPhone**; o que só o iPhone confirma está na última seção.

Base: commit `5f6e4b4` + alterações não commitadas desta revisão (backup completo antes de começar em `backups/antes-revisao-uso-real-2026-10-08/`, com o diff do que já estava pendente). Sem commit, push ou IPA.

Legenda: **[reproduzido]** = falha vista acontecendo no app; **[código]** = confirmado lendo o código e/ou simulando a função isolada; **[suspeita]** = não reproduzido.

---

## 1. Mapa das telas e ações atuais

| Tela | Como chega | Ações principais |
|---|---|---|
| Início | aba Início | check-in do dia (Energia / Pernas / Dor), Próxima ação → Começar / Ver no Treino, semana em ícones, Treinador, Registrar atividade, Check-in semanal, Última atividade |
| Treino | aba Treino | semana (‹ ›), lista de dias, card do dia (corrida ou musculação), ⋯ Gerenciar plano |
| Card da corrida (Treino) | dia com corrida | título (abre detalhes), Iniciar corrida, Esteira, etapas (toque abre a descrição), círculo da lista marca como feita |
| Card da corrida concluída | dia com corrida feita | Compartilhar, Ver atividade gravada, Corrigir, Excluir corrida realizada |
| Musculação (Treino) | dia com musculação | tocar no exercício → modal de cargas (quickSets); ⋯ do exercício → Editar séries/carga/descanso, Ajustar descanso, Trocar, Ver execução, Remover hoje; Iniciar treino |
| Execução da musculação | Iniciar treino | Concluir série, editar peso/reps/PSE, descanso (pular, +tempo), ⋯ (Finalizar, Adicionar série, Sair), X (sair) |
| Resumo da musculação | fim do treino | Como foi?, Concluir, Compartilhar |
| Pré-corrida (GPS) | Iniciar corrida | sinal do GPS, etapas, tênis, avisos por voz, pausa automática, Começar |
| Esteira | Esteira | velocidade − / + (com a sugerida embaixo), inclinação, etapa atual, Próximo/Pular |
| Corrida ativa (GPS) | Começar | Pausar/Retomar, Segure para finalizar, Finalizar (quando pausado), voz, recentralizar mapa, X = sair sem salvar |
| Resumo da corrida | ao finalizar | Salvar atividade (só fecha — a gravação já aconteceu), Compartilhar, Corrigir, Exportar GPX, Descartar corrida |
| Atividade gravada (histórico) | Ver atividade gravada / Progresso | Fechar, Compartilhar, Corrigir, Excluir corrida realizada |
| Progresso | aba Progresso | Semana/Mês/Ciclo, resumo, evolução, recuperação, atividades (filtros), histórico completo, Corrida / Musculação / Medidas |
| Perfil | aba Perfil | níveis Corrida/Força, Plano e objetivo, Disponibilidade, Lesões, Histórico, Equipamentos, Dados pessoais, Preferências, Privacidade e dados, Ajuda, Sair/Entrar |
| Gerenciar plano (⋯ Treino) | aba Treino | Ver plano completo, Reorganizar semana, Histórico de mudanças, Revisar questionário, Lesões, Encerrar, Pausar/Retomar; Editar treino do dia, Criar treino manual, Modelos, Biblioteca, Planejado × realizado; Refazer meu plano |

---

## 2. Problemas reproduzidos e passos

### 2.1 Fechar o detalhe de um exercício levava a tela ao topo — **[reproduzido] → corrigido**
1. Treino → dia de musculação (ex.: quarta) → rolar até o fim da lista.
2. Tocar num exercício (abre o modal de cargas).
3. Fechar tocando fora, em Cancelar ou em Salvar.

Resultado antes: a tela voltava ao topo (posição 880 px → 0). O menu ⋯ e o editor (folhas de baixo) já mantinham a posição.
Causa: tocar no exercício abre o modal antigo em "tela cheia" (`treinoV2Escape`), e a volta era tratada como troca de aba.
Trocar de aba continua abrindo no topo (comportamento aceito).

### 2.2 Toque duplo em "Concluir série" registrava duas séries — **[reproduzido] → corrigido**
1. Iniciar treino de musculação.
2. Tocar duas vezes rápido em "Concluir série".

Resultado antes: 2 séries registradas (e 2 entradas no histórico de cargas) para 1 toque.

### 2.3 Finalizar o treino de musculação duas vezes duplicava o histórico — **[código] → corrigido**
`finishWorkoutSession` não tinha trava: chamado de novo com o treino já no resumo, gravava outro registro. No navegador, chamar duas vezes gerou 2 registros. Pela interface não consegui disparar duas vezes (o menu fecha ao tocar), então é uma proteção, não um bug visto pelo usuário.

### 2.4 "Como foi?" da musculação podia gravar no treino errado — **[código] → corrigido**
A resposta ia sempre para o último registro da lista, não para o treino recém-concluído (relevante se a sincronização trouxer um registro mais novo de outro aparelho).

### 2.5 Esteira: trocar a velocidade reescrevia a distância já corrida — **[reproduzido] → corrigido**
1. Esteira a 10 km/h por 10 min → 1,667 km.
2. Trocar para 12 km/h.

Resultado antes: a distância pulava na hora para 2,000 km (os 10 min eram recalculados a 12 km/h); 5 min depois mostrava 3,000 km (certo: 2,667 km).
Causa: distância = velocidade atual × tempo total da etapa.

### 2.6 Nenhum erro de execução nos fluxos testados — **[reproduzido]**
Sem erros de página em: abrir/fechar exercício (fora, X, Salvar), menu ⋯, editor; iniciar treino, séries, descanso, pular descanso, finalizar, resumo, sair; esteira iniciar, + velocidade, pausar, retomar, finalizar (2×: grava 1), resumo, descartar (apaga a gravação). Não consegui reproduzir travamento ou fechamento do app no navegador; **não afirmo que crashes do iPhone foram corrigidos**.

---

## 3. Correções feitas e arquivos alterados

| # | Correção | Arquivo |
|---|---|---|
| 1 | Posição da tela preservada ao fechar modal/tela cheia e voltar para a mesma aba (`__abaSuspensa` em `render`/`mrtFadeDeAba`); leitura de `scrollTop` segura | `treino-app.html` |
| 2 | "Concluir série" ignora segundo toque em 0,7 s e não age no resumo | `treino-app.html` (`concluirSerieAction`) |
| 3 | `finishWorkoutSession` não grava de novo se já está no resumo | `treino-app.html` |
| 4 | "Como foi?" grava no treino recém-concluído (`ws.logId`) | `treino-app.html` |
| 5 | Musculação sem voz: fim do descanso só com bipe (ou só vibração), no volume escolhido; o modo antigo "Bipe + voz" vale como "Bipe"; opção removida da Configuração. Voz da corrida intacta; voz global não foi desligada | `treino-app.html` (`prefsAviso`, `avisarFimDescanso`, Configurações) |
| 6 | Esteira: distância acumula por trechos (`esteiraDistanciaDoTrecho`, `esteiraDefinirKmh`, `esteiraNovaEtapa`); velocidade sugerida (`stepKmhSugerida`) separada da informada (`stepKmh`) e mostrada embaixo ("Sugerida 9,6 km/h · 5:55–6:37/km"); etapa sem ritmo mantém a velocidade atual em vez de zerar | `treino-app.html` |
| — | Testes novos | `tests/navegador/uso-real.test.js`, `tests/node/esteira-voz.test.js`, `tests/run.js`; `tests/node/legado/e3tests.js` (o teste usa a data real: agora olha o card da corrida) |

Também pendente de commit, de antes desta revisão: "Apagar todos os dados" apagando da conta (nuvem) e do aparelho.

**Ponte nativa / iOS:** o plugin `plugins/aviso-descanso` só fala quando recebe texto; agora o app manda texto vazio, então **nada em `ios/` precisou mudar**. A notificação de tela bloqueada ("Descanso acabou · Hora da próxima série.") não tem voz.

---

## 4. Salvar e excluir corrida — comportamento atual e inconsistências

### Como funciona hoje
- **Finalizar** (segurar 1 s, ou Finalizar quando pausado): grava a corrida no aparelho (IndexedDB, `run_<data>`) e, depois, na nuvem (sincronização com fila e novas tentativas). Corrida do plano: marca o dia como feito em `corridaProgress` (km, tempo, ritmo, data, tênis, `gpsRunId`). Corrida livre: vira atividade livre (`atividades`). Atualiza recordes e km do tênis.
- **Salvar atividade** (no resumo): só fecha; a gravação já aconteceu. **Salvar duas vezes não duplica** [reproduzido: finalizar 2× → 1 gravação].
- **Falha de rede**: o registro fica no aparelho e a nuvem recebe depois (testes `pendentes-flush`, `nuvem-falha-nao-sobrescreve` passam) [código + testes].
- **Onde aparece**: card do dia na aba Treino (corrida do plano), Progresso → Atividades e Histórico, Início → Última atividade.
- **Reabrir**: "Ver atividade gravada" (Treino) ou tocar na atividade (Progresso).
- **Corrigir**: distância, tempo e data (o traçado não muda).

### Três ações diferentes
| Ação | Onde | O que faz | Confirmação |
|---|---|---|---|
| Sair sem salvar | X durante a corrida | descarta a gravação em andamento | "Sair sem salvar?" |
| Descartar corrida | resumo logo após terminar | **apaga a corrida já salva** (mesmo efeito de Excluir) | "Descartar esta corrida? A gravação é apagada. O treino planejado continua." |
| Excluir corrida realizada | atividade gravada / card concluído | apaga registro, gravação (aparelho e nuvem), devolve km ao tênis | "Excluir esta corrida?…" |
| Remover treino planejado | telas antigas (ex.: excluir treino de corrida do dia) | apaga a sessão do plano | `confirm()` nativo do navegador |

### Inconsistências (não alteradas — precisam de decisão)
1. **Recorde continua após excluir a corrida** [reproduzido]: excluir apaga a corrida, mas `recordesCorrida` segue apontando para ela (recorde de 5 km / maior distância de uma corrida que não existe mais). Vale para corrida do plano e livre. Proposta: ao excluir, recalcular os recordes a partir das corridas restantes.
2. **Correr de novo no mesmo dia deixa a gravação anterior órfã** [reproduzido]: a nova corrida substitui a anterior no dia (histórico mostra só a nova), mas a gravação anterior continua no aparelho e na nuvem, sem aparecer em lugar nenhum. Proposta: perguntar "Substituir a corrida de hoje?" e excluir a anterior, ou registrar a segunda como atividade livre.
3. **"Descartar" no resumo apaga uma corrida já salva**: o nome sugere "não salvar", mas o efeito é excluir. Proposta: chamar de "Excluir corrida" com o mesmo texto de confirmação.
4. **Remover treino planejado usa `confirm()` nativo** (caixa do sistema), diferente das demais confirmações do app; está nas telas antigas.
5. **"Remover hoje" (exercício de musculação)** tira o exercício da lista daquele dia da semana sem confirmação; a lista por dia da semana vale até a próxima semana do plano ser montada, não só "hoje".
6. **Se gravar no aparelho falhar** [suspeita, código]: a corrida do plano é marcada como feita com um `gpsRunId` que não existe; o checkpoint da corrida é mantido, mas o vínculo fica quebrado.

---

## 5. Comparação visual com as artes (informações repetidas)

Prints em `prints-revisao-uso-real/`. **O Progresso não foi redesenhado** (nova composição será aprovada à parte).

### Resumo da corrida × arte 07 (Revisar atividade)
Hoje, de cima para baixo: mapa · dia e título · Distância/Tempo/Ritmo médio · Elevação/Em movimento · Como foi? (4 opções) · Observação/Foto · gráfico Ritmo (com "Médio 4:53" de novo) · Parciais · Planejado × Realizado (distância, duração e ritmo de novo) · Pace por bloco · Avaliação do treino (Métricas: elevação de novo; Ritmo por bloco: o mesmo do gráfico de blocos) · No próximo treino · Fechar/Compartilhar/Corrigir/GPX/Excluir.

Repetições:
- Distância, tempo e ritmo aparecem 3 vezes (topo, Planejado × Realizado, Avaliação).
- Ritmo médio também no cabeçalho do gráfico.
- Elevação 2 vezes (topo e Avaliação → Métricas).
- "Em movimento" igual ao Tempo quando não houve pausa.
- "Pace por bloco" (gráfico) e "Ritmo por bloco" (texto da Avaliação) dizem o mesmo.

Arte 07: mapa · título · **uma linha de 4 métricas** (Distância, Tempo, Ritmo, Em movimento) · Como foi? (5 rostos) · lista Tênis / Privacidade do mapa / Observação · **"Parciais e etapas" recolhido** · Salvar atividade · Descartar.

Proposta (sem remover dados): destaque = 4 métricas + Como foi? + Tênis/Privacidade/Observação. Em "Parciais e etapas" (recolhido): gráfico de ritmo, parciais, pace por bloco e Planejado × Realizado. Avaliação do treino e "No próximo treino" juntos num único bloco "Análise" dentro do recolhido. "Em movimento" só quando diferente do tempo. Elevação dentro do recolhido.

### Corrida ativa × arte 06
Hoje: mapa · faixa "Tiro 2 de 4" + km restantes + aviso de ritmo · Próximo · ritmo atual gigante · Tempo e Distância · Pausar + "Segure para finalizar" (vermelho).
Arte 06: mapa com "GPS excelente" · "INTERVALADO · ETAPA 3 DE 9" · cartão da etapa com barra e "Depois: trote leve · 2 min" · **3 métricas iguais** (Tempo, Distância, Ritmo) · "Dentro do ritmo" · botões redondos (voz · Pausar · observação).
Diferenças: hierarquia (ritmo gigante × 3 métricas iguais), sem indicador de sinal do GPS durante a corrida, botão de finalizar vermelho fora da paleta preto/branco/cinza, sem botão de observação. Não alterado (a tela de gravação é sensível; proposta para aprovação).

### Progresso × arte 03 (sem redesenho)
Repetições: "Corrida" aparece como resumo (km), em Evolução (Distância), em Atividades e de novo na seção Corrida (km por semana, ritmo médio); "Musculação" idem (sessões, séries por semana, histórico de musculação duplicando a lista de Atividades). Na arte 03 o Progresso termina em Atividades + "Ver histórico completo"; as seções Corrida/Musculação/Medidas não existem. Sugestão para a nova composição: manter Semana/Mês/Ciclo, resumo, evolução, recuperação e atividades; levar "Corrida", "Musculação" e "Medidas" para dentro de "Ver histórico completo" ou para detalhes.

---

## 6. Voz na musculação
- Antes: modo padrão "Bipe + voz" — no fim do descanso falava "Descanso encerrado. Próxima: série 2 de 4, Supino…" (pelo plugin nativo no iPhone, pela voz do navegador fora dele).
- Agora: só bipe (ou só vibração), respeitando volume e modo. Testado: o aviso não chama a voz.
- A corrida continua falando (etapas, km, ritmo) e segue a chave "Voz nos treinos", que na prática passou a valer só para a corrida.

## 7. Esteira — do ritmo do plano à velocidade
Caminho: plano → etapa com `pace` ("5:55 ~ 6:37/km") → `esteiraDefaultKmhForStep` = 3600 ÷ (meio da faixa em segundos), arredondado a 0,1 km/h → ao mudar de etapa aplica a nova velocidade (tiro: só após confirmar ou em 15 s).
Conferido em 20 perfis × 4 semanas: **1270 etapas, todas com ritmo e velocidade correta** (ex.: tiro 4:42–4:45 → 12,7 km/h = 4:43/km; limiar 4:15–4:18 → 14,0 km/h).
Por que pode "não corresponder" [suspeita, não reproduzido]:
1. O card do treino mostra o **ritmo médio do treino inteiro** (ex.: 5:19/km), mas a esteira começa pela velocidade do **aquecimento** (6:15/km = 9,6 km/h).
2. No tiro, a velocidade só muda ao confirmar (ou após 15 s); até lá aparece a do trote.
3. O arredondamento a 0,1 km/h dá ±5 s/km.
Pedido para confirmar: qual treino, qual etapa e qual velocidade apareceu.

---

## 8. Prints identificados (`prints-revisao-uso-real/`)
| Arquivo | Tela |
|---|---|
| `progresso-430.png`, `progresso-320.png` | Progresso (página inteira) |
| `pos-corrida-430.png`, `pos-corrida-320.png` | Resumo da corrida gravada (página inteira; mapa em branco porque o teste não tem internet) |
| `corrida-ativa-430.png`, `corrida-ativa-320.png` | Corrida ativa (posições simuladas; mapa sem fundo pelo mesmo motivo) |
| `esteira-01-intro.png`, `esteira-02-correndo.png`, `esteira-03-resumo.png` | Esteira: início, correndo (com a sugerida), resumo |
| `musc-01-execucao.png`, `musc-02-descanso.png`, `musc-03-resumo.png` | Musculação: execução, descanso, resumo |

Referências: pacote de artes aprovadas (FORZA-BASE-UNICA, 07/10/2026) — `HISTORICA-FORZA-RUN-ARTE-03-PROGRESSO.png`, `-06-CORRIDA-ATIVA.png`, `-07-POS-CORRIDA.png`.

---

## 9. Testes executados e pendências no iPhone

**Testes:** `npm test` → **489 verificações, 0 falhas** (inclui `uso-real` no navegador: posição ao fechar exercício por fora/Cancelar/Salvar/menu, toque duplo, finalizar 2× musculação e esteira; e `esteira-voz`: distância por trechos, sugerida × informada, sem voz no descanso).
Durante a revisão, uma primeira versão da correção de rolagem quebrou 28 verificações no ambiente de teste sem tela (leitura de `scrollTop` não numérica); corrigido e confirmado com a suíte inteira.

**Precisa do iPhone (o navegador não valida):**
1. Musculação: fechar o exercício por fora/Cancelar/Salvar mantém a posição.
2. Fim do descanso: só o bipe, com a tela ligada e bloqueada; música de outro app abaixa e volta.
3. Corrida: voz continua anunciando etapas e km.
4. Esteira: distância depois de trocar a velocidade; a "Sugerida" embaixo do valor.
5. Toque duplo em "Concluir série".
6. Tirar foto (permissão da câmera adicionada no build anterior) e "Apagar todos os dados" com a conta conectada.
7. Mapa sem internet: se o mapa não carregar, a rota deveria aparecer sobre fundo neutro (no teste sem internet a tela da corrida ficou só com o fundo) — **[suspeita]** a confirmar no iPhone em modo avião.

---

## 10. Decisões aplicadas (2ª etapa, 08/10/2026)

Backup antes de começar: `backups/antes-decisoes-corrida-2026-10-08/` (arquivos + diff do que estava pendente). Testes rodados depois de cada unidade; ao final, `npm test` → **516 verificações, 0 falhas**. Sem commit, push ou IPA.

| # | Decisão | O que mudou | Teste |
|---|---|---|---|
| 1 | Cada corrida é uma atividade independente | Se o treino planejado do dia já tem uma corrida registrada, a nova corrida vira **atividade própria** (id próprio `run:run_<data>`), soma no tênis e entra no histórico; o registro do plano não muda e não conta como segundo treino concluído. O resumo avisa: "Salva como atividade própria — o treino planejado do dia já tinha uma corrida." | `tests/navegador/corridas-independentes.test.js` |
| 2 | Recuperar gravações escondidas | `corridasOrfas()` acha gravações do aparelho sem atividade (ignora as de outra conta). Em **Perfil → Privacidade e dados** aparece "Recuperar corridas que não aparecem (N)" só quando N > 0. Confirma, faz **backup** (`backupRecuperacaoCorridas_<data>`, também vai para a conta), cria uma atividade por gravação com o **mesmo id da gravação** (rodar de novo não duplica), não apaga nada, recalcula recordes e registra no histórico de mudanças. O tênis não é ajustado (a corrida já tinha sido descontada quando foi substituída e não há como saber qual tênis era). | `tests/navegador/recuperar-corridas.test.js` |
| 3 | Excluir recalcula recordes | `recalcularRecordesCorrida()` refaz os recordes com as corridas que restaram (do plano e livres). Corrida cuja gravação ainda só está na nuvem mantém o recorde que já tinha. Tênis devolvido, histórico/totais atualizados (derivados), planejamento mantido. | `corridas-independentes.test.js` |
| 4 | "Descartar" → "Excluir atividade" | Corrida já salva só sai por **Excluir atividade**, com confirmação explícita ("…sai do histórico, dos totais e dos recordes, aqui e na sua conta… Não dá para desfazer."). Fechar/Salvar atividade só fecha — a atividade continua salva. | `tests/navegador/resumo-corrida.test.js`, `tests/node/atividades.test.js` |
| 5 | Confirmações padronizadas | As 12 confirmações que usavam a caixa nativa do sistema agora usam a confirmação do app, com título e o que sai/fica. "Remover hoje" virou **"Remover deste dia"** com confirmação: "Sai só do treino planejado de quarta desta semana. Séries já registradas continuam no histórico." (ou "Sai do treino de quarta" quando o dia é manual/modelo). Uma checagem automática falha se voltar a existir `confirm()` nativo. | `tests/node/estilos.test.js`, `tests/navegador/uso-real.test.js` |
| 6 | Resumo da corrida pela arte 07 | Topo: Distância · Tempo · Ritmo **uma vez** (+ Em movimento só quando difere do tempo; na esteira, Velocidade). Depois: Como foi?, Tênis usado, Observação/Foto, recorde novo. Recolhíveis: **Parciais e etapas** (gráfico de ritmo, parciais, ritmo por bloco) e **Planejado × realizado e análise** (comparação, elevação, calorias, velocidade média, recordes, avaliação, próximo treino). Nenhum dado removido; a avaliação deixou de repetir elevação/calorias. | `resumo-corrida.test.js` |
| 7 | Corrida ativa pela arte 06 | Mapa no topo com **sinal do GPS sempre visível** (Excelente/Bom/Fraco); "INTERVALADO · ETAPA 4 DE 9"; cartão da etapa (nome, restante, barra, "Depois: …", Pular); **Tempo · Distância · Ritmo do mesmo tamanho** (tocar no ritmo alterna atual/médio); aviso "Dentro do ritmo / Reduza / Acelere"; rodapé preto-branco-cinza com **Pausar grande** no centro e **finalizar por toque prolongado** (anel que enche, legenda "Segure para finalizar", sem vermelho). Toque curto não encerra; segurar 1 s encerra. O mesmo rodapé vale na esteira. | `uso-real.test.js` |
| — | Esteira | "**Velocidade informada**" (a que a pessoa colocou; a distância usa este valor) separada do bloco "**Alvo desta etapa · <nome da etapa>**: 9,6 km/h · 5:55–6:37/km"; etiqueta "Dentro do alvo / Fora do alvo". A sugerida nunca aparece como medida. | `uso-real.test.js` |

Arquivos alterados nesta etapa: `treino-app.html`, `src/motor/atividades.js` (recálculo de recordes ao excluir atividade livre), testes listados acima e `tests/run.js`.

Não feito, de propósito:
- **Privacidade do mapa** no resumo (arte 07): hoje só existe no compartilhamento ("Ocultar início e fim"); pôr a linha no resumo sem função seria um botão falso.
- **Progresso**: sem redesenho (aguardando a composição definida com o ChatGPT).

Prints atualizados em `prints-revisao-uso-real/`: `corrida-ativa-430/320.png`, `pos-corrida-430/320.png`, `esteira-0X-*.png`.

**Validar no iPhone (navegador não substitui):**
1. Correr duas vezes no mesmo dia → as duas aparecem; o treino do plano conta uma vez.
2. Perfil → Privacidade e dados → "Recuperar corridas que não aparecem" (só aparece se houver gravações escondidas no aparelho) → conferir data/distância das recuperadas.
3. Excluir uma corrida que era recorde → recordes refeitos; km do tênis devolvido.
4. Resumo: seções recolhíveis abrem/fecham; "Excluir atividade" pede confirmação; fechar mantém salva.
5. Corrida ativa: segurar o botão de finalizar (com luva/suor), toque curto não encerra, sinal do GPS no topo, leitura das 3 métricas ao correr.
6. Esteira: rótulos "Velocidade informada" e "Alvo desta etapa".

---

## 11. Progresso (nova arte) — ajustes de conferência (08/10/2026)

- **Treinos do plano:** conta só sessões efetivamente geradas pelo motor. Semanas ainda não geradas não entram no total (antes repetiam a última semana) e o cartão mostra "planejamento parcial". Ex.: no Mês, com só a semana atual gerada, aparece "X de 7 · planejamento parcial".
- **Nomes da musculação:** nomes personalizados (modelos, títulos salvos que não sejam automáticos) são mantidos. "Superiores / Inferiores / Corpo inteiro" só substituem nomes automáticos/genéricos ("Treino de sexta", "Musculação"). Nenhum título salvo é regravado — a troca é só na exibição.
- **Recuperação:** sem check-in de hoje aparece **"Sem avaliação"** (nunca "Recuperação boa").
- **Mapa — PENDENTE DE VALIDAÇÃO NO IPHONE:** os prints foram feitos sem internet; as miniaturas e o resumo mostram só a rota sobre fundo neutro. Que o mapa real (OpenFreeMap) carregue no aparelho, inclusive com rede fraca, **não está comprovado** — conferir no iPhone (com internet e em modo avião).
