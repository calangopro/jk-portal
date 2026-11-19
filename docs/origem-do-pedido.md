# Origem do pedido anotada pela loja

A Tray guarda só a "UTM Source" do pedido, e só na exportação. A API não traz
origem nenhuma, e campanha e anúncio ela nunca guardou. Por isso a loja passou
a anotar ela mesma de onde cada visita chega, e o painel liga a chegada ao
pedido. É o que mostra a venda PAGA por campanha, conjunto e anúncio.

Montado em 13/11/2026. O portal e a loja já anotam as chegadas. **O pedido
ainda não foi visto ligado a uma chegada**: os passos que faltam estão no fim.

## Como funciona

1. **Na chegada.** O script `public/o.js` (o mesmo arquivo na loja e no portal)
   manda ao portal o endereço da página (com as UTMs e o identificador do
   clique), o site anterior e a sessão da Tray, que a loja põe em
   `<html data-session>`.
2. **O portal anota** em `/api/origem` e marca o visitante com o cookie `jk_v`,
   gravado pela resposta do servidor. Gravado por script, no iPhone, ele cairia
   em sete dias, e em um dia quando o endereço traz `fbclid` ou `gclid`.
3. **No pedido.** A API da Tray devolve o `session_id` de cada pedido, que é a
   mesma sessão da página. O painel acha o visitante por ela, olha as chegadas
   dele nos trinta dias anteriores e fica com a última que não foi acesso
   direto.

Há um segundo caminho para ligar o pedido, que não depende da API: na compra,
a Tray põe o número do pedido no `dataLayer`, no formato antigo do Google
(`ecommerce.purchase.actionField.id`, com o evento `purchase`), e o script
manda junto. Como o fechamento da compra não recarrega a página a cada passo,
a etiqueta do GTM dispara de novo nesse evento, e o arquivo, quando é
carregado pela segunda vez, só confere o pedido. A sessão tem preferência,
porque ninguém adivinha uma sessão e número de pedido é sequencial.

## As peças

| Peça | Onde |
| --- | --- |
| Script que roda na loja e no portal | `public/o.js`, servido em `/guias/o.js` |
| Quem carrega no portal | `src/components/analytics/Coletor.tsx` |
| Quem carrega na loja | etiqueta "JK Portal - Coletor de origem" no GTM (versão 30) |
| Rota que recebe o recado | `src/app/api/origem/route.ts` |
| Classificação da chegada (pura, testada) | `src/lib/origem/chegada.ts` |
| Gravação e cookie do visitante | `src/lib/origem/registrar.ts` |
| Tabelas e a conta da atribuição | migration 0064 |
| Leitura para as telas | `src/lib/origem/dados.ts`, `src/lib/origem/anotado.ts` |
| Tela de tráfego | bloco "Origem anotada pela loja" |
| Tela de campanhas | bloco "O que vendeu de fato, pela loja" e a linha "Na loja, pago" em cada item |

A atribuição não é tabela, é conta (`origem_dos_pedidos`): a regra pode mudar
e o passado acompanha.

## O código do anúncio não depende de convenção

O coletor guarda em `ids` todo número comprido que vier nas etiquetas. Na
leitura, o banco procura cada um em `anuncios_itens` e descobre se é campanha,
conjunto ou anúncio. Achou o anúncio, sobe sozinho para o conjunto e a campanha
dele. Então serve `utm_content={{ad.id}}`, serve `Vídeo 03|1202...` e serve o
`gad_campaignid` que o Google acrescenta por conta própria.

**Meta.** Nos parâmetros de URL do anúncio, mantendo a origem que já é usada:

```
utm_source={{site_source_name}}_{{placement}}&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}
```

Quem prefere o nome na etiqueta põe o código depois de uma barra:
`utm_campaign={{campaign.name}}|{{campaign.id}}`. Trocar o parâmetro de um
anúncio que está rodando é decisão de quem cuida do tráfego.

**Catálogos da Tray.** O link de produto que a Tray manda para o catálogo do
Instagram e do Facebook sai com `parceiro=1516`, e o do Google Shopping com
`parceiro=1517`. Sem etiqueta e sem clique pago, esse código é a única marca
de onde o link saiu, e o coletor o usa (`CATALOGOS_DA_TRAY` em `chegada.ts`).

