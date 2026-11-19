# Kommo no painel

A conversa com o cliente mora na Kommo. O painel guarda uma cópia de leitura
do que acontece lá, para juntar com pedido, venda e anúncio. Cada dado tem um
dono só: o painel nunca edita o espelho, só regrava pela leitura seguinte.

Plano completo (seis fases, cartões 45 a 50 do Roadmap):
https://claude.ai/artifact/99upkh9xHWbzdgzKmhJMVs

Este documento é da **fase 1, cartão 45**: ligar e espelhar em tempo real.

## Regra dura desta fase: só ler

Criar ou mover negócio, contato ou tarefa na Kommo dispara Salesbot e mensagem
de WhatsApp para cliente de verdade. O núcleo (`src/lib/kommo/`) só lê. A única
escrita é cadastrar o webhook (`POST /api/v4/webhooks`), por ação de
administrador no cartão da Kommo em Integrações. O teste `npm run
verificar:kommo` falha se aparecer outro `POST`, `PATCH` ou `DELETE` no núcleo.

A escrita na Kommo (fase 49, "o painel avisa a Kommo") entra em arquivo
próprio, com confirmação na tela e autor, como a escrita na Tray
(`src/lib/loja/alterar.ts`).

## Como liga

1. A conta administradora da Kommo (KDM ALIANCAS LTDA) cria uma integração
   privada (Configurações, Integrações, Criar integração), gera a chave de
   longa duração e cola no cartão da Kommo em `/admin/integracoes`. A chave
   mora em `integration_tokens` (provider `kommo`), sem policy.
2. No mesmo cartão, "Ligar o webhook". O painel gera um segredo (provider
   `kommo_webhook`) e cadastra
   `https://www.jkaliancas.com.br/guias/api/kommo/webhook?segredo=...` com os
   eventos de `EVENTOS_DO_WEBHOOK` (`conta.ts`).
3. A rotina de 10 em 10 minutos (`pg_cron` `ler-a-kommo`, minuto 2, 12, 22...)
   começa a carga dos últimos 90 dias. "Ler a Kommo agora" no cartão adianta.
4. Em `/admin/kommo` (Sistema, "Quem é quem na Kommo", só diretoria) cada
   usuário da Kommo é ligado a uma pessoa do painel e a uma loja física.

Sem a chave a rota da rotina não faz nada e não deixa pulso: a Saúde mostra o
Espelho da Kommo como "Sem registro".

## Como o espelho anda

| Caminho | O que faz | Quando |
|---|---|---|
| Webhook (`/api/kommo/webhook`) | Lê do formulário só QUAIS ids mudaram, grava em `kommo_pendentes` e, com a chave, relê esses ids pela API na hora (`after`) | A cada mudança na Kommo |
| Rotina (`/api/cron/kommo`) | Usuários, funis e etapas; os pendentes; os eventos desde o último ponto (janelas de 1 hora); os negócios e os contatos alterados desde o último ponto (`filter[updated_at][from]`, `order[updated_at]=asc`) | De 10 em 10 minutos |
| Carga inicial | A mesma leitura de "alterados desde", começando 90 dias atrás | Primeiras rodadas |

Por que o webhook não grava o que traz: a Kommo não assina o aviso, e um
formato só no banco (o da API) evita duas conversões que discordam. Aviso
forjado, no pior caso, faz o painel reler um negócio.

Por que a rotina lê "alterados desde" e não só eventos: mudança de campo
personalizado (Pedido Tray, UTM) não tem um tipo de evento só; o
`updated_at` pega qualquer mudança. Os eventos ficam para a linha do tempo
(etapa, responsável, mensagens).

Cada passo guarda o ponto ao terminar uma página (`kommo_estado`), então a
rodada cortada pelo prazo (45 s dos 60 da Vercel) continua de onde parou.
Mais de 250 mudanças no mesmo segundo: o ponto fica e a página sobe
(`proximoCursor`).

O cliente (`cliente.ts`) deixa 160 ms entre pedidos (pouco mais de 6 por
segundo, abaixo do limite de 7 da Kommo) e espera e repete em 429.

A Kommo desliga webhook depois de falhas seguidas. A rotina confere uma vez
por hora (`conferirWebhook`) e o cartão mostra "A Kommo desligou o webhook"
com o botão de religar. Enquanto isso, a rotina mantém o espelho com até dez
minutos de atraso.

## Tabelas (0160 e 0161)

Todas com RLS ligada e **sem policy**: só a chave de serviço lê e escreve. A
leitura das telas passa pelas funções abaixo.

