# Forza Run: Pausar plano, Lesões e limitações, Versões do plano, Encerrar plano

Relatório comparativo (07/10/2026). Nada disto está implementado. Nenhuma regra do motor muda enquanto você não aprovar.

## Regras que valem para as quatro funções

- Os 20 planos de referência (perfis dos testes) têm que continuar idênticos. Quem nunca usar estas funções vê o mesmo plano de hoje.
- Atividades, histórico, recordes, check-ins já feitos, quilometragem do tênis e carga **nunca** são apagados nem recalculados.
- Toda mudança entra no "Histórico de mudanças" com data, hora e motivo.
- Antes de qualquer mudança no plano, o app guarda uma versão (ver item 3).

---

## 1. Pausar plano

### Como funciona hoje
- O plano não pausa. A semana do plano é contada pelo calendário, a partir da segunda-feira de início (`startMonday`). Toda segunda a semana avança sozinha, treine você ou não.
- Dias não feitos aparecem como "treino perdido" (banner do Início, só na semana atual).
- O check-in semanal e o diário continuam sendo pedidos.
- Hoje a única pausa é a do questionário ("Vou procurar avaliação"), que só adia a **criação** do plano.

### Como fica (regras aprovadas)
- Menu Gerenciar plano tem **Pausar plano**. Na confirmação aparece só a data de início da pausa. O motivo é opcional (viagem, doença, lesão, outro).
- **Durante a pausa:**
  - a semana não avança;
  - os dias pausados aparecem como "Pausado" e não contam como perdidos;
  - o banner de treino perdido não aparece;
  - o check-in diário e o semanal não são pedidos;
  - o Início mostra "Plano pausado desde dd/mm" com o botão **Retomar**;
  - corrida livre e treino livre continuam podendo ser registrados. Entram no histórico e no Progresso, sem vínculo com o plano.
- **Retomar com até 14 dias:** o plano volta na mesma semana em que parou. A data de início do plano é empurrada pelo tempo da pausa, então as semanas seguintes também andam.
- **Retomar com mais de 14 dias:** o app propõe uma semana de retorno mais leve e mostra lado a lado o plano atual e a proposta. Só aplica depois que você confirmar. Se você recusar, o plano volta normal na semana em que parou.
- A pausa nunca mexe em atividades, histórico, recordes nem tênis.

### O que muda no motor e nos dados
- Novos campos no plano: `pausa` (ativa) e `pausas` (histórico de pausas).
- A rotina que avança a semana (`atualizarSemanaDoPlano`) passa a respeitar a pausa.
- A semana de retorno usa o mecanismo que já existe para o ajuste do check-in (`ajusteProximaSemana`: fator de volume e sem qualidade). Não é uma regra nova de treino, só um novo gatilho.

### Decisões que preciso de você
1. **Pausa no meio da semana.** Exemplo: pausou na quarta da semana 3 e voltou numa quinta.
   - **A (recomendo):** a semana 3 recomeça no dia da volta, só com as sessões que **não** tinham sido feitas antes da pausa, redistribuídas nos dias que restam. É a mesma regra de quando o plano é criado no meio da semana: 24 h entre sessões fortes e pernas protegidas.
   - **B:** a semana 3 recomeça inteira na segunda seguinte. Os dias até lá ficam livres.
2. **Semana de retorno (mais de 14 dias).** Minha proposta:
   - de 15 a 28 dias: volume da corrida a 80%, sem treino de qualidade, musculação com uma série a menos;
   - mais de 28 dias: volume a 70%, sem qualidade, e a sugestão (não automática) de refazer o questionário.

   Aprova esses números?

---

## 2. Lesões e limitações

### Como funciona hoje
- A dor só entra pelo questionário: região, intensidade (leve, moderada ou forte), se dói em repouso, e orientação profissional. Para mudar, é preciso refazer o plano inteiro.
- O motor já tem as regras e elas **não mudam**:
  - qualquer dor tira os treinos de qualidade da corrida;
  - dor moderada em joelho, tornozelo, quadril ou pé reduz o volume da corrida, e dor forte reduz para 60%;
  - cada região bloqueia os exercícios que a sobrecarregam (exemplo: joelho bloqueia agachamento, leg press, afundo e salto);
  - dor forte ou em repouso leva à etapa de segurança ("Antes de começar"), que bloqueia o plano até a resposta.
- O check-in semanal com dor reduz a semana seguinte (volume −20% e pernas aliviadas).

### Como fica (regras aprovadas)
- O menu Gerenciar plano ganha **Lesões e limitações**. A tela lista as limitações ativas e permite:
  - adicionar uma (região, intensidade, dor em repouso e data);
  - marcar uma como "melhorou".
- **Ao salvar:**
  - O app gera de novo a semana atual (só os dias que faltam) e marca as semanas futuras para serem geradas com a limitação. São as **mesmas regras do motor** de hoje.
  - Mostra o antes e depois de cada sessão afetada, com o motivo curto. Exemplo: "Qui · Intervalado 6×400 → Rodagem leve 30 min · dor no joelho".
  - Mudanças normais esperam sua confirmação.
  - Sessão arriscada e incompatível fica **bloqueada na hora**, mesmo antes de confirmar. Exemplos: intervalado ou agachamento com dor forte no joelho.
