# FORZA RUN — etapas 3 a 8 — 14/10/2026

Prévia local validada, IA desativada. Publicação do código e geração de IPA foram autorizadas posteriormente pelo usuário; não foi autorizado deploy de servidor, Worker ou ativação da IA. O usuário tornou o repositório público.

## Estado confirmado antes de editar

Contrato v2, menus e validadores R0–R9/J1 já estavam escritos. O servidor compartilhado só aceitava v1; os testes de IA, exceto histórico, não estavam no executor principal. A proteção de aplicação tardia só comparava musculação. Etapas 1 e 2 foram preservadas. O Git diff já continha mudanças anteriores do motor, Garmin, interface e dependências; não foram revertidas.

## Entrega por etapa

| Etapa | Resultado |
|---|---|
| 3 | Contrato conjunto integrado ao refinador compartilhado Firebase/Cloudflare; seleção de esquema e prompt por versão. V1 preservado. Firebase simulado aceita v2. |
| 4 | Matriz dos 20 perfis e testes negativos de R0–R9, J1, F0–F9 e validação conjunta V1–V10. Nenhuma regra do Motor V2 foi alterada por esta continuação. |
| 5 | Prompt v2 para avaliar corrida e musculação conjuntamente, usar somente menus/ids do motor, evitar dupla redução, distinguir ausência de dados de desempenho ruim e pedir progressão sem aplicar aumento. |
| 6 | Testes de segurança, regressão, qualidade estrutural, transporte, cotas, cache inválido, respostas truncadas e fallback. |
| 7 | Zero chamadas reais. Não foi possível comprovar que a conta/modelo Gemini está estritamente no nível gratuito e sem cobrança. Não foram lidas ou expostas chaves locais. |
| 8 | Bundle no app, geração inicial e semana nova; leitura assíncrona GPS; aplicação inteira validada; bloqueios por edição anterior/tardia, treino iniciado, troca de conta/dia, pausa e opt-out. Persistência local da semana em um registro único com recuperação conservadora. |

## Testes e falhas anteriores

Linha de base: 1.755 PASS / 9 FAIL, antes das edições.
Regressão final com navegador: 2.651 PASS / as mesmas 9 FAIL, em 262 s. Nenhum teste de navegador foi pulado. Mais 3 testes de exemplos e 3 verificações de compilação executados separadamente passaram (2.657 verificações aprovadas considerando essas execuções adicionais).

Falhas antigas, não ocultadas e não corrigidas mediante alteração de snapshots:
- planos dourados: plano-03, plano-06, plano-07, plano-08, plano-09, plano-12, plano-19, plano-20;
- caracterização do motor: motor-checkin-semanal.

Testes v1: 48 validador, 37 refino, 25 função, 161 Worker. Testes v2: 425 matriz/orquestração, 26 servidor/Firebase/Worker, 24 aplicativo, 44 regras. Foram encontrados erros nas expectativas iniciais dos novos testes, corrigidos e repetidos; a última rodada não tem falhas novas. O executor mantém exit code 1 por causa das 9 falhas antigas.

Detalhes por arquivo: ia-v2-testes-resultado.json. Exemplos: ia-v2-exemplos.json.

## Arquivos alterados nesta continuação