**Google.** O código da campanha já vem sozinho. Para chegar ao grupo e ao
anúncio, o sufixo do URL final da conta: `adgroupid={adgroupid}&creative={creative}`.

## O que foi conferido

- A sessão da vitrine é a da API: lida em `data-session` na loja de testes, e a
  API devolveu o carrinho daquela sessão, com o mesmo `session_id`.
- O pedido da API traz `session_id` no mesmo formato (42 de 50 pedidos da loja
  de testes; os outros vieram de fora da vitrine).
- O script rodou num navegador de verdade contra o servidor local: uma chegada
  de anúncio, duas sessões e um pedido ligados ao mesmo visitante, e a conta
  devolveu o anúncio, o conjunto e a campanha do pedido.
- Pedido de outro site, robô e corpo grande demais são ignorados.

- Na loja de verdade, com o script injetado à mão: a home expõe a sessão, o
  recado respondeu 204, e a sessão da home é a mesma que vai no endereço do
  carrinho (`/checkout/cart?session_id=...`).

- **Com pedido de verdade, pela página de compra.** Nas três primeiras horas
  com o script na loja (13/11, das 15h41 às 18h54) o coletor viu 7 pedidos na
  compra. Quando a importação das 19h07 trouxe esses pedidos, os 7 entraram
  ligados ao visitante: o número que a página informa é o número do pedido da
  Tray, e a hora em que foi visto bate ao minuto com a hora do pedido. Em todos,
  a sessão da compra era a que o mesmo visitante já tinha antes.
- Os sete só tinham chegada direta anotada (3 pagos, R$ 1.282,01). É o
  esperado no primeiro dia: o coletor não tem passado, quem compra costuma ter
  chegado antes, e parte das vendas vem de link mandado pelo vendedor.

**Conferido em 16/11/2026, com os primeiros pedidos lidos pela API:** o
`session_id` que a API devolve no pedido é a mesma sessão que o coletor lê na
vitrine. Dos 39 pedidos de 13 a 16/11, os 34 feitos depois de o coletor entrar
na loja ligaram ao visitante pela sessão. Em 27 deles a página de compra
também tinha visto o pedido e apontava o mesmo visitante. Em 4 apontava outro,
e isso ainda não foi investigado (a conta dá preferência à sessão).

## A UTM ligada à campanha, ao conjunto e ao anúncio

Até 16/11/2026 a conta só casava por NÚMERO: procurava em `anuncios_itens`
cada número comprido que vinha nas UTMs. Medido nesse dia, em sete dias de
chegadas: os anúncios do Meta mandam o número só da campanha (`utm_id`), e o
anúncio e o conjunto vêm pelo NOME (`utm_content` é o nome do anúncio,
`utm_term` o do conjunto). Todo pedido parava na campanha, e a tela de
campanhas mostrava "na loja, pago" em branco para todo conjunto e anúncio.

Desde a 0112 a regra inteira mora em `origem_resolvida`, do mais certo para o
menos certo, e nunca no chute:

1. Pelo número, quando a UTM traz o número do anúncio ou do conjunto.
2. A campanha pelo número; sem número, pelo nome exato (`utm_campaign`).
3. O conjunto pelo nome, só DENTRO da campanha já achada.
4. O anúncio pelo nome, dentro da campanha e do conjunto já achados.
5. Campanha com um conjunto só, ou conjunto com um anúncio só: é ele.

Nome igual em dois lugares (o mesmo criativo em dois conjuntos, sem o conjunto
para desempatar) fica sem anúncio. "Nome igual" compara só letras e números
(`so_letras`), porque a mesma UTM chega com `+` no lugar de espaço em parte das
visitas, e compara com TODO nome que o item já teve, porque a UTM leva o nome
do dia do clique.

