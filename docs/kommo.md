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

## Fase 3, cartão 47: venda ganha entra no painel e no ranking

Quem vende marca a venda na Kommo arrastando o negócio para "Venda ganha"
(etapa 142). O painel registra essa venda sozinho, uma vez só, sem o vendedor
lançar de novo em Registrar venda. Nada aqui escreve na Kommo nem nas tabelas
`kommo_*`.

### Só funil de venda conta

A etapa 142 existe em todo funil, e nem sempre é venda: no ECOMM | SAC ela é
"Resolvido", e os funis PDV e PÓS VENDAS recebem o negócio DEPOIS da venda
(Lançamento, Boas-Vindas, NPS). No PDV do Grand Plaza a 143 é "FINALIZADO".
Por isso só o ganho num funil com WHATS ou RECUPERAÇÃO no nome (e sem PDV, PÓS
ou SAC) vira venda (`funilDeVenda`, a mesma expressão em
`kommo_vendas_candidatos`). E passar do ganho para um funil de pós-venda é o
caminho normal, não desfaz nada.

Também só conta o ganho depois de `kommo_vendas_config.desde` (o dia em que a
0165 entrou): a carga inicial traz 90 dias de negócios, e as vendas ganhas
desse passado já foram lançadas à mão.

### O que o painel faz com cada negócio ganho

A regra é `decidir` em `src/lib/kommo/vendas.ts` (pura, com teste em
`npm run verificar:kommo-vendas`). Quem executa é `kommo_venda_aplicar`, sempre
pelas portas que já existem:

| O negócio | O que acontece |
|---|---|
| Campo "Pedido Tray" com um número que está na loja | `pedido_marcar_vendedor`, o mesmo do "Fui eu que vendi": entra no mês e no ranking |
| "Pedido Tray" que ainda não chegou ao painel | espera (a loja é lida de dez em dez minutos); depois de 3 dias, vai para a fila |
| Sem pedido, com valor | `registrar_venda_avulsa` com as travas de sempre (`repetida`, `ja_na_loja`, `sem_telefone`); trava acesa vai para a fila, nunca entra calada |
| Sem valor, sem pedido | fila ("sem valor"); entra sozinho quando a Kommo ganhar o valor |
| Responsável sem pessoa no mapa, ou usuário de loja | fila ("sem vendedor"); nunca vira palpite. Entra sozinho quando o mapa for preenchido |
| Troca, conserto ou ajuste (método TROCA ou motivo da compra) | fila: não é venda nova |
| Dois números no "Pedido Tray" | fila |

A venda por fora leva o valor do negócio, o telefone do contato (só se estiver
no formato do painel), a forma do campo "Método de pagamento", o canal pelo
funil (WhatsApp ou recuperação), o primeiro "Produto" preenchido e a
observação "Venda ganha na Kommo, negócio N".

**A porta entra em nome do vendedor.** As portas leem `auth.uid()`, e a rodada
roda com a chave de serviço. `kommo_vendas_entrar_como` põe o vendedor do
negócio na sessão só durante a chamada (e tira em seguida): a porta confere o
acesso DELE, as travas valem iguais, e a marcação e a venda ficam no nome dele,
que é quem marcou na Kommo. Essa função não abre para ninguém, nem para a chave
de serviço; só as funções da 0165 chamam.

**O dinheiro conta uma vez só.** `kommo_vendas` tem uma linha por negócio, e a
linha é travada (`for update`) antes de qualquer porta: rotina e webhook ao
mesmo tempo não registram duas vezes, e o que já foi marcado ou lançado não é
lançado de novo.

### Quando o negócio sai do ganho

Sair é: apagado, ou voltar para etapa aberta ou perdida de um funil de venda.

- Venda por fora lançada: `estornar_venda_avulsa` em nome do vendedor, com o
  motivo "desfeito na Kommo" no vínculo. A porta só deixa o vendedor estornar
  o que lançou hoje ou ontem; depois disso vai para a fila e a gerência
  estorna pela tela.
