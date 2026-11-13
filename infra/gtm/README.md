# GTM do site (GTM-WWT3T789)

O contêiner é o **mesmo da loja Tray**. Tudo que mudar aqui vale para a loja e
para o portal ao mesmo tempo. Conta do GTM: **JK ALIANÇAS (6221062229)**,
contêiner "WEB - ECOMMERCE - OFICIAL" (217728559).

Levantado em 24/09/2026 a partir da exportação do espaço de trabalho 27 (versão 24).
A versão 25 (25/09/2026) pôs o pixel do Meta no portal e na bio.

## A versão no ar, e a armadilha da "mais recente"

No ar desde 13/11/2026, 15:41: **versão 30**, "Coletor de origem do portal em
todas as paginas e na compra (Filipe)". É a 26 mais uma etiqueta.

| Versão | Estado | Nome | Quem |
|---|---|---|---|
| **30** | **Ativa e mais recente** | Coletor de origem do portal em todas as páginas e na compra | Filipe, 13/11 15:41 |
| 29 | Base da 30, nunca publicada | Restored_26 (cópia da 26) | 13/11 15:36 |
| 28 | Fora do ar | Suporte a document.write nas tags com nonce (Conversity) | marcela.campello, 26/09 14:42 |
| 27 | Fora do ar | Nonce do checkout nas tags de HTML (Conversity) | marcela.campello, 26/09 14:37 |
| 26 | Estava ativa até 13/11 | Google Ads: corrige ID e rótulo da conversão + exceção de pagamento recusado (Conversity) | marcela.campello, 26/09 14:48 |

**O que aconteceu, para não repetir.** A Conversity publicou a 27 e a 28 em
26/09 para fazer as tags de HTML rodarem no fechamento da compra e, seis
minutos depois da 28, voltou para a 26. O motivo da volta não está escrito no
contêiner. Ficou assim por sete semanas: a versão ATIVA (26) não era a MAIS
RECENTE (28).

Todo espaço de trabalho nasce da versão mais recente, não da ativa. O espaço
34 mostrava "Alterações: 0" e mesmo assim diferia do que estava no ar (4 tags
de HTML alteradas e uma variável a mais). Publicar "só uma etiqueta" teria
levado junto as duas versões desfeitas.

O conserto, feito em 13/11 com o sim do Filipe: na aba Versões, menu da 26,
**"Definir como a versão mais recente"**. Isso cria uma cópia (a 29,
"Restored_26") sem publicar nada, e o espaço de trabalho pede para ser
atualizado. Só então a etiqueta nova foi criada e publicada como 30. A 27 e a
28 continuam no histórico: se a Conversity quiser retomar o nonce, refaz por
cima da 30. Para desfazer o conserto, o mesmo botão na 28.

**Antes de qualquer publicação, abrir a aba Versões e conferir se a "Ativa" é
a "Mais recente".** Se não for, parar e falar com o Filipe.

A aba Versões só abre pelo clique na aba; o endereço direto cai na lista de
contas. A exportação da 26, tirada antes de mexer, está em
`~/Downloads/GTM-WWT3T789_v26.json` (44 tags, 42 acionadores, 172 variáveis
mais 27 embutidas).

A versão 26 também mudou a conversão de compra do Google Ads no GTM, o que a
regra "Não corrigir o `AW-AW-16750399342`" mais abaixo dizia para não fazer.
A regra ficou como estava, para a decisão não se perder: vale conferir com a
Conversity se a compra está sendo contada uma vez só.

### O fechamento da compra tem política de segurança de conteúdo

O carrinho e o fechamento (`/checkout/...`) saem com
`Content-Security-Policy` em metatag: `script-src 'self' 'unsafe-eval'
'nonce-...'` mais uma lista de domínios. Script escrito dentro de uma tag de
HTML (inline) não roda lá sem o nonce, que é o que a 27 e a 28 tentaram
resolver. Script carregado do próprio domínio roda, por causa do `'self'`.

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