O que isso deu nas chegadas de anúncio do Meta em sete dias: **75% ligam ao
anúncio exato e nenhuma ficou ambígua**. Os outros 25% são de UMA campanha
("Direct Sales $120"), cujas UTMs têm texto fixo (`direct_sales`, `p2`,
`cat_silver_who_are_we_25`) em vez do nome. Ela liga à campanha e ao conjunto,
que é um só; para ligar ao anúncio, a UTM dela precisa passar a usar
`{{ad.name}}` em `utm_content`, como as outras campanhas já usam. No Google o
endereço só traz o número da campanha (`gad_campaignid`), então é até a
campanha, a menos que ela tenha um conjunto e um anúncio só.

### O clique em anúncio tem precedência (0113)

A primeira versão dava o pedido à ÚLTIMA chegada que não fosse acesso direto.
Quem clicava no anúncio, saía, e voltava duas horas depois pela busca do Google
ou pelo link da bio, virava venda da busca ou da bio, e as colunas da loja na
tabela de campanhas ficavam vazias. Foi o dono quem viu, no mesmo dia: "queria
que marcasse aqui, porque aí sim marcaria correto as vendas".

A regra, desde a 0113:

1. Se o visitante clicou num ANÚNCIO nos sete dias antes do pedido, a venda é
   do anúncio (o clique mais recente), mesmo com chegada orgânica depois. Sete
   dias é a janela de clique padrão do Meta, o que deixa "Resultado (Meta)" e
   "Resultado (UTM)" lado a lado sem comparar janelas diferentes.
2. Sem clique em anúncio nesses sete dias, vale a última chegada que não seja
   acesso direto, até trinta dias antes.

Cada pedido vai para UM anúncio só. É isso que tira a duplicidade: o Meta e o
Google contam a mesma venda cada um para si, e aqui ela entra uma vez.

A prova de que a regra antiga errava: o pedido 11735, de 14/11, teve clique em
anúncio do Google duas horas antes da compra e uma chegada pela busca depois.
A conta dizia "busca do Google"; a etiqueta da própria Tray dizia "Google Ads".

`canal_anotado_dos_pedidos` (0111) passou a ler de `origem_resolvida`, então
Vendas, a Visão geral, Tráfego e Gargalos seguem a mesma regra. A única cópia
que sobrou é a de `historico_do_pedido` (0103), para a linha do tempo da
gaveta.

**Na tabela de campanhas** (`/admin/trafego/campanhas`) os dois números ficam
lado a lado, três vezes: Resultado (Meta) e Resultado (UTM), Venda (Meta) e
Venda (UTM), Volta (Meta) e Volta (UTM), nos três níveis. O Resultado (UTM) é
pedido PAGO, e o número abre a lista dos pedidos daquele item na tela de
origem. O do Meta conta pedido criado, pela regra de atribuição dele (clique em
sete dias e visualização em um), e por isso é sempre maior.

**Por que a UTM fica abaixo do Meta, e sempre vai ficar um pouco:** o Meta
conta quem só VIU o anúncio, conta pedido não pago e reconhece a mesma pessoa
em outro aparelho. A UTM só enxerga o clique feito no mesmo navegador da
compra. E, em novembro de 2026, ainda há um motivo passageiro: a loja anota a
chegada desde 13/11, então quem clicou antes disso e comprou depois não tem
clique guardado.

**Instagram nem sempre é anúncio.** O link da bio chega como
`utm_source=ig&utm_medium=social&utm_content=link_in_bio`, com `fbclid` e tudo,
e cai no mesmo canal "Instagram e Facebook". Nos quatro dias de 13 a 16/11, os
cinco pedidos pagos desse canal vieram do link da bio (quatro) ou sem UTM
nenhuma (um), e nenhum com UTM de anúncio pago do Meta. É amostra pequena, de
um coletor com quatro dias de vida. `ehAnuncio` (`src/lib/origem/pedidos.ts`) separa: é anúncio a chegada que
casou com uma campanha, a que tem mídia paga na UTM ou a que tem `gclid`.
**A tela de Tráfego ainda soma os dois** quando compara a venda do canal com
o gasto do Meta; isso está em "O que falta".

Onde se consulta:

