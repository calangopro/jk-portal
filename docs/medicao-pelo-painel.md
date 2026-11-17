# Medição pelo painel (liga em 01/12/2026)

Decisão do Filipe em 17/11/2026, depois do diagnóstico de marcação
(`infra/gtm/README.md`, seção de 16/11): o Meta, o catálogo e a loja do
Facebook e do Instagram deixam de depender da integração da Tray. Tudo é
construído agora, fica desligado ou em modo de teste, e liga em 01/12, quando o
Filipe assume o tráfego. As campanhas não mudam durante a Black (estrutura
congelada até 01/12).

## Por quê

- A integração "Facebook e Instagram" da Tray caiu em 15/11 para todas as lojas
  (o aplicativo dela no Meta foi apagado) e o app "Google Ads" da Tray já tinha
  caído em 17/09. Ninguém da JK vê quando isso acontece.
- Ela conta o pedido CRIADO como compra. De 13/10 a 14/11, 64% do valor dos
  pedidos criados não foi pago, e as campanhas otimizam para quem faz pedido.
- Não deixa desligar só o pixel nem só a compra (resposta da Tray em 24/09).
- O painel já tem o que importa: os pedidos pela API de dez em dez minutos, o
  coletor de origem com cookie gravado pelo servidor, o envio ao Meta pronto
  para o Lead do grupo e a lista de produtos sincronizada de 15 em 15 minutos.

Stape e GTM de servidor no Google Cloud foram descartados: são um cano entre o
site e as plataformas, não sabem se o pedido foi pago, e somariam uma conta e
um fornecedor sem trazer o que o painel já tem.

## Como fica

| Peça | Hoje | A partir de 01/12 |
|---|---|---|
| Pixel do Meta na loja | Integração da Tray (parada desde 15/11) | Etiquetas no GTM, com número de evento fixo |
| Envio pelo servidor ao Meta | Servidor da Tray | Painel: a compra sai do pedido lido pela API, com e-mail e telefone em SHA-256 |
| Compra paga | Não existe | Painel manda `CompraPaga` ao Meta (a conversão personalizada "Compra Paga" já existe) e uma ação "Compra paga" ao Google |
| Pedido cancelado no Google | Fica contado | Painel retira (ajuste de conversão pelo número do pedido) |
| Catálogo do Meta | Arquivo da Tray (`/xml/xml.php`), lido de hora em hora | Arquivo gerado pelo painel, com os MESMOS códigos de produto |
| Loja do Facebook e do Instagram | Commerce Manager, alimentada pelo catálogo | A mesma, alimentada pelo catálogo do painel |
| Google Ads, compra no navegador | Etiqueta do GTM (certa) | A mesma, como secundária quando a "Compra paga" virar principal |
| GA4 | Integração nativa da Tray | Igual |

### Os números de evento (o que evita contar em dobro)

O navegador e o servidor mandam o MESMO evento com o MESMO `event_id`, e o Meta
conta uma vez:

| Evento | `event_id` | Navegador (GTM) | Servidor (painel) |
|---|---|---|---|
| `Purchase` | `pedido-<número>` | no evento `purchase` da Tray | ao ler o pedido novo pela API |
| `CompraPaga` | `pago-<número>` | não | quando o pedido vira pago |
| `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout` | gerado no navegador | sim | não, na primeira fase |

**O pixel da Tray precisa estar desligado no dia em que o do GTM ligar.** A
Tray gera números de evento próprios, que não batem com os nossos: com os dois
ligados, cada evento conta duas vezes. Hoje o pixel dela está mudo pela falha
de 15/11; como desligar de vez sem perder o catálogo é a pergunta 2 do chamado.

### O que o servidor precisa saber de quem comprou

O Meta casa melhor a compra com quem viu o anúncio quando recebe, além do
e-mail e do telefone, os cookies `_fbp` e `_fbc` do pixel, o navegador e o IP.
Para eventos de site, o navegador (`client_user_agent`) é obrigatório.

O coletor (`public/o.js`) não guarda navegador nem IP no que anota, de
propósito, e **não precisou mudar**: ele já chama `/api/origem` na página de
confirmação com o número do pedido, e essa chamada é do mesmo domínio, então os
cookies `_fbp` e `_fbc` chegam sozinhos ao servidor. A rota lê os dois, o
navegador e o IP que o Worker repassa (`x-jk-ip-cliente`), e
`registrarRecado` guarda em `meta_sinais` só quando há número de pedido e só
com o envio em teste ou ligado. Apagado em 30 dias (`limpar_meta_sinais`, às
4h40). Precisa entrar na política de privacidade antes de ligar (Kathleen).

### Como o envio do servidor decide

A conta é pura, em `src/lib/meta/compra.ts`, com 53 conferências em
`npm run verificar:meta` (no build):