- **Dor forte ou em repouso** abre a etapa de segurança que já existe (liberado, vou procurar avaliação, continuar por conta própria). "Vou procurar avaliação" leva à **pausa** do item 1.
- **"Melhorou":** a volta ao normal é um aumento de carga. Por isso é sempre uma proposta com antes e depois, aplicada só depois da confirmação.
- Nenhuma atividade é apagada. Tudo entra no histórico de mudanças.
- O questionário continua sendo o mesmo lugar onde estes dados ficam. Esta tela é só um atalho que grava nos mesmos campos.

### O que muda no motor e nos dados
- **Regras do motor:** nada muda. Muda só o gatilho: hoje é o questionário, passa a ser também esta tela.
- **Dados:** cada limitação ganha data de início e de fim, para o histórico.

### Decisão que preciso de você
3. Ao marcar "melhorou", a volta ao normal deve ser:
   - **A (recomendo):** gradual, com uma semana intermediária (sem qualidade, volume 90%) e depois o plano normal;
   - **B:** direta, só com a confirmação.

---

## 3. Versões do plano

### Como funciona hoje
- Não existem versões:
  - "Refazer meu plano" substitui o plano antigo, que se perde;
  - o check-in reescreve as semanas futuras.
- O histórico de mudanças guarda só o texto do que mudou, não o plano anterior.

### Como fica (regras aprovadas)
- O app guarda **todas** as versões relevantes, sem limite silencioso. Uma versão é criada:
  - antes de refazer o plano;
  - antes de revisar o questionário;
  - antes de um ajuste do check-in;
  - antes de mudar lesões;
  - antes de pausar ou retomar com semana de retorno;
  - antes de reorganizar a semana;
  - antes de restaurar outra versão;
  - antes de encerrar o plano.
- Cada versão guarda:
  - data e hora;
  - versão do motor;
  - motivo e origem (exemplo: "Check-in da semana 4");
  - resumo da mudança;
  - a parte de **planejamento**: semanas, estrutura, datas, zonas usadas e respostas do questionário que geraram o plano.
- **Restaurar** troca só o planejamento, de hoje em diante:
  - atividades, recordes, check-ins, histórico, tênis, carga e progresso não mudam;
  - dias passados continuam como foram;
  - entra no histórico "Versão anterior restaurada";
  - o plano que estava em uso também vira uma versão, então dá para desfazer.
- No **Histórico de mudanças**, cada item que tiver versão mostra "Ver versão" e "Restaurar". Restaurar pede confirmação.

### O que muda nos dados
- Novo armazenamento separado, a chave `planoVersoes`, no mesmo armazenamento do app, no aparelho.
- Ela entra no backup (Exportar e Importar) e na sincronização com a conta, igual ao plano.
- **Tamanho:** cada versão tem de 30 a 80 KB. Com um check-in por semana, um plano de 12 semanas gera umas 15 a 20 versões, cerca de 1 a 1,5 MB. Sem problema no iPhone.

### Decisão que preciso de você
4. Ao restaurar uma versão antiga, a contagem de semanas:
   - **A (recomendo):** segue a data de início da versão restaurada (o plano volta exatamente como era);
   - **B:** recomeça a versão restaurada na semana atual.

---

## 4. Encerrar plano

Ainda **não há regra aprovada**. Esta é a proposta.

### Como funciona hoje
- Não há como encerrar. Só dá para refazer.
- Quando a última semana termina, a agenda simplesmente fica vazia, sem aviso.

### Proposta
- **Encerrar plano**, no menu Gerenciar plano, com confirmação:
  - remove só as sessões planejadas de hoje em diante;
  - os dias passados, as atividades e o histórico ficam;
  - o plano encerrado vira uma versão (origem "encerrado"), então pode ser restaurado;
  - o Início volta para "Você ainda não tem um plano", com Criar meu plano e Só quero registrar.
- **Fim natural do plano:** quando a última semana termina, o app mostra "Plano concluído", com o resumo do período, e duas opções:
  - **Criar próximo plano**: abre o questionário já preenchido, sem perder nada;
  - **Agora não**.

### Decisão que preciso de você
5. Aprova as regras de Encerrar e de "Plano concluído" acima?

---

## Ordem de implementação proposta

Cada passo vira um commit próprio, com testes. O critério é: os 20 planos de referência ficam idênticos, nada é apagado e o histórico registra tudo.

1. **Versões do plano.** Base para as outras: guardar, listar e restaurar.
2. **Pausar e Retomar**, com a semana de retorno.
3. **Lesões e limitações**, com o antes e depois e o bloqueio imediato.
4. **Encerrar plano** e "Plano concluído".
5. **Itens no menu Gerenciar plano.** Cada um só aparece quando estiver funcionando, nada de "em breve".

## Resumo das decisões

| # | Assunto | Recomendação |
|---|---------|--------------|
| 1 | Pausa no meio da semana | A: recomeça no dia da volta, só com o que faltou |
| 2 | Semana de retorno | 15–28 dias: 80%, sem qualidade, −1 série; mais de 28 dias: 70% e sugestão de refazer |
| 3 | Volta depois de "melhorou" | A: gradual, com uma semana intermediária |
| 4 | Restaurar versão antiga | A: segue a data de início da versão |
| 5 | Encerrar e Plano concluído | Aprovar a proposta acima |
