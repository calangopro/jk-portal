# Pedidos da Tray no portal, sem API

A Tray ainda não liberou a API para a JK. Enquanto isso, os pedidos chegam ao
portal pela exportação do próprio painel da Tray: alguém (ou a rotina
programada) exporta dois arquivos e roda um comando. O dado é da Tray, com
status, forma de pagamento, cupom e origem. Quando a API chegar, ela troca
este caminho e a tabela continua a mesma.

Percorrido e conferido em 12/11/2026. O total do dia 11/11 saiu
R$ 3.883,38, igual ao relatório que a equipe manda no WhatsApp.

## Antes de começar

- Chrome aberto, com o painel da Tray já logado (loja 1305187).
- Se abrir a tela de login, **pare e avise o Filipe**. Senha ninguém digita
  por rotina.
- A pasta de downloads do Chrome é `~/Downloads`.

## Passo a passo

1. Abra `https://www.jkaliancas.com.br/admin/sales/orders` (Vendas, Lista de
   pedidos).
2. Na linha de filtros, o primeiro botão é o período (ícone de calendário).
   Clique nele, escolha **Últimos 30 dias** e clique em **Aplicar**, que fica
   no pé do calendário. Se o botão não aparecer, role a página um pouco.
3. Confira os outros três filtros: **Pedidos: Todos**, **Status: Todos**,
   **Canal de venda: Todos**. Se algum estiver diferente, clique em
   **Limpar filtros** e refaça o passo 2.
4. Clique em **Exportar pedidos**, no alto à direita.
5. Na janela, marque **Pedidos** e **Produtos vendidos**. Deixe
   **Exportar itens filtrados na lista** selecionado. Clique em
   **Solicitar exportação**.
6. Feche o aviso "Estamos processando sua solicitação" e espere uns dez
   segundos.
7. Clique no sino, no alto. Na aba **Notificações do sistema** aparecem dois
   cartões novos no topo, um de "Pedidos" e um de "Produtos Vendidos", com
   "há poucos segundos". A ordem entre eles muda de uma vez para a outra.
   Clique em **Baixar arquivo** nos dois. O painel de notificações fecha depois
   de cada clique, então abra o sino de novo para o segundo.
8. Confira que chegaram em `~/Downloads`, com a hora de agora:
   - `pedidos_1305187_<código>.csv`
   - `produtos_vendidos_1305187_<código>.csv`
9. Na pasta do projeto, rode:

   ```bash
   npm run vendas:importar
   ```

10. Leia a saída. Ela diz o período, quantos pedidos são novos, quantos
    mudaram de status e o total pago de cada um dos últimos dias. Depois de
    importados, os dois arquivos vão para `~/Downloads/tray-importados/`.
11. Feche a aba da Tray.

## Cuidados que já custaram tempo

- **O filtro de período fica gravado no navegador.** Em 12/11 ele estava em
  12 de maio a 10 de agosto, e por isso cinco exportações seguidas tinham
  vindo com pedidos velhos. Sempre refaça o passo 2.
- **Notificação antiga continua na lista por 48 horas.** Baixe só os dois
  cartões do topo. Os de baixo são de exportações anteriores.
- **Trinta dias, e não só hoje, de propósito.** Pedido muda de status depois:
  o Pix que não foi pago vira "Cancelado aut", o cartão recusado vira
  "Cancelado". Reimportar os últimos trinta dias é o que corrige o passado.
- **Período maior que 90 dias** pede ligar a chave "Habilitar períodos
  anteriores à 90 dias", no alto do calendário.
- **O comando recusa arquivo velho.** Se o `pedidos_*.csv` mais novo tiver mais
  de 30 minutos, ele para e avisa, porque isso quase sempre quer dizer que o
  download não aconteceu. Para importar um arquivo antigo de propósito, passe
  o caminho: `npm run vendas:importar -- caminho/pedidos.csv caminho/produtos.csv`.

## O que conta como venda

A Tray cria o pedido antes do pagamento. De maio a novembro de 2026, 43% dos
pedidos criados foram cancelados depois. Por isso o portal guarda o status e
classifica cada pedido em uma de três situações:

| Situação | Status da Tray | Entra no faturamento |
|---|---|---|
| `pago` | A enviar, Enviado, Finalizado, A retirar, Problemas na entrega | Sim |
| `aguardando` | Aguardando pagamento | Não |
| `cancelado` | Cancelado, Cancelado aut | Não |

Status que a Tray criar no futuro cai em `pago`, a não ser que comece com
"Cancelado" ou contenha "Aguardando pagamento". A regra mora em
`situacaoDoStatus`, em `src/lib/vendas/tray-csv.ts`.

## O que vem em cada arquivo

**Pedidos** (47 colunas, uma linha por pedido): número, data e hora, cliente,
subtotal, frete, forma de pagamento, data do pagamento, status, parceiro,
cupom, desconto, total, cidade e estado, e a origem (coluna "UTM Source").

**Produtos vendidos** (10 colunas, uma linha por item): código do produto na
Tray (o mesmo `tray_id` do catálogo do portal), número do pedido, nome,
referência, quantidade, preço de venda e preço de custo.

O portal **não guarda** CPF, CNPJ nem endereço. Guarda nome, e-mail e telefone
do cliente, que é o que liga o pedido ao atendimento na Kommo.

A coluna "Parceiro" não é vendedor. São os catálogos: 1516 é o do Facebook e
Instagram, 1517 é o do Google Shopping.

## Onde fica no banco

- `tray_pedidos`: um pedido por linha, com os itens na coluna `itens`.
- `tray_itens_vendidos`: os mesmos itens, um por linha, para somar por produto.
- `sync_logs` com `source = 'tray_pedidos'`: cada importação, com hora e
  resultado.

Só administrador lê. Quem grava é o comando, com a chave de serviço.

A tela que mostra tudo isso é `/admin/vendas` (menu Resultado, Vendas), só
para administrador. As somas dela saem da função `resumo_de_vendas`.

## Rotina programada

A tarefa "JK: pedidos da Tray" roda este passo a passo sozinha, de hora em
hora, das 8h às 23h, no Mac do Filipe, pelo Claude no Chrome. Ela depende de três coisas: o Mac ligado, o
Chrome aberto e a Tray logada. Se uma delas falhar, a rodada falha e a próxima
recupera, porque cada importação traz os últimos trinta dias inteiros.