- **Tráfego, Origem dos pedidos** (`/admin/trafego/origem`): os pedidos do
  período por anúncio, por conjunto, por campanha, pela UTM como chegou e
  pedido a pedido, com busca. Cada pedido mostra as UTMs e a frase que diz por
  que foi ligado (`comoLigou`).
- **A gaveta do pedido**, que abre de qualquer tela: o bloco "De qual anúncio
  veio", com a campanha, o conjunto, o anúncio, as UTMs, a página de entrada e
  todas as chegadas do visitante em trinta dias (`origem_do_pedido`).
- **Campanhas e anúncios**: a coluna "Na loja, pago" passou a encher também
  para conjunto e anúncio, porque sai da mesma conta.

## O link da bio: de anúncio ou sem anúncio

Pedido do dono em 16/11/2026: as UTMs do link da bio precisam dizer se a
pessoa veio de anúncio ou não e, se veio, manter as UTMs do anúncio com uma
marca no fim.

**Pelo endereço não dá para saber.** O link do perfil é um só, e o Instagram
põe nele a mesma etiqueta em todo clique
(`utm_source=ig&utm_medium=social&utm_content=link_in_bio`, com `fbclid`),
venha a pessoa de um anúncio ou não. Quem sabe é o site, que reconhece o
visitante pelo cookie `jk_v`.

**A regra.** A chegada pelo link da bio de quem clicou num anúncio até sete
dias antes é gravada com as UTMs DAQUELE anúncio (origem, campanha, conjunto,
anúncio e os números), e a mídia ganha `_bio` no fim: `paid` vira `paid_bio`,
`cpc` vira `cpc_bio`. O clique (`fbclid`), a página de entrada e o aparelho
continuam sendo os da chegada pela bio. Sem anúncio antes, a chegada fica como
veio: `ig / social / link_in_bio`. Sete dias é a mesma janela da precedência do
clique em anúncio (0113). As regras são puras e moram em
`src/lib/origem/chegada.ts`; quem as aplica é `registrarRecado`
(`src/lib/origem/registrar.ts`), olhando as chegadas do próprio visitante.

- **Chegada pela bio** (`chegouPelaBio`) é a página da bio como entrada ou
  `utm_content=link_in_bio`, porque o link do perfil às vezes aponta direto
  para um produto.
- **Clique em anúncio** (`ehCliqueDeAnuncio`) é mídia paga na UTM ou clique do
  Google Ads. `fbclid` não conta: o link da bio também traz.
- **A chegada que herdou as UTMs não é clique novo.** Ela não renova a janela:
  sem essa regra, quem voltasse pela bio a cada cinco dias seria do anúncio
  para sempre.
- **Anúncio que leva DIRETO para a bio** é gravado como veio (é um clique de
  verdade), e as telas o reconhecem pela página de entrada.
- A repetição (`repeteAAnterior`) é conferida com a chegada JÁ herdada, senão
  recarregar a bio anotaria a mesma chegada duas vezes.

**A conta de origem não precisou mudar.** `paid_bio` casa com a mesma
expressão de mídia paga de `origem_resolvida` e de `ehAnuncio`, e campanha,
conjunto e anúncio chegam intactos, então a ligação pelo número e pelo nome
continua igual. O que muda é qual chegada aparece no pedido: a da bio, que é a
mais recente. **A janela pode chegar a catorze dias**: clique no anúncio, bio
até sete dias depois, pedido até sete dias depois da bio.

**No GA4 vai a mesma coisa.** O clique em anúncio deixa o cookie `jk_ad`
(sete dias, só com as UTMs do anúncio), gravado pela resposta de
`/api/origem`. O script da página da bio (`src/lib/bio/origem-script.ts`) lê o
cookie e entrega ao GA4 o `page_location` com as UTMs do anúncio, `_bio` no fim
da mídia e `utm_id` quando o anúncio trouxe número. `paid_bio` e `cpc_bio`
continuam caindo nos canais pagos do GA4. Anúncio que leva direto para a bio
também ganha `_bio` na mídia (antes ganhava `utm_term=bio`, e só quando o
termo vinha vazio). O que vai para o banco NÃO depende do cookie: ali quem
decide é o histórico do visitante. Os dois podem divergir quando o cookie é
apagado, e o que vale para o painel é o banco. Na página `/grupo` nada disso
entra: o anúncio leva direto para lá.

