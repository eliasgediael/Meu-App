# Testes do Forza Run

Rede de segurança do Passo 0 (ver `VALIDACAO-PLANO-MESTRE-FORZA-RUN.md`). Os testes registram o comportamento atual do app; eles não julgam se esse comportamento está certo.

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Roda tudo: testes em Node e de navegador. Os de navegador são pulados se não houver Google Chrome |
| `npm run test:node` | Só os testes em Node (cerca de 45 s) |
| `npm run comparar` | Antes/depois: compara o resultado atual com os snapshots aprovados e mostra o que mudou em cada perfil |
| `npm run snapshots:atualizar` | Regrava os snapshots com o código atual. Use só depois de aprovar a mudança mostrada por `comparar` |

## Estrutura

- `harness/app-node.js`: roda o `treino-app.html` inteiro no Node. Usa DOM mínimo, IndexedDB simulado, Firebase falso, relógio congelado e fuso de Brasília.
- `harness/carregar.js`: carrega o app numa data fixa (segunda 05/10/2026, 10:00) e devolve as funções pedidas.
- `harness/perfis.js`: os 20 perfis sintéticos (respostas do questionário).
- `harness/snapshot.js`: grava e compara snapshots. Ids e carimbos de tempo são ignorados.
- `harness/navegador.js`: Chrome headless com perfil limpo e os dados de `fixtures/semana3.json`.
- `node/legado/`: testes que já existiam antes do Passo 0, trazidos da pasta temporária:
  - `b1tests` (8 cenários de dados, nuvem e GPS);
  - `e2tests`, `e3tests`, `e4tests`;
  - `descansotest`, `bibtest`;
  - `matriz` (20 perfis).
- `node/planos-dourados.test.js`: o plano completo de cada um dos 20 perfis, da semana 1 ao fim do bloco.
- `node/caracterizacao-*.test.js`: motor (V1–V10, ajustes, semana parcial, alertas, check-in), treinador, musculação e atividade/dados.
- `navegador/`: histórico, correção, corrida concluída, artes e catálogo, testados num Chrome real.
- `snapshots/`: comportamento aprovado (41 arquivos).

## Regra

Toda mudança no motor precisa manter `npm test` verde. Quando um plano mudar de propósito, mostre o resultado de `npm run comparar` e só regrave os snapshots depois da aprovação.