## Coletor de origem na loja

**Publicado em 13/11/2026, 15:41, na versão 30.**

O portal anota de onde cada visita chega (`docs/origem-do-pedido.md`). Nas
páginas do portal o script entra pelo código. Na loja, quem carrega é o GTM,
porque é ele que roda em todas as páginas, carrinho e fechamento incluídos.

Uma etiqueta, na pasta "🟡 JK Portal /guias" (o registro dela é
`coletor-de-origem.json`; foi criada à mão na tela, não importada):

| Tipo | Nome | O que faz |
|---|---|---|
| Tag (HTML personalizado) | JK Portal - Coletor de origem | `<script async src="/guias/o.js?v=2"></script>`, uma vez por evento, em dois acionadores que já existiam: "All Pages" e "EasyCheckout_OrderPlaced" (o evento `purchase`) |

O que ela faz: carrega um arquivo do próprio domínio, que manda ao portal o
endereço da página, o site anterior, a sessão da Tray e, na compra, o número
do pedido. **Não manda evento para Meta, Google, Pinterest nem GA4**, então não
mexe em conversão nenhuma e não conta nada em dobro. Não lê formulário, nome,
telefone nem e-mail.

**Por que dois acionadores.** O fechamento da compra não recarrega a página a
cada passo, então o "All Pages" de lá dispara muito antes de existir pedido. No
evento de compra a etiqueta dispara de novo; o arquivo percebe que já rodou e
só confere o número do pedido, que a Tray põe em
`ecommerce.purchase.actionField.id`.

**Por que roda no fechamento**, onde as tags de HTML da Conversity eram
barradas: a política de segurança de lá barra script escrito dentro da tag e
aceita script do próprio domínio. Esta etiqueta só tem um `src` do próprio
domínio. "Suporte para document.write" fica desmarcado.

**O `?v=2` é o mesmo número de `VERSAO_DO_COLETOR`** em
`src/components/analytics/Coletor.tsx`. O arquivo tem cache de uma hora, então
correção comum chega sozinha. Só se troca o número (aqui e lá) quando a
correção não pode esperar.

Nas páginas do portal a etiqueta também dispara, e o arquivo, por já ter
rodado, só confere se há algo novo para mandar.

Conferido no ar em 13/11: na home e no carrinho o script rodou sozinho,
carregado pelo GTM. Dois minutos depois da publicação o banco já tinha 5
sessões da loja e 2 chegadas do Google Ads com o código da campanha
reconhecido. **Falta ver um pedido de verdade chegar** em `origem_pedidos`.

Para voltar: pausar a etiqueta e publicar, ou publicar a versão 26. O arquivo
`/guias/o.js` continua no ar sem ser carregado por ninguém na loja.

## Meta Pixel no portal e na bio

O pixel do Meta só existia na loja, porque quem instala é a Tray. Sem ele no
portal, quem lê as dicas ou abre a bio e não segue para a loja não entrava nos
públicos do Instagram e do Facebook, e o Meta não via os contatos com as lojas
físicas.

