# Relatório da rodada autônoma de 30/10/2026

Trabalho feito com o app fechado para o dono: IA, motor, Configurações e revisão visual. Tudo está em commits locais da branch
`visual-pacote-2026-10-15`, em ordem, para poder desfazer cada assunto separadamente. Nada desta rodada foi enviado ao GitHub.

## O que mudou

### IA (com medição no Gemini real)
- **Segunda chance** (`src/ia/refino-v2.js`, `functions/src/refinar.js`): se a validação do app reprova a resposta, a IA recebe a lista de
  erros e corrige uma vez. O servidor confere o campo novo `reparo`.
- **Saneamento** (`src/ia/saneamento.js`): dois movimentos iguais no mesmo dia (o erro F5 mais comum) voltam ao exercício do motor, em vez
  de reprovar a semana inteira. Os validadores continuam sendo a barreira de segurança.
- **Prompt em modo variedade** e temperatura 0,7 (`functions/src/prompt.js`, `functions/src/refinar.js`). Worker `forza-ia` publicado com isso.
- Medição (3 perfis × 3 semanas, mesmo método, Gemini real):

  | | Antes | Depois |
  |---|---|---|
  | Semanas aceitas pelos validadores | 5 de 9 | 9 de 9 |
  | Exercícios trocados | 6 | 59 |
  | Semanas com corrida diferente do motor | 2 | 9 |

- A IA só age com **login** no app (o Worker confere o token do Firebase). Sem login, o plano é o do motor.

### Motor
- **Não foram mexidas as regras do motor.** A rotação de acessórios a cada 2 semanas que eu havia feito foi desfeita a pedido.
- Auditoria: 340 perfis aleatórios do questionário, todas as semanas de cada plano. Nenhuma exceção, semana vazia, exercício repetido no dia,
  sessão em dia indisponível, série ou duração absurda. O motor é estável; o problema dele é de qualidade (plano genérico), não de defeito.
- **Erro de dado corrigido:** "Agachamento livre" e "Cadeira (wall sit)" usavam o registro "potty squat" do catálogo, com abdômen como
  músculo principal. Agora valem quadríceps no mapa muscular, na Biblioteca e na busca por músculo.
- Continuam como estavam (decisões antigas): a quantidade de dias copia a frequência declarada hoje; o dia de perna pesada vira corpo
  inteiro quando não encaixa com corrida forte; a musculação não tem semana de descarga.

### App (visual e uso)
- Botão de play no meio da barra inferior (começa o treino de hoje).
- Biblioteca com "Por músculo": toque no corpo e só os exercícios cujo músculo principal é aquele.
- Faixa de dias da aba Treino com os ícones de corrida, musculação, descanso e concluído.
- Campos de tempo e pace com ":" automático (o teclado numérico do iPhone não tem a tecla).
- Corpo feminino no mapa muscular, com a escolha em Configurações → Aparência.
- Configurações em páginas (categorias com ícone colorido, no estilo do openGym), com os mesmos controles de antes, e **busca** nas Configurações.
- **1RM estimado** (fórmula de Epley, da melhor série de 1 a 12 repetições) na aba Histórico do exercício, na Biblioteca.
- Limpeza de texto: "Semana N" repetido no cartão de musculação, frase longa do estado vazio do Progresso e botão que repetia a aba
  Treino, marca do app fora do Progresso, frase da tela de GPS, chevron colado no texto dos cartões de nível do Perfil, rótulo
  "Meu histórico" que quebrava linha.

## O que não foi feito
- Troca do ícone do app (exige plugin nativo e só se valida compilando no GitHub Actions).
- Nada foi testado em aparelho.
- Os snapshots do motor (planos dourados e afins) seguem diferentes do salvo. Eram assim antes desta rodada, por alterações anteriores do motor.

## Para continuar
- Fazer login no app (Perfil → Configurações → Conta e sincronização) para a IA entrar em ação.
- Revisar os snapshots do motor e decidir se atualiza.
- Subir para o GitHub e gerar o IPA quando aprovar.