- src/ia/contrato-v2.js: remove indicadores de dor do resumo externo sem mudar o histórico local.
- src/ia/config.js: trava publicacaoAutorizada=false e URL vazia, além de ativa=false.
- src/ia/aplicar.js: protege corrida em propostas v2, preservando v1.
- src/ia/validador.js: exige campos obrigatórios próprios do objeto; não aceita campos herdados.
- src/ia/validador-corrida.js: tamanho real UTF-8; mantém metadados das sessões coerentes com a semana conjunta validada.
- src/ia/app-v2.js (novo): integração assíncrona, montagem pura, verificação da agenda, commit local integral e recuperação.
- src/ia/index.js, src/motor/index.js: exportam e empacotam a integração.
- src/motor/motor-v2.js, src/motor/plano-vivo.js: apenas gatilhos da IA após salvar o plano; perfil parcial da semana inicial preservado. Alterações anteriores do motor mantidas.
- treino-app.html: preferência no Perfil e recuperação local; mostra Em validação e não permite ativar a IA.
- functions/src/refinar.js: v1/v2, esquema por versão, barreiras de corrida/saúde/GPS, revalidação do cache e limpeza do timer.
- functions/src/prompt.js: instruções conjuntas v2; prompt v1 preservado.
- functions/src/validacao-esquema.js (novo): barreira estrutural do servidor.
- functions/src/esquema-gemini.js (novo), worker/src/gemini.js: conversor já existente compartilhado entre Firebase e Worker; esquema local mantém todos os limites.
- functions/index.js: esquema adaptado, simulador v2 e mensagem interna de erro sem detalhes sensíveis.
- tests/harness/ia.js: expõe funções v2 para os testes.
- tests/run.js: registra todas as suítes IA; suporta --filtro e --relatorio.
- tests/node/ia-v2.test.js, ia-v2-servidor.test.js, ia-v2-app.test.js, ia-v2-regras.test.js, ia-v2-exemplos.test.js, ia-v2-build.test.js (novos).
- docs/ia-v2-arquivos-protegidos.json, docs/ia-v2-testes-resultado.json, docs/ia-v2-exemplos.json e este relatório (novos).

## Preservação e segurança

Backup backups/etapas3a8-2026-10-14/ preservado. Foram conferidos hashes de 71 arquivos entre backup e snapshots: nenhum mudou. Mudanças anteriores do Claude foram mantidas. Nenhum pace, distância, intensidade ou carga foi criado pela IA. O motor monta todas as opções. F0–F9, V1–V10 e R0–R9 permanecem bloqueantes conforme suas regras existentes.

App ativa=false, publicacaoAutorizada=false, servidorUrl vazio. Worker IA_ATIVA=false e Firebase IA_ATIVA default=false. Sem deploy, sem alteração de planos pagos e sem chamadas reais Gemini. Segredos .dev.vars, .secret.local e .env.local ficam fora do commit. Fotos, prints e backups locais não entram na prévia publicada.

A atomicidade local utiliza um único registro localStorage antes da troca síncrona de corrida, musculação e plano. As cópias nos armazenamentos legados podem ser recuperadas conservadoramente se estiverem parcialmente gravadas. Não há transação única entre documentos Firestore; a IA está desligada e a validação de sincronização em dispositivos reais continua pendente.

## Exemplos fictícios

Os três exemplos JSON foram montados pelo Motor V2 e por propostas SIMULADAS aprovadas nos validadores; não são respostas reais do Gemini. A musculação usa séries, repetições e descansos já autorizados pelo motor, RPE dentro do teto e carga vazia. A corrida usa sessões reais montadas pelo motor, inclusive aquecimento e desaquecimento. Nunca usar estes perfis como prescrição para uma pessoa real.

## Pendências e prévia iOS

- Validar qualidade de respostas reais Gemini somente após comprovação de configuração gratuita sem cobrança.
- Testar execução e recuperação em iPhone, GPS real e Garmin físico; nenhum teste em Node substitui esse teste.
- Reavaliar as 9 diferenças antigas de snapshots em tarefa própria; não foram mascaradas.
- Compilar IPA pelo workflow existente em runner padrão de repositório público. O IPA é SEM ASSINATURA e precisa de assinatura para instalação.
- Nova correção Garmin indicada pelo usuário: C:/Users/CONTABIL/Downloads/Projetos/Garmin Connect IQ/correcao-app-todas-semanas/. O usuário pediu publicar esta prévia primeiro e revisar essa integração depois. Ela ainda não foi aplicada nesta prévia.

## Reprodução

node tests/run.js --relatorio
node tests/run.js --sem-navegador --filtro=ia-v2

A primeira execução termina com código 1 pelas 9 falhas anteriores; as suítes novas terminam com código 0.
