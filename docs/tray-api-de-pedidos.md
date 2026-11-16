# Pedidos da Tray pela API

A Tray mandou as chaves do aplicativo **Loja 1305187 - Relatórios de pedidos e
vitrine** em 13/11/2026. Com ele o portal lê os pedidos direto da loja, sem
ninguém exportar arquivo e sem depender do Mac ligado. No mesmo dia a leitura
foi montada e testada contra a loja de testes da Tray.

**Na loja da JK ela roda desde 16/11/2026, de dez em dez minutos.** A Tray
homologou o aplicativo nesse dia, a loja foi autorizada e a rotina entrou no
relógio depois de uma conferência campo por campo. O que foi feito, na ordem,
está em "Como foi ligada".

A exportação do painel da loja (`docs/tray-exportar-pedidos.md`) continua só
para trazer a origem do pedido, que a API não informa. A tabela é a mesma,
`tray_pedidos`.

## As peças

| Peça | Onde |
| --- | --- |
| Lista fechada de lojas e chaves do aplicativo | `src/lib/tray/lojas.ts` |
| Começo da autorização (manda para a tela da Tray) | `/api/tray/conectar?loja=jk` |
| Retorno da autorização (troca o código pelo token) | `/api/tray/retorno` |
| Cliente da API (token, renovação, pedidos) | `src/lib/tray/cliente.ts` |
| Conversão do pedido da API para o formato do painel | `src/lib/vendas/tray-api.ts` |
| Leitura por alteração, conferência e gravação | `src/lib/vendas/pedidos-da-api.ts` |
| Rota da rotina | `/api/cron/pedidos-da-tray` |
| Relógio (minutos 3, 13, 23, 33, 43 e 53) | migration 0101, rotina `ler-pedidos-da-tray` |
| Pulso da rotina, que a Saúde olha | `rotinas_pulso`, linha `pedidos-api` |
| Última leitura boa, para os avisos de atraso | função `ultima_leitura_de_pedidos` (0100) |
| Estado e botão de autorizar | Integrações, cartão "Tray, pedidos pela API" |

As chaves do aplicativo estão em `integration_tokens`, provedor
`tray_aplicativo`. A autorização de cada loja fica na linha dela (`tray_loja`
para a JK, `tray_teste` para a loja de testes), com o endereço da API e o código
da instalação em `meta`.

## O que a API devolve, conferido na loja de testes

- `GET /orders?modified=AAAA-MM-DD HH:MM:SS&sort=modified_asc` devolve o que
  mudou A PARTIR daquele instante, do mais antigo para o mais novo. É por aí
  que chegam pedido novo e pedido que mudou de situação.
- A lista não traz hora, cliente nem pagamento. Isso vem de
  `GET /orders/:id/complete`, uma chamada por pedido.
- Cada status tem um tipo (`open`, `closed`, `canceled`). O tipo `canceled`
  vale como cancelado mesmo se o nome do status não começar com "cancelado".
- O endereço da API não é o do painel da loja: a de testes autoriza em
  `lojatesteintegracaotray01.corpsuite.com.br` e responde em
  `mcadl04b.commercesuite.com.br`.
- A validade do token vem no relógio de São Paulo, sem fuso.
- 150 pedidos completos levaram 11 segundos. O limite da Tray é de 180
  chamadas por minuto e 10 mil por dia, por loja.

## O que a loja de verdade mostrou, e a loja de testes não

Medido em 16/11/2026, na loja da JK.

- **O filtro `modified` INCLUI o instante pedido.** Pedir a partir do instante
  do último pedido devolve o próprio pedido; um segundo depois, nada. Como cada
  rodada parte do instante do último pedido lido, ela relia esse pedido para
  sempre e deixava uma linha no registro a cada dez minutos. Somar um segundo
  não serve: a loja altera vários pedidos no MESMO segundo (o cancelamento
  automático da madrugada chegou a onze), e uma rodada que parasse no meio do
  grupo perderia o resto. A rodada guarda, junto do ponto de partida, quais
  pedidos já leu naquele instante (`pedidos_no_ate`, em `meta`), e a seguinte
  pula esses (`semOsJaLidos` e `alteradosEm`, em `tray-api.ts`).