**Estado:** publicado em 25/09/2026, 0h12, como versão **25** ("25 - Portal /guias e
/bio: Meta Pixel (PageView, Contact, FindLocation) (Filipe)"). Conferido no ar
em 25/09: PageView na bio e no site de dicas, inclusive na troca de página sem
recarregar; Contact e FindLocation com `content_name` da loja; na loja, nenhum
evento do Meta saindo pelo GTM.

**Pendente, e é da bio, não do pixel:** a bio nova manda ao GA4
`instagram / social / link_na_bio`, e o link antigo da página do RD mandava
`Link da Bio do RD Station / social / CTA no Link da Bio`. A série antiga para
em 24/09. E os links da bio para a loja vão sem etiqueta, então o pedido na
Tray chega sem origem. Decisão em aberto no Trello (card "Bio nova sem a UTM
antiga").

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

## Grupo de ofertas: página /grupo e Lead do Meta

**Estado em 01/10/2026: preparado, NÃO publicado.** O portal já manda tudo que
o GTM precisa; faltam as duas mudanças abaixo no contêiner, que seguem as
regras da casa (uma por versão, Visualizar, cartão no RELATÓRIO DE MUDANÇAS).

O que o portal já faz, sem GTM:

- `jkaliancas.com.br/grupo` é a página do anúncio, servida pelo Worker como a
  bio. O formulário manda ao `dataLayer` os mesmos eventos da bio, com
  `jk_origem: "grupo"`: `jk_captura_aberta` (visita à página),
  `jk_captura_enviada` (cadastro, com `jk_event_id`) e `jk_grupo_clique`.
- O GA4 recebe `generate_lead` com `lead_source` = `bio` ou `grupo`.
- O servidor manda o MESMO Lead para a API de Conversões do Meta, com o mesmo
  `event_id`, assim que o token for colado em Integrações. O Meta junta o do
  navegador e o do servidor e conta um.

### Mudança 1: PageView do Meta na página do grupo

Sem ela, **o pixel não carrega em /grupo**, que é justamente a página do
anúncio: o acionador hoje só aceita `/guias` e `/bio`.

Acionador **JK Portal - Páginas /guias e /bio**: trocar a regex de
`^/(guias|bio)(/|$)` para `^/(guias|bio|grupo)(/|$)` e renomear para
"JK Portal - Páginas /guias, /bio e /grupo". A Tray não serve nada em
`/grupo*` (a rota inteira é do Worker, conferido em 01/10).

### Mudança 2: Lead do Meta pelo navegador

Importar `portal-grupo.json` com **Combinar** (nunca Substituir). Entram só
itens novos, na pasta "🟡 JK Portal /guias":

| Tipo | Nome | O que faz |
|---|---|---|
| Variável | JK Portal - event_id | `jk_event_id` do `dataLayer`, o id que o servidor também manda |
| Variável | JK Portal - origem do lead | `jk_origem` (`bio` ou `grupo`) |
| Acionador | JK Portal - Lead do grupo de ofertas | `jk_captura_enviada`, só com `Page Path` em `/guias`, `/bio` ou `/grupo` |
| Tag | JK Portal - Meta Lead (grupo de ofertas) | Evento padrão **Lead**, ID do evento = `{{JK Portal - event_id}}` |

**O ID do evento é o que impede Lead em dobro.** Sem ele, o Lead do navegador
e o do servidor contam como dois.

O acionador fica fora das páginas da loja de propósito: o pop-up do tema da
loja manda o MESMO `jk_captura_enviada`, mas lá não há Lead pelo servidor nem
`jk_event_id`, e a tag de Lead da loja segue como decisão própria (seção do
Meta Pixel, "Lead da captura").

### Para o gestor de tráfego

- **Link do anúncio:** `https://www.jkaliancas.com.br/grupo`, com os
  parâmetros de URL de sempre
  (`utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`).
  O link não muda quando o grupo enche: troca-se o destino em `/admin/grupo`.
- **Evento de otimização:** Lead (Cadastro). Ele só aparece no Gerenciador de
  Eventos depois do primeiro cadastro com a mudança 2 publicada, ou com o
  token da API de Conversões salvo.
- **Públicos:** "visitou /grupo e não fez Lead" (URL contém `/grupo`, excluindo
  o evento Lead) é quem teve interesse e não se cadastrou. Quem se cadastrou e
  não foi ao grupo sai da planilha em `/admin/grupo` (filtro "Não foi ao
  grupo"), para subir como público de clientes.
- **Para conferir o servidor:** salve um código de teste no cartão do Meta em
  Integrações, faça um cadastro e veja em Eventos de teste. Apague o código
  depois, senão o Meta não usa o evento na campanha.