| Tabela | Chave | O que guarda |
|---|---|---|
| `kommo_negocios` | `id` (lead da Kommo) | nome, `valor`, `funil_id`, `etapa_id`, `responsavel_id`, `contato_id` (o principal) e `contatos`, `motivo_perda_id`, `tags`, `criado_em`, `atualizado_na_kommo`, `fechado_em`, `apagado`, **`etapa_desde`** e **`responsavel_desde`** (gatilho), **`ultima_msg_cliente_em`** e **`ultima_msg_loja_em`** (dos eventos), e os campos tirados para coluna: `pedido_tray`, `motivo_compra`, `origem_cliente`, `utm_*`, `fbclid`, `gclid`, `ad_id`, `meta_ad_id`, `meta_adset_id`, `meta_campaign_id`. O resto em `campos` (`[{id, nome, codigo, valor}]`, sem campo de arquivo) |
| `kommo_contatos` | `id` | nome, `telefone` (o primeiro que deu para normalizar, `55` + DDD + número, o formato do painel), `telefones`, `email`. **Nunca CPF, endereço nem os outros campos** |
| `kommo_eventos` | `id` (o da Kommo, texto) | `tipo`, `entidade` (`lead`, `contact`), `entidade_id`, `autor_id` (nulo quando foi robô), `criado_em`, `antes` e `depois` só com ids. **Sem texto de mensagem nem de nota** (a API nem manda). Apagados depois de 180 dias |
| `kommo_usuarios` | `id` | nome, `ativo`, `administrador` |
| `kommo_funis` | `id` | nome, `principal`, `arquivado`, `ordem` |
| `kommo_etapas` | `(funil_id, id)` | nome, `ordem`, `tipo`: `entrada`, `aberta`, `ganho` (142) ou `perdido` (143). 142 e 143 se repetem em todo funil, por isso a chave é o par |
| `kommo_mapa` | `usuario_id` | `papel` (`loja`, `vendedor`, `diretoria`, `outro`), `profile_id`, `location_id` |
| `kommo_pendentes` | `(entidade, id)` | o que o webhook avisou e ainda não foi relido |
| `kommo_estado` | linha única | os pontos da leitura, a carga, o webhook e o resumo da última rodada |

Os tipos de evento guardados estão em `TIPOS_DE_EVENTO` (`conta.ts`): negócio
criado, apagado, restaurado, etapa, responsável, valor, contato criado,
apagado, restaurado, mensagem recebida, mensagem enviada e nota.

## Funções

| Função | Quem | Para quê |
|---|---|---|
| `kommo_estado_do_espelho()` | diretoria | o cartão de Integrações |
| `kommo_mapa_lista()` / `kommo_mapa_salvar(usuario, papel, profile, location)` | diretoria | a tela do mapa |
| `kommo_negocio(id)` | áreas `vendas` ou diretoria; telefone e e-mail só com `lancar_venda` | um negócio com nomes de funil, etapa, responsável, a pessoa e a loja do mapa, contato e link |
| `kommo_funil_agora()` | áreas `vendas` ou diretoria | abertos por funil e etapa, valor e a mediana de dias parado |
| `kommo_marcar_mensagens(desde)` | só chave de serviço | anda `ultima_msg_*` a partir dos eventos |
| `kommo_limpar_eventos()` | relógio | apaga eventos de mais de 180 dias |

Conferido com JWT falso, numa transação desfeita: diretoria vê tudo; gerente e
tráfego leem negócio e funil (tráfego sem telefone, porque não tem
`lancar_venda`); vendedor e sessão sem perfil recebem nulo; ninguém lê as
tabelas direto.

## Contrato para as próximas fases

O que as fases 46 a 49 podem tomar como certo:

- **Um negócio é uma linha de `kommo_negocios`**, com o estado de agora. Para
  "aberto": `not apagado and etapa_id not in (142, 143)`. Ganho: `etapa_id =
  142`, com `fechado_em`.
- **"Parado há quanto tempo"** é `now() - etapa_desde`. Sem resposta ao
  cliente é `ultima_msg_cliente_em > coalesce(ultima_msg_loja_em,
  '-infinity')`. Os dois só andam para a frente, por gatilho.
- **De quem é**: `responsavel_id` junto de `kommo_mapa` dá a pessoa
  (`profile_id`) e a loja (`location_id`). Usuário sem mapa é "sem dono no
  painel", nunca um palpite.
- **Venda ganha e pedido**: `pedido_tray` é o texto como o vendedor digitou;
  a fase 47 normaliza (só dígitos) antes de casar com `tray_pedidos`.
