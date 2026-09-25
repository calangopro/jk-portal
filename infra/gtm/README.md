# GTM do site (GTM-WWT3T789)

O contêiner é o **mesmo da loja Tray**. Tudo que mudar aqui vale para a loja e
para o portal ao mesmo tempo. Conta do GTM: **JK ALIANÇAS (6221062229)**,
contêiner "WEB - ECOMMERCE - OFICIAL" (217728559).

Levantado em 24/09/2026 a partir da exportação do espaço de trabalho 27 (versão 24).
Versão no ar desde 25/09/2026: **25** (pixel do Meta no portal e na bio).

## Como a medição está dividida

| Ferramenta | Loja | Portal (`/guias` e `/bio`) |
|---|---|---|
| GA4 (G-9V89YVR635) | integração nativa da Tray, fila `dataLayerGa4` | carregado pelo código (`Medicao.tsx`), fila `dataLayerGa4` |
| Google Ads (AW-16750399342) | GTM | GTM |
| Pinterest (2612456931453) | GTM | GTM |
| Meta Pixel (364357034958645) | integração nativa da Tray (navegador e API de Conversões); as tags do GTM estão pausadas e sem ID (`0000`) | GTM, pasta "🟡 JK Portal /guias", só em `/guias` e `/bio` |

**Nunca despausar as tags da pasta "🟠GA4 V4COMPANY".** O GA4 já chega pelos
dois lados sem o GTM. Ligar aquelas tags contaria cada visita duas vezes.

## O que o portal manda para o `dataLayer`

```js
{ event: "clique_whatsapp", destino: "guarulhos", posicao: "conteudo",
  url: "https://wa.me/...", origem: "/lojas/guarulhos" }
```

| Evento | Quando |
|---|---|
| `clique_whatsapp`, `clique_telefone`, `clique_rota`, `clique_waze` | Contato com uma loja física, no site ou na bio. `destino` é o slug da unidade |
| `clique_produto` | Qualquer link para a loja online. `destino` é o produto ou o lugar do link |
| `clique_loja`, `clique_guia` | Chamada para ação no corpo do guia |
| `clique_link` | Link da bio que não vai para a loja nem para o WhatsApp. `destino` é o rótulo |
| `jk_captura_aberta`, `jk_captura_enviada`, `jk_grupo_clique` | Formulário de captura da bio. MESMOS nomes do tema da loja, então uma tag de Lead montada para a loja vale para a bio sem nada a mais. Vêm com `jk_origem: "bio"` e `jk_campanha`, nunca com nome, telefone ou e-mail |

Os eventos de e-commerce da bio (`view_item_list`, `select_item`) vão só para
o GA4, **de propósito fora do `dataLayer`**: o contêiner é o da loja, e uma tag
de loja escutando nome de e-commerce contaria a mesma conversão duas vezes.

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

## O que o portal usa deste contêiner

O que o portal mede para o **orgânico** (visita, clique para a loja, contato
com loja física) vai para o **GA4 direto**, pelo código, sem GTM. O GTM já
carrega no portal e já faz sozinho:

- **Pinterest**: a tag base e o Page Visit rodam em todas as páginas do
  domínio, `/guias` incluído. Quem lê as dicas já entra no público do
  Pinterest (público por URL que contenha `/guias`).
- **Google Ads**: o remarketing roda no portal, mas com o `AW-AW-` acima, e a
  tag nativa da Tray não roda no portal. Para público do Google Ads com quem
  leu o portal, o caminho é um público do GA4 ("visitou /guias"), que passa
  para o Google Ads pelo vínculo entre os dois.

Foi testado e descartado um evento `lead` do Pinterest: o anúncio do Pinterest
leva para a loja, não para o portal, e o evento não servia às campanhas.

## Meta Pixel no portal e na bio

O pixel do Meta só existia na loja, porque quem instala é a Tray. Sem ele no
portal, quem lê as dicas ou abre a bio e não segue para a loja não entrava nos
públicos do Instagram e do Facebook, e o Meta não via os contatos com as lojas
físicas.