- **Purchase** só vai com o navegador de quem comprou (evento de site sem
  `client_user_agent` o Meta recusa). Sem ele, espera 30 minutos pelo recado da
  confirmação e depois deixa de lado: o pixel cobre.
- **CompraPaga** vai como `website` com o navegador e como `system_generated`
  sem ele, porque o pagamento acontece longe do site.
- O Meta só aceita evento de até 7 dias. O corte escolhido ao ligar ("de agora
  em diante" ou "os últimos 7 dias") impede mandar compra que a Tray já mandou
  com outro número.
- Erro é tentado de novo até 5 vezes; mandado em teste não repete em teste e
  vai de novo ao ligar de verdade.
- **Se a Tray voltar a mandar ao Meta** (`/nocache/facebook-info.php` com
  pixel e sem erro de autenticação), a Purchase fica em pausa e só a
  `CompraPaga` segue: a compra não conta duas vezes.
- O código de "Eventos de teste" da compra é próprio, separado do código do
  Lead: testar a compra não põe o Lead em teste.
- "Simular agora", no cartão, monta o que iria sem mandar nem gravar e diz
  quantos eventos e quais campos de cliente.

## As frentes

| # | Frente | Onde | Migrations | Estado |
|---|---|---|---|---|
| 1 | Envio ao Meta pelo servidor: `Purchase` e `CompraPaga`, fila com nova tentativa, modo de teste, chave em Integrações, linha na Saúde | este ramo | 0120 | construída, desligada; a 0120 entra depois do deploy |
| 2 | Sinais do navegador (`_fbp`, `_fbc`, navegador, IP) guardados na confirmação | este ramo | junto da 1 | construída, sem mudar o `o.js` |
| 3 | Pixel do Meta da loja no GTM, sem publicar | `infra/gtm/loja-meta.json` | nenhuma | arquivo pronto e testado, etiquetas pausadas; importa no dia |
| 4 | Arquivo do catálogo do Meta (e o do Google Merchant) gerado pelo painel, conferido item a item contra o da Tray | ramo próprio | 0130 a 0134, se precisar | a construir |
| 5 | Google Ads: "Compra paga" e retirada dos cancelados pela API, primeiro em validação | ramo próprio | 0135 a 0139, se precisar | a construir |
| 6 | Tela única de acompanhamento: o que saiu para cada plataforma, o que falhou, chave liga e desliga | este ramo | junto da 1 | o cartão do Meta em Integrações ("Medição da loja") e a linha "Compras para o Meta" na Saúde; Google e catálogo entram com as frentes 4 e 5 |

### A ordem de subir

Deploy primeiro, a 0120 depois, pela API de gestão (ela leva `delete`, que o
conector do Supabase recusa). Sem a migration o código novo não quebra nada: o
cartão aparece como "Desligado" e o coletor não guarda sinal nenhum, porque a
configuração não existe. A 0120 cria o relógio de dez em dez minutos, que só
deixa o pulso enquanto o modo estiver desligado. Pode entrar bem antes de
01/12: ligado mesmo, só pela tela.

## O que depende do Filipe

- Gerar o token da API de Conversões para o servidor: usuário do sistema do
  portfólio com o conjunto de dados `364357034958645` atribuído. Pede a
  aprovação de outro administrador.
- Google Ads: acesso de edição para a conta de serviço do painel (hoje
  "Somente leitura") e aceitar os termos de dados do cliente.
- Política de privacidade revisada (com a Kathleen).
- A resposta da Tray sobre desligar o pixel sem perder o catálogo.
- Acesso ao Merchant Center `5340083361`, que o Trello registra preso a um
  login da V4 (para trocar o feed do Google).

## Roteiro de 01/12 (o dia de ligar)

1. Conferir na aba Versões do GTM se a ativa é a mais recente.
2. Desligar o pixel da integração da Tray (pelo caminho que a Tray indicar).
3. Importar `infra/gtm/loja-meta.json`, despausar, Visualizar e publicar
   (passo a passo em `infra/gtm/README.md`, "Pixel do Meta da loja pelo GTM").
4. Ligar o envio do servidor em Integrações, primeiro em **Em teste** com o
   código de "Eventos de teste" do Meta, conferir que navegador e servidor
   chegam com o mesmo número, e então **Ligado**, com o corte "de agora em
   diante".
5. Trocar no Commerce Manager o endereço do arquivo do catálogo pelo do painel.
6. Conferir no dia seguinte: uma `Purchase` por pedido, desduplicação "atende
   às boas práticas", catálogo sem erro, `CompraPaga` igual aos pedidos pagos.
7. Decidir, campanha por campanha, se a otimização passa para "Compra paga".

**Para voltar:** pausar as etiquetas do Meta no GTM e publicar, desligar o envio
do servidor em Integrações, e devolver o endereço do arquivo da Tray no
Commerce Manager (`https://www.jkaliancas.com.br/xml/xml.php?Chave=...`, o
valor completo está no próprio Commerce Manager).