- **Origem até o anúncio**: `meta_ad_id`, `meta_adset_id`, `meta_campaign_id`,
  `ad_id`, `utm_*`, `fbclid` e `gclid` já estão em coluna. A fase 48 casa com
  `anuncios_itens` como `origem_resolvida` faz.
- **Cliente**: `kommo_contatos.telefone` está no mesmo formato de
  `tray_pedidos.cliente_telefone` (`55...`); `telefones` tem todos.
- **Linha do tempo**: `kommo_eventos` por `(entidade, entidade_id, criado_em)`.
- **Tela nova lê por função** `security definer` com a área em
  `coalesce(..., false)`, como as de cima. Nada de policy nas tabelas.
- **Nunca gravar nas tabelas `kommo_*` a partir de tela**: a próxima leitura
  desfaz. O que é do painel (marcação, alerta visto, nota interna) vai em
  tabela própria, ligada pelo id da Kommo.
- **Escrever na Kommo** é outro arquivo, com autor e confirmação (fase 49).

## O que a API mostrou de verdade (18/11/2026)

Lido pelo conector Kommo CRM, só leitura. Sem dado de cliente aqui: o
repositório é público.

- Conta `kathleengfz`, fuso `America/Sao_Paulo`. 25 funis (um `WHATS` e um
  `PDV` ou `PÓS VENDAS` por loja, mais ECOMM, RECUPERAÇÃO, SAC e `[V4] - PDV`).
  17 usuários: o administrador, as lojas físicas como usuários (ARICANDUVA,
  GRAND PLAZA, GRANJA VIANNA, GUARULHOS, INTERLAGOS, OSASCO PLAZA, RAPOSO,
  SANTANA, UNIÃO OSASCO, Tamboré), os vendedores do site e quatro desativados.
- **31,7 mil negócios mexidos de 20/08 a 18/11.** A carga inicial (negócios e
  contatos, 250 por página) leva perto de uma hora de rodadas.
- Datas em segundos. Etapa de entrada é `type: 1`. Etapas 142 e 143 em todo
  funil, com nomes diferentes ("Venda Ganha", "Resolvido", "FINALIZADO").
- Campo de rastreio tem `field_code` (`UTM_SOURCE`, `GCLID`, `FBCLID`,
  `AD_ID`, `UTM_ID`, `META_AD_ID`, `META_ADSET_ID`, `META_CAMPAIGN_ID`...).
  Campo da JK tem só nome: "Pedido Tray", "Motivo da Compra", "Origem do
  cliente". Existem dois campos chamados "Produto"; ambos ficam em `campos`.
- O contato tem campos de CPF e Endereço. Não entram no espelho.
- Telefone vem como foi digitado; parte sem DDD (9 dígitos). Esses ficam sem
  `telefone` normalizado.
- Evento de mensagem (`incoming_chat_message`, `outgoing_chat_message`) traz o
  id da conversa e a origem (WhatsApp), nunca o texto. Muitos eventos têm
  `created_by: 0` (robô ou Salesbot).
- Já existe um webhook de outra ferramenta de relatório, **desligado pela
  Kommo** (`disabled: true`). O do painel é separado e não mexe nele.

## O que só se confere com a chave colada

Até 18/11 a chave não estava no painel (cartão 6). Tudo acima foi montado e
testado com o formato real lido pelo conector, sem a chave:

- a primeira rodada de verdade (carga, tempo por página, limite de pedidos);
- o cadastro do webhook pela chave e o primeiro aviso chegando pelo Worker
  da Cloudflare até a Vercel;
- o formato exato do formulário do webhook em cada tipo de aviso (o teste usa
  o formato documentado: `leads[status][0][id]`, `leads[note][0][note][element_id]`).

## Fase 2, cartão 46: funil único e alertas (0162)

Os 25 funis têm etapas de nome próprio. Cada etapa é ligada a uma **fase
padrão**: entrada, esperando vendedor, em atendimento, orçamento, esperando
pagamento, ganho, perdido e pós-venda. O painel soma pela fase.

- **A ligação é do painel**: `fases_da_kommo (funil_id, etapa_id, fase,
  origem)`, RLS sem policy. A leitura da Kommo só PREENCHE a etapa que ainda
  não tem linha, com o palpite pelo nome (`palpiteDaFase` em
  `src/lib/kommo/funil.ts`, `upsert` com `ignoreDuplicates`) e `origem =
  'palpite'`. Etapa com nome que o palpite não reconhece fica sem linha: "sem
  fase", nunca chutada. A diretoria confirma ou corrige em
  `/admin/kommo/fases` (Sistema), e a origem vira `pessoa`. Fase nula com
  origem `pessoa` é "sem fase" por decisão.
