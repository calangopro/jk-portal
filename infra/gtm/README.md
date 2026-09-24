# GTM do site (GTM-WWT3T789)

O contêiner é o **mesmo da loja Tray**. Tudo que mudar aqui vale para a loja e
para o portal ao mesmo tempo. Conta do GTM: **JK ALIANÇAS (6221062229)**,
contêiner "WEB - ECOMMERCE - OFICIAL" (217728559).

Levantado em 24/09/2026 a partir da exportação do espaço de trabalho 27 (versão 24 no ar).

## Como a medição está dividida

| Ferramenta | Loja | Portal (`/guias`) |
|---|---|---|
| GA4 (G-9V89YVR635) | integração nativa da Tray, fila `dataLayerGa4` | carregado pelo código (`Medicao.tsx`), fila `dataLayerGa4` |
| Google Ads (AW-16750399342) | GTM | GTM |
| Pinterest (2612456931453) | GTM | GTM |
| Meta Pixel | GTM, tudo pausado e sem ID (`0000`) | nada |

**Nunca despausar as tags da pasta "🟠GA4 V4COMPANY".** O GA4 já chega pelos
dois lados sem o GTM. Ligar aquelas tags contaria cada visita duas vezes.

## O que o portal manda para o `dataLayer`

```js
{ event: "clique_whatsapp", destino: "guarulhos", posicao: "conteudo",
  url: "https://wa.me/...", origem: "/lojas/guarulhos" }
```

| Evento | Quando |
|---|---|
| `clique_whatsapp`, `clique_telefone`, `clique_rota`, `clique_waze` | Contato com uma loja física. `destino` é o slug da unidade |
| `clique_produto` | Qualquer link para a loja online. `destino` é o produto ou o lugar do link |
| `clique_loja`, `clique_guia` | Chamada para ação no corpo do guia |

`posicao` é `cabecalho`, `rodape` ou `conteudo`. Nenhum desses nomes colide com
as 80 variáveis de camada de dados que o contêiner já tinha (conferido).

## Regras da casa para mexer neste contêiner

Vêm do Trello (quadro "🧠 JK Alianças | ADM") e valem para qualquer pessoa ou IA:

- **Uma mudança lógica por versão**, com o nome da versão dizendo qual é.
- Antes: exportar a versão no ar. Depois: Visualizar, conferir no destino
  (Pinterest, Google Ads...) e registrar um cartão na lista **RELATÓRIO DE
  MUDANÇAS**, com o "para voltar".
- Importação de arquivo: sempre **Combinar**, nunca "Substituir" (que é a
  opção marcada de fábrica e apaga o espaço de trabalho inteiro). Antes,
  conferir "Alterações no espaço de trabalho: 0", senão a mudança de outra
  pessoa vai junto na publicação.
- Mudança no GTM só com aprovação do Filipe.
- **Não corrigir o `AW-AW-16750399342` (WM-025).** A conversão de compra que
  vale é a da integração nativa da Tray, com o ID certo. A do GTM é uma segunda
  conversão, e consertá-la contaria a venda em dobro. A proposta registrada é
  pausar as tags de Google Ads do GTM, não corrigir. O sinal de compra parado
  desde 17/09 é outra coisa: o app Google Ads da Tray desconectou, e a
  reconexão está com a Tray. Ninguém clica em "Comece já" no app da Tray.
- As "2 atualizações de modelo" que o GTM oferece não foram aceitas de
  propósito.

## O portal não precisa de nada neste contêiner

Decidido em 24/09. O que o portal mede (visita, clique para a loja, contato com
loja física) vai para o **GA4 direto**, pelo código. O GTM já carrega no portal
e já faz, sem mudança nenhuma:

- **Pinterest**: a tag base e o Page Visit rodam em todas as páginas do
  domínio, `/guias` incluído. Quem lê as dicas já entra no público do Pinterest,
  e o Carlos pode usar isso em remarketing criando um público por URL que
  contenha `/guias`.
- **Google Ads**: o remarketing também roda no portal (com o `AW-AW-` acima).

Foi testado e descartado um evento `lead` do Pinterest para os cliques de
WhatsApp, telefone e rota do portal. O anúncio do Pinterest leva a pessoa para
a loja, não para o portal, então esse evento não servia às campanhas.

## Opcional, depois: contato pelo portal como conversão no Google Ads

Duas formas, e a primeira é mais simples:

- **Importar do GA4.** No Google Ads, Metas → Conversões → Nova ação →
  Importar → Google Analytics 4, escolhendo `clique_whatsapp` e os outros
  contatos (precisam estar marcados como eventos-chave no GA4 antes).
- **Tag no GTM.** Criar a ação de conversão no Google Ads, pegar o rótulo e criar
  uma tag "Acompanhamento de conversões do Google Ads" com `{{ID GOOGLE ADS 1.0}}`,
  esse rótulo e o acionador "JK Portal - Lead loja física".

Nos dois casos, marcar a ação como **secundária**. Como principal, ela passaria
a orientar os lances das campanhas de venda com clique de WhatsApp.