**Onde se vê.** Em Tráfego, Origem dos pedidos, o bloco "Link da bio" mostra
as chegadas pelo link, quantas são de quem veio de anúncio e de quais
campanhas (`chegadas_pela_bio`, 0114). A função refaz a pergunta para cada
chegada em vez de ler a marca gravada, e por isso vale também para o que foi
anotado antes de a marca existir, sem reescrever linha nenhuma. Cada pedido
diz "Anúncio, pelo link da bio" ou "Link da bio, sem anúncio antes"
(`tipoDaChegada`), há o filtro "Pelo link da bio", e a gaveta do pedido traz a
mesma marca e a frase de `comoLigou`.

**O limite, que não tem conserto pelo site.** Anúncio que manda a pessoa para
o PERFIL do Instagram (visita ao perfil, publicação impulsionada) não passa
pelo site. Quando ela toca no link da bio, é a primeira vez que o site a vê, e
a chegada sai como sem anúncio. O Instagram não passa essa informação adiante.
O mesmo vale para quem clicou no anúncio num aparelho e abriu a bio em outro.
Então "sem anúncio antes" quer dizer "sem clique em anúncio que tenha passado
pelo site neste navegador", e não "seguidor que nunca viu anúncio".

Medido em 16/11/2026, em sete dias (quatro deles com o coletor ligado): 726
chegadas pela bio, de 593 visitantes; 91 delas (13%) de 57 visitantes que
tinham clicado num anúncio nos sete dias antes.

Conferido: as regras e o script da bio rodado num navegador de mentira
(`npm run verificar:pedidos`), e um ensaio no servidor local contra o banco
(clique em anúncio, bio do mesmo visitante, recarga e um visitante sem
anúncio), com as linhas apagadas depois. A função do banco foi conferida com
JWT falso de cada nível: só quem tem a área de tráfego recebe os números.

## A origem nas telas de vendas

Até 16/11/2026, a origem em Vendas, na Visão geral, em Tráfego e em Gargalos
saía só de `tray_pedidos.utm_source`, a etiqueta que a exportação do painel da
loja traz. A origem anotada pelo coletor aparecia num bloco à parte, em
Tráfego. Com o pedido entrando pela API, que não tem origem, e a exportação
parada, todo pedido novo caía em "Sem etiqueta": nos quatro dias de 13 a
16/11 eram 30 de 39.

Desde a 0111, as duas contas que alimentam essas telas (`resumo_de_vendas` e
`raio_x_dos_pedidos`) usam **a etiqueta da Tray quando ela existe e, quando
falta, o canal da chegada anotada** (`canal_anotado_dos_pedidos`, a mesma regra
de `origem_dos_pedidos`). O banco devolve a chegada como `@canal`, e
`canalDaOrigem` (`src/lib/vendas/origem.ts`) entende a marca. Nos mesmos
quatro dias, os "sem etiqueta" caíram de 30 para 4.

O que isso muda, para ler os números sem susto:

- **Cinco canais só existem de 13/11/2026 em diante:** Busca do Google, Outros
  buscadores, YouTube, Outros sites e Acesso direto. Antes, a Tray jogava
  todos em "Sem etiqueta". Os sinais da Visão geral não comparam esses canais
  com um período de antes do coletor, senão "Busca do Google começou a vender"
  seria só a troca de quem conta.
- **Acesso direto começa inflado.** O coletor não tem passado: quem clicou num
  anúncio antes de 13/11 e voltou depois aparece como direto. Isso se acerta
  sozinho com as semanas.
- **A chegada anotada olha trinta dias para trás**, e a etiqueta da Tray só a
  visita da compra. Um pedido sem etiqueta da Tray pode ganhar "Instagram e
  Facebook" por um clique de duas semanas antes. Por isso Meta e Google Ads
  tendem a subir um pouco em relação ao que a etiqueta sozinha mostrava.
