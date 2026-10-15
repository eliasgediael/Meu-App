# Personalização da musculação com Gemini — etapa 1 (estrutura, contratos, validadores, testes)

Status em 2026-10-13: **desligado**. Nada foi publicado, nenhum serviço pago foi ativado e nenhuma chamada real ao Gemini foi feita.
O app continua usando só o Motor V2; nenhum arquivo existente foi alterado nesta etapa.

## Fluxo

```
Questionário V2 → Motor V2 (plano da semana) → Cloud Function refinarTreino → Gemini (JSON com esquema)
               → validação determinística no app (F0–F9 + validarPlano) → plano final
               └─ qualquer falha: fica o plano do Motor V2, sem alteração
```

| Peça | Arquivo |
|---|---|
| Configuração do app (desligada) | `src/ia/config.js` |
| Consentimento (dados + texto da futura tela) | `src/ia/consentimento.js` |
| Contexto do motor, exercícios autorizados, limites, pedido minimizado | `src/ia/contrato.js` |
| Validadores F0–F9 e montagem da semana final | `src/ia/validador.js` |
| Orquestração com fallback | `src/ia/refino.js` (`iaRefinarSemana`) |
| Esquema da resposta (fonte única: Gemini e app) | `functions/src/esquema-resposta.json` |
| Lógica da função (login, consentimento, cotas, cache, tempo-limite) | `functions/src/refinar.js` |
| Instrução de sistema | `functions/src/prompt.js` |
| Cotas e cache no Firestore | `functions/src/armazem-firestore.js` |
| Cloud Function (não publicada) | `functions/index.js`, `functions/package.json`, `firebase.json`, `.firebaserc` |
| Testes | `tests/node/ia-validador.test.js`, `ia-refino.test.js`, `ia-funcao.test.js`, `tests/harness/ia.js` |

## Contrato

**Pedido (app → função)**: `{ consentimento:true, pedido }`. O `pedido` leva só:
faixa etária, nível, objetivo, modalidade principal, situação, retomada/calibração, prontidão, padrões dominados,
regiões de dor (só com aceite de saúde, só o código: `joelho`, `ombro`...), dias de musculação com minutos, foco,
corrida do dia e se há corrida dura perto, limites por papel, plano do motor, exercícios autorizados e um resumo do
histórico (tendência, repetições médias, PSE médio, check-ins, aderência — sem datas e sem kg).
Nunca vão: nome, e-mail, uid, foto, data de nascimento, sexo, peso, altura, GPS, frequência cardíaca, sinais de alerta.

**Resposta (Gemini)**: `{ versao:'1', dias:[{ dia, exercicios:[{ id, papel, series, reps, rpe, descansoSeg }] }], motivos:[código] }`.
Sem carga em kg (a progressão continua no `forca.js`) e sem texto livre (só códigos de motivo de uma lista fixa).

**Ids**: o id do catálogo quando é único no POOL; senão uma chave estável derivada do nome (`n` + hash).
Motivo: no POOL há 4 exercícios sem id e 13 ids usados por mais de um nome.

## Validadores

| Código | Regra |
|---|---|
| F0 | Esquema, tipos, tamanho (24 KB), campos não previstos (inclui `__proto__`) |
| F1 | Exercício só por id da lista autorizada (filtro do motor: dor, equipamento, padrões dominados, tier) |
| D1 | Mesmos dias de musculação do motor (sem criar, remover ou repetir dia) |
| F2 | Séries e RPE nunca acima do que `motorEsquema` daria (nível, papel, foco, retomada, calibração, fator da semana); reps e descanso em faixa provisória; no máximo 1 base, só composto |
| F3 | Tipo da sessão recalculado pelo conteúdo (séries de perna composta); dia de perna do motor com perna continua dia de perna |
| F4 | Duração recalculada (`estimateWorkoutMinutes` + aquecimento) dentro dos minutos do dia |
| F5 | Tier do nível, sem repetir exercício nem família, no máximo `motorQtdExercicios` |
| F6 | Total de séries da semana ≤ total do motor (a IA redistribui, não aumenta). F6b: faixas por grupo, desligadas |
| F7 | Iniciante sem dia de perna pesado; nenhum dia de perna novo com alívio de inferiores/sono reduzido ou perto de corrida dura; dia com corrida ou perto de corrida dura não ganha carga de perna; dia de perna perto de corrida dura não ganha exercício |
| F8 | Sem carga: `carga:''` sempre |
| F9 | Ids em formato restrito; motivos só da lista |
| V1–V10 | `validarPlano()` do motor na semana inteira, com tipo e duração recalculados |

Exceções só para o que o próprio motor já faz no mesmo dia: família repetida (duas panturrilhas no dia de perna do avançado)
e exercício base não composto ("Panturrilha no leg press" escolhido como base pelo slot de joelho do iniciante).

## Volume semanal

Limites atuais do motor: exercícios por sessão 5/6/7 (iniciante/intermediário/avançado), no máximo 4 em manutenção e suporte à
corrida; séries por papel em `HYBRID_PAPEL_SCHEME` (3–4), força com base 5×5; retomada −1 série; calibração ×0,85 nas
semanas 1–2; descarga da musculação desligada; teto de dias 3/4/4; cortes por tempo (isolador → séries de auxiliar → acessório).
Não existe orçamento de séries por grupo muscular (desligado por decisão).

Volume real do motor nos 20 perfis (séries/semana): Pernas domina — avançado 04: Pernas 56, Peito 8; força 10: Pernas 34,
Peito 10; iniciantes de 1 dia: 3 séries de peito, costas e ombro.

Faixas propostas para F6b (séries/grupo/semana, só aviso, **desligadas**): iniciante 4–10, intermediário 6–14, avançado
8–20, manutenção 3–8; quem corre com prova: Pernas nunca acima do motor. Ligadas como bloqueio, reprovariam o próprio motor
(Pernas acima de 20 em 04, 10, 13 e 16), por isso ficam como aviso até teste comparativo e aprovação.

## Consentimento (LGPD)

`athleteProfile.meta.consentimentoIA = { versao, aceito, incluirSaude, decididoEm, revogadoEm }`.
Estados: pendente, aceito, recusado, revogado, desatualizado (texto mudou → pede de novo). Dados de saúde têm aceite separado.
Sem aceite válido, o app nunca chama a função; a função também exige `consentimento:true`. A tela ainda não existe.

## Para ativar (etapas futuras, cada uma com aprovação)

1. Plano Blaze no projeto `treino-app-5a07f` e chave em uma conta **paga** do Gemini (no nível gratuito o Google pode usar os dados).
2. `npm install` em `functions/`; `firebase functions:secrets:set GEMINI_API_KEY`.
3. Regras do Firestore: negar leitura/escrita do app em `iaUso`, `iaUsoGlobal` e `iaCache`.
4. Deploy da função com `IA_ATIVA=false`, teste com o emulador, depois `IA_ATIVA=true`.
5. Arquivos existentes a alterar (a apresentar antes): `src/motor/index.js` (importar `src/ia`), `treino-app.html`
   (SDK `firebase-functions-compat`, chamada em `gerarPrimeiroPlanoV2`/semana nova, tela de consentimento e opção no Perfil),
   `tests/run.js` (registrar os 3 testes novos), `.gitignore` (`functions/node_modules`).
6. `IA_CONFIG.ativa = true` no app.