- **Três campos vinham escritos de outro jeito**, e são igualados em
  `tray-api.ts` para uma porta não desfazer a outra: o nome do item chega com
  `<br />` no fim, o texto vem com os espaços repetidos que o cliente digitou
  (o leitor das exportações junta num só), e pedido sem pagamento vem sem a
  lista `Payment` (a exportação escreve valor pago zero, nunca vazio).
  Status, forma de pagamento, frete, canal, cupom, cliente e totais vieram
  idênticos, em 120 pedidos recentes e em 50 de junho.
- **O texto do item passa de 300 caracteres.** As duas portas cortavam em 300,
  e 75 de 499 itens estavam cortados, 54 em pedido pago dos últimos trinta
  dias. O que se perdia era o FIM, onde fica a gravação do segundo aro, e quem
  lê é a fábrica. O teto foi para 2.000 (`INFO_MAXIMA`, o mesmo número nos dois
  leitores, com teste). O maior texto visto tem 378 caracteres.
- **A sessão vem em todo pedido**, com 20 ou 26 caracteres, e é a mesma que o
  coletor de origem lê na vitrine: dos 39 pedidos de 13 a 16/11, os 34 feitos
  depois de o coletor entrar na loja ligaram ao visitante pela sessão. Em 27
  deles a página de confirmação também tinha visto o pedido e apontava o mesmo
  visitante; em 4 apontava outro, e isso ainda não foi investigado (a conta dá
  preferência à sessão).
- **A API continua sem dizer a origem do pedido.** Olhados os nomes de todos os
  campos do pedido completo: o que existe é `partner_id` e `partner_name` (o
  catálogo, 1516 é o do Facebook), que o painel já grava como parceiro.
- **A lista de pedidos não mostra pedido fechado há muito tempo.** A loja
  responde 1.834 pedidos no total, o mais antigo de 13/11/2025. Dos 1.063
  pedidos que o painel tem de 12/05 a 10/08/2026, todos finalizados ou
  cancelados, NENHUM aparece na lista, e todos respondem quando pedidos um a
  um pelo número (`/orders/{id}/complete`). Os que continuam na lista dessa
  época são os que a loja nunca fechou (419 ainda como "A ENVIAR"). Para a
  rotina isso não muda nada: ela anda pelo que foi alterado, e pedido alterado
  agora está na lista. Para trazer histórico, muda: a lista não basta.

**A API não traz a origem do pedido.** A exportação tem a coluna "UTM Source",
a API não tem nada parecido (olhado campo por campo no pedido completo). Por
isso a gravação nunca troca uma origem já lida por vazio (migration 0063), e a
exportação continua sendo quem diz de onde veio a venda.

## Loja de testes

Só existe fora de produção. Com o servidor local ligado, abrir
`http://localhost:3000/guias/api/tray/conectar?loja=teste` num navegador logado
no painel da loja de testes instala o aplicativo e guarda a autorização.
Pedido da loja de testes nunca é gravado em `tray_pedidos`: a função de
gravar recusa qualquer loja que não seja a da JK.

## Homologação

A regra da Tray: "Caso o aplicativo consuma menos que 2 POST e 2 PUT em 2
recursos, será necessário realizar algumas requisições, via POSTMAN ou
INSOMNIA". Em 13/11/2026 o aplicativo só lia, então as quatro foram feitas à
parte, na loja de testes, em dois recursos sem dado pessoal:

| Requisição | Retorno |
| --- | --- |
| `POST /categories` | 201, categoria 3743 |
| `PUT /categories/3743` | 200 |
| `POST /products` | 201, produto 93525 |
| `PUT /products/93525` | 200 |

**Pedidos ficaram de fora de propósito:** cadastrar pedido pela API exige um
cliente com CPF, e CPF inventado tem chance real de ser o de alguém. Se a Tray
pedir escrita em pedidos, o caminho é o Filipe indicar um cliente de teste.

As requisições foram feitas por uma rota temporária, só local e só para a loja
de testes, apagada em seguida. Detalhes que a API cobrou: `POST /categories`
recusa o campo `order` ("Não é possível salvar a ordenação manualmente").

**Desde 13/11/2026 o aplicativo também escreve**, por decisão do dono do
projeto (`docs/loja-pelo-painel.md`): altera produto (`PUT /products/{id}`) e
envia foto (`POST /products/{id}/images`), sempre por uma pessoa e pelo caminho
único de `src/lib/loja/alterar.ts`. Em pedido ele continua só lendo. A Tray
exige evidência de TODA requisição que o aplicativo usa, feita na loja de
testes, então em 14/11 foi gerada a evidência dessas duas, com a leitura do
produto antes e depois (`evidencias-de-produto-e-fotos.md`).

