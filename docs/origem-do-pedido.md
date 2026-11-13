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

- Nas três primeiras horas com o script na loja (13/11, das 15h41 às 18h54):
  7 pedidos vistos na página de compra, todos com a sessão que o mesmo
  visitante já tinha antes de comprar. Os sete só tinham chegada direta
  anotada, o que é esperado no primeiro dia: o coletor não tem passado, e quem
  compra costuma ter chegado antes.

**Não foi conferido:** que a sessão de um pedido de verdade, fechado na
vitrine, é a mesma que a página mostrava. Tudo aponta que sim, mas a prova é o
primeiro pedido lido pela API depois de o script estar na loja.

## Privacidade

O cookie leva só um número aleatório e dura noventa dias. Não se guarda IP,
navegador, nome, telefone nem e-mail. O identificador do clique (`gclid`,
`fbclid`) fica guardado, porque é ele que um dia permite devolver a venda paga
para a plataforma. A política de privacidade da loja precisa citar essa
medição.

## O que falta

1. ~~O script na loja.~~ **Feito em 13/11/2026**, pela etiqueta "JK Portal -
   Coletor de origem" do GTM, na versão 30 (`infra/gtm/README.md`).
   **No tema, a linha já está escrita e ainda não foi publicada.** Em 13/11 ela
   entrou em `layouts/default.html` dos DOIS temas de `~/Projetos/jk-tema-loja`
   (raiz e `Esquenta/`), logo depois do `scripts`:
   `<script async src="/guias/o.js?v=2"></script>`. O zip pronto é
   `jk-esquenta-20261113-coletor.zip`, na raiz daquele repositório, e difere da
   cópia de segurança (`jk-esquenta-backup-20261113-antes-do-coletor.zip`) só
   nesse arquivo. Falta enviar e publicar no painel da Tray, que pediu login na
   área de temas. O tema não depende do GTM nem de bloqueador de anúncio; o GTM
   cobre o carrinho e o fechamento, que o tema não alcança. Com os dois, nada
   duplica: na segunda carga o arquivo só confere se há algo novo.
2. **A API de pedidos na loja da JK**, que traz a sessão. Depende da
   homologação do aplicativo (`docs/tray-api-de-pedidos.md`).
3. **O código nos anúncios do Meta**, pelo modelo acima.

O bloco "Origem anotada pela loja", em Tráfego, mostra sozinho qual desses
passos já está feito: cada um é decidido por um número do banco.

## Limites

Só é atribuída a compra de quem chegou pelo link e comprou no mesmo navegador.
Quem viu o anúncio e entrou depois por outro caminho, trocou de aparelho ou
fechou pelo WhatsApp fica sem anúncio. O número sai abaixo do que a plataforma
informa, e serve para comparar um anúncio com outro.

Os vereditos da tela de campanhas continuam usando o número da plataforma. A
venda da loja aparece ao lado. Quando houver volume, vale trocar a régua.