- **A exportação deixou de ser necessária para a origem dos pedidos novos.**
  Ela ainda é a única fonte para pedido de antes de 13/11 e para quem a loja
  não conseguiu ligar a uma chegada.
- **A fila de recuperação ainda mostra só a etiqueta da Tray** no "veio de".
- **O carrinho abandonado da Kommo usa a mesma regra** (0182, cartão 53): a
  parte de `origem_resolvida` que acha a chegada e casa o anúncio mora em
  `origem_das_chegadas`, que serve aos pedidos e aos negócios do n8n, ligados
  ao visitante pela sessão do "Link do carrinho". Mudou a regra, muda ali.
  Detalhes em `docs/kommo.md`, seção do cartão 53.

## Privacidade

O cookie do visitante (`jk_v`) leva só um número aleatório e dura noventa
dias. O do anúncio (`jk_ad`) dura sete dias e leva só as UTMs do último
anúncio clicado, que já estavam no endereço da página. Não se guarda IP,
navegador, nome, telefone nem e-mail. O identificador do clique (`gclid`,
`fbclid`) fica guardado, porque é ele que um dia permite devolver a venda paga
para a plataforma. A política de privacidade da loja precisa citar essa
medição.

## O que falta

1. ~~O script na loja.~~ **Feito em 13/11/2026**, pela etiqueta "JK Portal -
   Coletor de origem" do GTM, na versão 30 (`infra/gtm/README.md`).
   **No tema também, desde a noite de 13/11.** A linha
   `<script async src="/guias/o.js?v=2"></script>` está em
   `layouts/default.html` dos DOIS temas de `~/Projetos/jk-tema-loja` (raiz e
   `Esquenta/`), logo depois do `scripts`. O Filipe publicou o zip
   `jk-esquenta-20261113-coletor.zip` pelo painel da Tray, e a loja passou da
   pasta de tema 231 para a 233. Conferido no ar: a linha aparece uma vez no
   HTML das páginas, o comentário do tema não vaza, e os CSS e JS seguem
   iguais aos locais. A cópia de segurança do tema anterior é
   `jk-esquenta-backup-20261113-antes-do-coletor.zip`. O tema não depende do
   GTM nem de bloqueador de anúncio; o GTM cobre o carrinho e o fechamento, que
   o tema não alcança. Com os dois, nada duplica: na segunda carga o arquivo só
   confere se há algo novo. **O tema permanente já tem a linha no repositório
   e precisa sair com ela na troca de 01/12.**
   Um efeito de carregar mais cedo: a primeira página de uma visita pode mandar
   dois recados, um com a chegada e outro, logo depois, com a sessão, porque a
   loja só preenche `data-session` depois de a página abrir. Não vira chegada
   repetida.
2. **A API de pedidos na loja da JK**, que traz a sessão. Ligada em
   16/11/2026 (`docs/tray-api-de-pedidos.md`): todo pedido lido pela API vem
   com o `session_id` da Tray, que tem 20 ou 26 caracteres.
3. ~~O código nos anúncios do Meta.~~ Deixou de ser preciso em 16/11/2026: a
   ligação passou a ser pelo nome do conjunto e do anúncio, que as campanhas
   já mandam. Falta só a campanha "Direct Sales $120" trocar o texto fixo da
   UTM por `{{ad.name}}` e `{{adset.name}}`.
4. **Separar anúncio de orgânico nas contas de Tráfego.** `retornoPorPlataforma`
   compara o gasto do Meta com toda venda do canal "Instagram e Facebook",
   inclusive a que veio do link da bio.

O bloco "Origem anotada pela loja", em Tráfego, mostra sozinho qual desses
passos já está feito: cada um é decidido por um número do banco.

## Limites

Só é atribuída a compra de quem chegou pelo link e comprou no mesmo navegador.
Quem viu o anúncio e entrou depois por outro caminho, trocou de aparelho ou
fechou pelo WhatsApp fica sem anúncio. O número sai abaixo do que a plataforma
informa, e serve para comparar um anúncio com outro.

Os vereditos da tela de campanhas continuam usando o número da plataforma. A
venda da loja aparece ao lado. Quando houver volume, vale trocar a régua.