- Pedido marcado: não existe porta para desmarcar pedido, e o pedido continua
  pago na loja. Vai para a fila, e a gerência decide de quem é (pela gaveta do
  pedido) e tira da fila.
- O que estava esperando ou na fila só fecha.
- Voltou ao ganho depois de desfeito: conta de novo (`vezes`).

### Quem dispara

O passo `processarVendasDaKommo` (`src/lib/kommo/vendas-rodada.ts`) roda
depois da gravação do espelho, na rotina de dez em dez minutos e no webhook. É
um passo à parte: erro nele não derruba a leitura, e o resumo entra no pulso
"Espelho da Kommo" da Saúde.

### A tela

`/admin/vendas-da-kommo`, setor Vendas, área `lancar_venda`, a mesma régua de
Pedidos do site: o vendedor vê a lista e a fila, mas o valor só da venda dele;
quem tem `vendas` vê tudo. A fila mostra o motivo, o responsável na Kommo e o
link do negócio. Resolver (lançar como venda por fora, marcar o pedido,
estornar, tirar da fila) é só de quem tem `vendas` e `lancar_venda`
(`kommo_venda_resolver`), com dois toques, pelas mesmas portas e com a sessão
de quem resolve.

### Funções e tabelas (0165)

| | Quem | Para quê |
|---|---|---|
| `kommo_vendas` | ninguém direto | o vínculo negócio da Kommo, registro do painel |
| `kommo_vendas_movimentos` | ninguém direto | o histórico do que a rodada e a gerência fizeram |
| `kommo_vendas_config` | ninguém direto | `desde`: a partir de quando o ganho conta |
| `kommo_vendas_candidatos(limite)` | chave de serviço | o que a rodada precisa olhar |
| `kommo_venda_aplicar(negocio, acao)` | chave de serviço | executa a decisão |
| `kommo_vendas_lista(de, ate)` | `lancar_venda` | a tela |
| `kommo_venda_resolver(negocio, acao, vendedor, pedido)` | `vendas` e `lancar_venda` | a gerência resolve a fila |

Conferido numa transação desfeita, com negócios inventados no formato do
espelho e JWT falso: marca o pedido em nome do vendedor e o ranking anda;
lança a venda por fora com valor, telefone e observação; não lança duas vezes;
a segunda venda igual vai para a fila como `repetida`; usuário de loja vai para
a fila; pedido que não existe espera; negócio no PDV e negócio ganho antes da
data ligada ficam de fora; sair do ganho estorna a venda e manda o pedido
marcado para a fila; voltar ao ganho conta de novo. Vendedor e fábrica não
resolvem a fila; fábrica e chamada sem sessão recebem nulo na lista; o vendedor
não recebe valor de venda de outra pessoa nem o total.

### O que só se confere com a chave da Kommo

O espelho estava vazio em 18/11 (a chave não foi colada). Falta ver com
negócio de verdade: o formato real de "Pedido Tray" que os vendedores digitam,
quanto da fila vira "sem vendedor" (todo negócio das lojas físicas, enquanto o
usuário da Kommo for a loja), e se algum funil de venda tem nome fora da regra.

### O que a JK precisa configurar na Kommo

Na etapa "Venda ganha" de cada funil de venda (WHATS e RECUPERAÇÃO), como
campos obrigatórios para mover:

1. **Valor do negócio** (o campo de venda da própria Kommo). Sem ele a venda
   por fora não entra.
2. **Método de pagamento** (Pix, cartão, dinheiro, fatura).
3. **Pedido Tray**, quando a venda foi paga pelo site. Só o número.
4. **Loja**: um campo novo de lista com as lojas físicas e "Site", para a
   venda da loja ter dono quando o usuário da Kommo é a própria loja. Hoje o
   painel não lê esse campo; ele entra quando existir (com o nome exato
   decidido).

E no painel: em `/admin/kommo`, ligar cada vendedor da Kommo à pessoa do
painel. Usuário de loja continua sem vendedor até a venda dizer quem vendeu.