As evidências estão em `entregas/tray-homologacao/` (fora do git):
`evidencias-de-leitura.md`, `evidencias-de-escrita.md` e
`evidencias-de-produto-e-fotos.md`, com URL, JSON e retorno de cada requisição
e o token mascarado. A conferência campo a campo do formulário está em
`conferencia-do-formulario.md`, na mesma pasta.

**O chamado foi aberto pelo Filipe em 14/11/2026**, pelo formulário de
homologação da Tray (Octadesk, "Parcerias técnico"), com o título que a Tray
pede, "Homologacao Loja 1305187 - Relatorios de pedidos e vitrine" (sem
acento), e os três arquivos anexados.

**A Tray homologou em 16/11/2026, às 17h50**, no mesmo chamado (#2125522),
depois da resposta descrita abaixo: "o aplicativo está homologado", e na mesma
mensagem "o app foi liberado na loja de ID 1305187". O segundo chamado, de
liberação pontual, não foi preciso.

**Antes disso, no mesmo dia, ela tinha respondido pedindo outra forma, e não
outro conteúdo.** São quatro exigências:

1. Preencher o modelo dela, um `.docx` ("Modelo Homologação de Aplicativo"),
   com a requisição e a resposta de cada rota em texto. Print não é aceito.
2. Deixar À MOSTRA o access token usado nos testes, e o mesmo em todas as
   evidências. Os arquivos de 14/11 tinham o token trocado por `***`.
3. Escrever no CORPO do e-mail todas as rotas que a integração consome, com o
   método de cada uma. Só no anexo não basta.
4. Se o aplicativo fosse um ERP, as rotas de MultiCD. Não é o caso.

No mesmo dia as requisições foram refeitas na loja de testes, numa rodada só e
com um token só, e o modelo foi preenchido. Na pasta de evidências:

- `Homologacao-Loja-1305187-Relatorios-de-pedidos-e-vitrine.docx`, o anexo.
- `resposta-ao-chamado.md`, o texto do e-mail com as rotas.
- `ferramentas/`, para refazer: a rota temporária (só local, 404 em produção,
  some antes de qualquer commit) e o `montar.py`, que preenche o modelo a
  partir do resultado dela e recusa gerar o arquivo se sobrar segredo.

As rotas que o aplicativo consome são sete: `POST /auth`, `GET /auth` (com
`refresh_token`), `GET /orders`, `GET /orders/{id}/complete`,
`GET /products/{id}`, `PUT /products/{id}` e `POST /products/{id}/images`. O
cliente (`src/lib/tray/cliente.ts`) ainda tem leitura de categorias, de produtos
em lista e de variações, mas ninguém chama: o catálogo vem da busca pública.
**Rota nova da API só entra em uso depois de ter evidência**, senão o
aplicativo homologado passa a fazer o que a Tray não viu.

O access token da loja de testes aparece por inteiro no documento (vale três
horas). Refresh token, chave e segredo do aplicativo e código da instalação
continuam trocados por `***`: o código da instalação continua valendo (o de
13/11 gerou token novo em 16/11), e com ele e as chaves qualquer um gera token. Os dados pessoais do cliente do pedido
também ficam escondidos. O campo de webhook foi como "N/A", porque o webhook do
catálogo não está cadastrado na Tray. O Filipe respondeu o chamado no mesmo dia.

A documentação da Tray diz que homologado não é liberado, e que a liberação
para a loja é outro chamado ("Liberar o aplicativo para loja (PONTUAL)"). Aqui
as duas coisas vieram juntas, na mesma resposta.

A categoria 3743 e o produto 93525 ficaram na loja de testes com o nome "Teste
de homologacao JK Aliancas (pode apagar)", e a rodada de 16/11 deixou a
categoria 3783 e o produto 93611, com o mesmo nome e um "2". Apagar depois da
homologação.

## Como foi ligada, em 16/11/2026

1. **Instalar.** O Filipe instalou o aplicativo pelo painel da loja
   (Aplicativos, Instalar novos aplicativos). Por esse caminho a Tray não
   manda o navegador de volta para o portal: ela mostra a tela "Dados da
   autorização", com o endereço da API e o código, para "encaminhar ao
   desenvolvedor".
2. **Trocar o código pelo token.** Feito por um script, fora do repositório,
   com as mesmas travas de `/api/tray/retorno`: endereço em domínio da Tray, o
   código aceito com as chaves do nosso aplicativo, e o `store_id` da RESPOSTA
   igual a 1305187. Só então a linha `tray_loja` foi gravada. A API da loja da
   JK mora em `c1mmuc48.commercesuite.com.br`, e não no domínio da loja.
3. **Conferir, sem gravar.** `{"modo": "conferir", "dias": 3}` leu 48 pedidos:
   23 iguais, 14 que só existiam na API, 11 com o status adiantado e nenhum
   diferente só na escrita. Os 14 e os 11 tinham a mesma causa: a exportação
   estava parada desde 15/11 (a Tray deslogou no Chrome no fim de semana, e no
   dia 16 o Chrome deixou de salvar o arquivo baixado), e o painel estava dois
   dias sem pedido novo.
4. **Comparar campo por campo.** A conferência da rota só olha status, situação
   e total. Um script leu 120 pedidos recentes e 50 de junho e comparou tudo,
   itens inclusive. Foi aí que apareceram as três diferenças de escrita, o
   corte em 300 caracteres e o filtro que inclui o instante (seção acima).
   Corrigido o código, a comparação foi repetida: sobraram só a origem (que a
   API não tem e a gravação preserva), a sessão (que a exportação não tem) e os
   status que de fato tinham andado.
5. **Ligar.** Com o código no ar, três rodadas levaram os 419 pedidos alterados
   nos últimos 35 dias: 15 novos e 11 com status novo, e todos passaram a ter a
   sessão. Então a 0101 foi aplicada. Em Vendas, o dia 15 e o dia 16
   apareceram.

## Para operar

- **Rodar agora, sem esperar o relógio:** `select public.disparar_leitura_de_pedidos();`.
  O resultado aparece em `rotinas_pulso` (linha `pedidos-api`) uns vinte
  segundos depois, e em `sync_logs` (fonte `tray_pedidos_api`) quando a rodada
  leu algum pedido. Rodada sem pedido não deixa linha, de propósito.
- **Não dispare duas rodadas cheias no mesmo minuto.** Uma rodada de 150
  pedidos são 153 chamadas, e o limite da Tray é de 180 por minuto.
- **Conferir de novo:** a rota aceita `{"modo": "conferir", "dias": N}` a
  qualquer hora. Não grava e não deixa pulso.
- **Se a rotina parar,** a Saúde mostra "Pedidos da loja" em vermelho depois de
  uma hora sem rodada boa, e Vendas e a Visão geral avisam depois de três
  horas sem leitura boa por nenhuma das duas portas.
- **Se o aplicativo for tirado da loja,** o token deixa de valer e a rodada
  responde erro. Instalado de novo, o código muda. O caminho de volta é o
  botão "Autorizar na loja da JK" do cartão em Integrações, logado no painel da
  Tray com usuário administrador, ou repetir os passos 1 e 2 acima.
- **O token** vale três horas e o painel renova sozinho pelo refresh token, que
  vale trinta dias a partir de cada renovação.

## O que falta

- **O histórico.** O painel não tem 602 pedidos que a loja tem na lista, quase
  todos de maio a outubro (419 pagos e nunca fechados na loja), porque as
  exportações nunca cobriram esses períodos por inteiro: de 11/08 a 31/08 não
  há pedido nenhum no painel. E 1.630 pedidos antigos estão sem os itens. A
  lista da API traz os 602; os outros vêm um a um pelo número, que é
  sequencial. Não foi feito em 16/11: muda os números dos meses passados e
  pode pôr pedido antigo na fila da fábrica, então é decisão de quem usa.
- **A exportação.** Ela precisa voltar a rodar para a origem (UTM Source), e
  pode rodar menos vezes por dia.
- **Estoque e variações.** O espelho do catálogo continua sem estoque, porque
  vem da busca pública. `GET /products/{id}` traz o estoque do produto e está
  entre as rotas homologadas; variações pedem rota nova, e rota nova pede
  evidência antes de entrar em uso.
- **Escrita em pedido** (status e rastreio da fábrica para a loja) continua sem
  teste e sem evidência.

Se um dia a API da loja da JK passar a responder no próprio domínio
(`www.jkaliancas.com.br/web_api`), o pedido do servidor passa pela Cloudflare
antes de chegar à Tray. Hoje não passa.