- **O palpite**: funil com PDV, PÓS VENDAS ou SAC no nome é todo pós-venda,
  inclusive o 142 e o 143 (fechar o ciclo de pós-venda não é venda nova e não
  entra na conversão). Nos outros: a etapa de entrada (`type 1`) é entrada;
  "Entrada", "Novo" e "Aguardando vendedor" são esperando vendedor;
  atendimento é em atendimento; orçamento, negociação e follow-up são
  orçamento; aguardando pagamento e abandono de carrinho são esperando
  pagamento; pedido aprovado, enviado e entregue são pós-venda; 142 é ganho e
  143 é perdido.
- **Motivos de perda**: `kommo_motivos_perda`, espelho regravado pela leitura
  (`GET /api/v4/leads/loss_reasons`), só para o nome.
- **Funil único** em `/admin/funil` (Vendas, área `vendas` ou diretoria), lido
  por `kommo_funil_unico(dias, loja, pessoa, funil, origem, alerta,
  atencao_min)`: abertos por fase e por etapa, valor em jogo, mediana de dias
  parado na etapa, conversão (ganho sobre ganho mais perdido, por
  `fechado_em` no período), primeira resposta (mediana entre o negócio criado
  e o primeiro `outgoing_chat_message`), motivos de perda e a lista dos 60
  mais parados. Loja e vendedor saem do `kommo_mapa`; negócio de usuário sem
  mapa não entra nesses dois filtros, e a tela diz quantos são. A origem é
  `kommo_origem_do_negocio`: anúncio do Meta (id do anúncio), anúncio do
  Google (`gclid`), o campo "Origem do cliente", a UTM, ou "Sem origem".
- **Alertas** por `kommo_alertas(atencao_min, ruim_min)`: negócio aberto em
  fase esperando vendedor há mais que o prazo (desde `etapa_desde`) e conversa
  com mensagem do cliente sem resposta da loja há mais que o prazo (desde
  `ultima_msg_cliente_em`). Os prazos são **premissa** (`PRAZOS_DA_KOMMO`: 30
  minutos atenção, 2 horas atraso, os mesmos do pedido de resposta do chat) e
  a tela diz isso por extenso. Viram sinal na Visão geral para quem tem a área
  (`sinaisDaKommo`), com o número e o link para a lista filtrada; espelho
  nunca lido não gera sinal.
- **Limite conhecido**: a conversão olha a etapa de AGORA. Negócio ganho que
  depois foi movido para um funil de pós-venda deixa de contar como ganho.

## Fase 4, cartão 48: origem do lead até o anúncio (0170)

O anúncio de clique para WhatsApp do Meta não passa pelo site: a pessoa toca no
anúncio e cai na conversa. O coletor de origem nunca vê essa chegada e não há
UTM. O que existe é o que o Meta entrega à Kommo com a primeira mensagem, os
campos de rastreio "Meta Ads ID do anúncio", "do conjunto" e "da campanha",
que o espelho já guarda em `meta_ad_id`, `meta_adset_id` e `meta_campaign_id`.

### A ligação, pelo número e nunca no chute

`kommo_anuncio_dos_negocios(de, ate)` (uso interno, sem `execute` para quem
está logado) liga cada negócio criado ou ganho no período a um item de
`anuncios_itens`, na ordem:

1. o anúncio: `meta_ad_id`, depois `ad_id`. Achou, a campanha e o conjunto são
   os do anúncio;
2. sem anúncio que case, o conjunto: `meta_adset_id`;
3. sem conjunto, a campanha: `meta_campaign_id`, `utm_id` ou `utm_campaign`
   quando é só número.