**Estado:** publicado em 25/09/2026, 0h12, como versão **25** ("25 - Portal /guias e
/bio: Meta Pixel (PageView, Contact, FindLocation) (Filipe)"). A conferência
no ar ainda não foi feita.

Fica na pasta **"🟡 JK Portal /guias"** do contêiner, a partir de
`portal-meta.json`:

| Tipo | Nome | O que faz |
|---|---|---|
| Variável | JK Portal - Pixel Meta | `364357034958645`, o pixel da JK (o mesmo da Tray) |
| Variável | JK Portal - destino | Slug da loja, do `dataLayer` |
| Acionador | JK Portal - Páginas /guias e /bio | Visualização de página com `Page Path` casando `^/(guias\|bio)(/\|$)` |
| Acionador | JK Portal - Contato com loja | `clique_whatsapp` ou `clique_telefone` |
| Acionador | JK Portal - Rota para loja | `clique_rota` ou `clique_waze` |
| Tag | JK Portal - Meta PageView | PageView só no portal e na bio. As trocas de página sem recarregar o próprio pixel registra |
| Tag | JK Portal - Meta Contact (WhatsApp e telefone) | Evento padrão Contact, com `content_name` = slug da loja |
| Tag | JK Portal - Meta FindLocation (como chegar) | Evento padrão FindLocation, com `content_name` = slug da loja |

**Por que a bio está no acionador:** o link divulgado é
`jkaliancas.com.br/bio`, servido pelo Worker sem o endereço mudar, então o
caminho que o GTM enxerga é `/bio`, não `/guias/bio`. Com "começa com /guias"
justamente quem chega do Instagram ficava fora do pixel. A Tray não serve nada
em `/bio*` (a rota inteira é do Worker) nem em `/guias`, e o `(/|$)` impede que
um `/biografia` qualquer case.

Sem correspondência avançada e sem dado pessoal. O modelo "Facebook Pixel"
aparece como "Modificado" na importação, mas o comparador do GTM confirma "As
duas versões são idênticas".

### Por que o MESMO pixel da loja

Decisão do Filipe em 24/09. Um pixel só quer dizer um público só: a pessoa que
lê um guia e depois visita a loja é a mesma pessoa para o Meta, e qualquer
recorte ("leu o portal", "leu e não comprou") sai por regra de URL, sem juntar
dois conjuntos de dados.

A consequência, que precisa ser conhecida: quem visita o portal ou a bio entra
em todo público "todos os visitantes do site" deste pixel. Em 24/09 isso
alcançava o `[BB] Page View 90d`, que estava na campanha ativa **[KCM] Direct
Sales$100**, nos dois conjuntos de remarketing ("Qualquer Interação IG | SITE
[EXCL. Purchase30d]"). Na data o efeito era nulo: o portal tinha 16 cliques
orgânicos em 28 dias, contra mais de 336 mil PageViews da loja no pixel no
mesmo período, e quem sai do portal para a loja já entrava pelo pixel da Tray.
Público que ganha gente não reinicia aprendizado; só edição do conjunto
reinicia.

**Não duplica:** conferido no ar em 24/09, a loja tem o pixel da Tray e o
portal e a bio tinham o GTM sem pixel nenhum; as 9 tags antigas de Facebook do
contêiner estão pausadas e com ID `0000`; Contact e FindLocation só nascem dos
`clique_*`, que só o portal e a bio enviam. Nenhuma tag do portal manda
evento de e-commerce. No Gerenciador de Eventos, em 24/09, o único evento usado
por conjunto de anúncios era a Compra, e não havia conversão personalizada.

A regra "não ligar Meta pelo GTM" do Trello foi escrita para a loja, onde a Tray
já instala o pixel e o GTM duplicaria. No portal não há pixel da Tray.

### Para o gestor de tráfego

**Públicos que já dá para criar** (Públicos, Criar público, Site, conjunto de
dados "Pixel Ecommerce JK Alianças"). Público de site olha até 180 dias para
trás, então pode ser criado a qualquer momento e já nasce com quem visitou
desde que o pixel entrou no portal. Antes disso não existe dado.

| Público | Regra |
|---|---|
| Leitores do portal | Pessoas que visitaram páginas específicas, URL contém `/guias` |
| Visitantes da bio | URL contém `jkaliancas.com.br/bio` |
| Falou com uma loja física pelo portal | Evento `Contact` (dá para refinar por `content_name` = loja) |
| Pediu rota para uma loja | Evento `FindLocation` |

Cuidados:

- **Para tirar o portal de um público "todos os visitantes"**, use "URL não
  contém `/guias`" DENTRO da regra de inclusão. Nunca como exclusão: excluir
  quem visitou `/guias` tira do remarketing quem visitou a loja e também leu o
  portal.
- **Leitor do portal não é todo comprador.** Quem lê "como escolher" ou "anel
  de namoro" está antes da compra; quem lê "como limpar aliança" em geral já
  comprou. Com volume, vale separar por URL de guia.
- **`Contact` do portal é clique no WhatsApp ou no telefone de loja física**,
  não é venda nem lead de formulário. Não use como evento de otimização de
  campanha de venda. Se virar objetivo, que seja em campanha de loja física.
- **Não despausar as tags da pasta "🔵FACEBOOK V4 COMPANY"** nem trocar o
  `0000` pelo pixel da JK: na loja isso duplicaria PageView, ViewContent e
  Compra, que a Tray já manda.
- **Lead da captura (`jk_captura_enviada`)**: ainda NÃO existe tag. Está no
  Trello para o Esquenta (Filipe e Marcela). Na loja o pixel já foi iniciado
  pela Tray, então a tag deve mandar só o evento `Lead` e precisa passar pelo
  Visualizar conferindo que não sai um segundo PageView. Na bio, a mesma tag
  vale sem mudança.

### Conferir e voltar

Conferência no ar: em `/guias/lojas` e em `/bio`, o `fbq` existe e sai um
PageView para `facebook.com/tr`; na home da loja continua só o pixel da Tray,
com um PageView. Dá para ver também no Gerenciador de Eventos, em PageView,
filtrando a URL por `/guias`.

Para voltar: Versões, versão 24, Publicar. Ou pausar as três tags da pasta
"🟡 JK Portal /guias" e publicar. A exportação da versão 24 é
`GTM-WWT3T789_workspace27.json`, de 24/09.

## Espaços de trabalho

O GTM gratuito dá **3** espaços. O "Default Workspace" não some: apagado, o GTM
cria outro na hora, e ele também é recriado a cada publicação. O "Recuperaçao"
(vazio, de abril, da época das versões "Restored") foi apagado em 24/09.

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
