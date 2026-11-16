# Pedidos da Tray pela API

A Tray mandou as chaves do aplicativo **Loja 1305187 - Relatórios de pedidos e
vitrine** em 13/11/2026. Com ele o portal lê os pedidos direto da loja, sem
ninguém exportar arquivo e sem depender do Mac ligado. No mesmo dia a leitura
foi montada e testada contra a loja de testes da Tray. **Na loja da JK ela
ainda não roda:** falta a Tray homologar o aplicativo.

Enquanto isso, os pedidos continuam entrando pela exportação de hora em hora
(`docs/tray-exportar-pedidos.md`). A tabela é a mesma, `tray_pedidos`.

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

**A Tray respondeu em 16/11/2026 (chamado #2125522) pedindo outra forma, e não
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
catálogo não está cadastrado na Tray. **Quem responde o chamado é o Filipe.**
Falta a Tray responder.

**Homologado não é liberado.** Depois da homologação, a liberação do
aplicativo para a loja 1305187 é OUTRO chamado ("Liberar o aplicativo para loja
(PONTUAL)"), pelo link "Clique aqui para solicitar a liberação do app" na
página de homologação da documentação da Tray. Sem ele o aplicativo não aparece
para instalar na loja de verdade.

A categoria 3743 e o produto 93525 ficaram na loja de testes com o nome "Teste
de homologacao JK Aliancas (pode apagar)", e a rodada de 16/11 deixou a
categoria 3783 e o produto 93611, com o mesmo nome e um "2". Apagar depois da
homologação.

## No dia em que a Tray homologar

1. **Autorizar.** Em Integrações, "Autorizar na loja da JK", logado no painel
   da Tray com usuário administrador. O cartão passa para "Autorizada".
2. **Conferir, sem gravar.** Chamar a rota com `{"modo": "conferir", "dias": 3}`
   e o segredo das rotinas. A resposta compara o que a API devolveu com o que
   as exportações gravaram: quantos iguais, quantos só existem na API e as
   diferenças de status, situação e total.
3. **Olhar o status.** Se `soDiferemNaEscrita` vier maior que zero, as duas
   portas escrevem o mesmo status de jeitos diferentes ("A ENVIAR" e
   "A enviar"). Não ligue a gravação assim: cada rodada de uma desfaria a da
   outra e o histórico de mudança de status encheria de troca que não houve.
   Primeiro iguale a escrita em `pedidoDaApi`.
4. **Ligar o relógio.** Só então criar a migration que agenda
   `/api/cron/pedidos-da-tray` no `pg_cron`, de dez em dez minutos, no mesmo
   desenho da 0060. A primeira leitura parte de 35 dias atrás e anda 150
   pedidos por rodada.
5. **Reduzir a exportação.** Com a API gravando, a rotina do Mac só precisa
   rodar para trazer a origem. Uma ou duas vezes por dia bastam.

Se a API da loja da JK vier no próprio domínio (`www.jkaliancas.com.br/web_api`),
o pedido do servidor passa pela Cloudflare antes de chegar à Tray. Se a
Cloudflare barrar, o erro aparece no cartão de Integrações.