Número que não está em `anuncios_itens` fica sem ligação ("anúncio não
reconhecido"). Número igual em duas plataformas no mesmo nível também. Não há
ligação por nome. A mesma regra está em `anuncioDoNegocio`
(`src/lib/kommo/origem.ts`), com teste em `npm run verificar:kommo-origem`:
mudou uma, muda a outra.

Conferido em 18/11 pelo conector Kommo CRM (só leitura): os seis números
diferentes de anúncio, conjunto e campanha que chegaram nos negócios recentes
do ECOMM | WHATS existem em `anuncios_itens`, todos da campanha de engajamento
de WhatsApp. Ou seja, com a chave colada, essas conversas ligam ao anúncio
exato.

### Campanhas: conversas e vendas do WhatsApp

`kommo_whats_por_anuncio(de, ate, plataforma)`, área `trafego`. Na aba Meta de
`/admin/trafego/campanhas`, cada campanha, conjunto e anúncio ganha cinco
colunas: Conversas (Whats), Custo/conversa, Vendas (Whats), Venda R$ (Whats) e
Custo/venda.

- **Conversa** é negócio criado no período (`criado_em`, dia de São Paulo).
- **Venda** é negócio na fase `ganho` de `fases_da_kommo` (0162) com
  `fechado_em` no período, e o valor é o do negócio na Kommo. O 142 de funil de
  pós-venda não entra.
- **Conta uma vez só**: quando a fase 3 ligou o negócio ganho a um pedido da
  loja (`kommo_vendas.pedido`, estado `marcada`) e esse pedido já está ligado a
  anúncio pela UTM (`origem_resolvida`), a venda fica em "Resultado (UTM)" e
  sai da coluna do WhatsApp (aparece como "já conta na loja" no detalhe). A
  leitura da `kommo_vendas` é guardada por `to_regclass`: sem a 0165 no banco,
  nada é descontado.
- O Google não manda número nenhum para a conversa: a aba Google não tem as
  colunas.

### Origem: os negócios por origem

`kommo_negocios_por_origem(de, ate, origem)`, área `trafego`, alimenta o bloco
"Conversas do WhatsApp, pela Kommo" em `/admin/trafego/origem`: quantos
negócios criados no período em cada origem (anúncio, anúncio não reconhecido,
UTM, código do site, sem origem), quantos foram ganhos e com que valor, e a
lista dos 200 mais novos com o item ligado e o link para a Kommo. Sem nome do
cliente, telefone nem texto.

Conferido com JWT falso numa transação desfeita, com sete negócios inventados
no formato real: tráfego, gerente, GM, dono e administrador leem; vendedor e
sessão sem perfil recebem nulo; o anônimo não tem `execute`; ninguém de fora
executa a função interna.

### O código no link do WhatsApp: NÃO construído, depende de decisão

A ideia era pôr um código curto na mensagem pronta do botão de WhatsApp do
site, da bio e da loja ("código J4K2"), ligado ao visitante (`jk_v`), e ligar o
negócio ao visitante quando a primeira mensagem trouxesse o código.

**A API da Kommo não entrega o texto de mensagem em lugar nenhum** (conferido
em 18/11 pelo conector, só leitura):

- evento `incoming_chat_message`: só o id da mensagem, a origem (`waba`) e o
  `talk_id`;
- `GET /api/v4/talks`: a conversa, sem mensagens;
- `GET /api/v4/leads/unsorted` (categoria `chats`): `last_message_text` vem
  como NÚMERO (um id), não texto;
- notas do negócio: vazias nos negócios do WhatsApp;
- nenhum campo do negócio guarda a mensagem.

Quem LÊ o texto é o Salesbot: as etiquetas `NAMORO` e `ECOMMERCE` e o campo
"Motivo da Compra" são preenchidos por robô no mesmo segundo em que o negócio
nasce. Então o caminho existe, mas pede mexer na Kommo, o que esta fase não
faz. O que seria preciso, para o Filipe decidir:

1. **Na Kommo**: um campo de texto novo no negócio ("Código do site") e um
   passo no Salesbot de entrada do ECOMM | WHATS (e dos funis WHATS das lojas,
   se o botão da loja física também levar código) que, quando a primeira
   mensagem tiver `código XXXX`, copia o `XXXX` para esse campo. É mudança no
   robô que conversa com cliente de verdade: testar num funil de teste antes.
2. **No painel**: tabela `origem_codigos` (código, visitante, criado_em,
   validade de uns 7 dias), uma rota que gera o código e o devolve ao
   navegador, o `public/o.js` trocando o `?text=` dos links `wa.me` e
   `api.whatsapp.com` pela mensagem com o código (com `VERSAO_DO_COLETOR` em
   `Coletor.tsx` andando junto, e o `?v=` da etiqueta do GTM da loja), o
   espelho tirando o campo novo para coluna (`conta.ts`) e
   `kommo_negocios_por_origem` passando a classificar `codigo` pelas chegadas
   do visitante.
3. **Na loja**: o `o.js` já roda pelo GTM e pelo tema; mudar a versão do `?v=`
   na etiqueta é com o Filipe.

A origem `codigo` já existe na tela e no banco, sempre em zero, para o filtro
não mudar de lugar quando o código existir.

### O que só se confere com a chave colada

- os números de verdade nas colunas (até 18/11 o espelho estava vazio);
- quanto das conversas do WhatsApp chega com o número do anúncio (em 18/11,
  cerca de 20 dos 150 negócios recentes do ECOMM | WHATS);
- a venda contando uma vez só, com um negócio ganho de verdade ligado a pedido
  pela fase 3.
