# Appmax pela API: o que foi descontado de cada venda

Cartão 78. Lê da Appmax, pedido a pedido, o que ela ficou da venda (taxa de processamento, gateway e antifraude, parcelamento) e o líquido que a JK recebe. É a taxa REAL, no lugar da estimativa da Margem.

## Como funciona
1. **O vínculo.** O pedido da Tray guarda o número do pedido da Appmax em `Payment[].unique_number` (`AM-133444274`) e no começo de `Payment[].note`. A rotina de pedidos da Tray (`lib/vendas/pedidos-da-api.ts`) tira esse número do pedido completo que já lê e grava em `appmax_pedidos` (0205), sem chamada a mais. O que veio antes da ligação entra pela rotina da Appmax, que a cada rodada liga uns 25 pagos dos últimos 35 dias.
2. **A leitura.** `/api/cron/appmax`, de 10 em 10 minutos (`pg_cron`, `disparar_leitura_da_appmax`), pede `GET /v1/orders/total-liquid/{id}` dos pagos ainda sem leitura. Pulso `appmax` na Saúde.
3. **A credencial.** Client ID e Client Secret de Produção, em Appmax, API, Gerar credenciais. Colados no cartão da Appmax em Integrações, vão para `integration_tokens` (`appmax`, o segredo em `access_token`, o ID em `meta.client_id`) e nunca voltam para a tela. O painel só lê.

## O que foi medido em 23/11/2026
- A especificação diz que `total-liquid` usa o cabeçalho `secret`. Na prática o **Bearer** (OAuth, `client_credentials`) responde 200 com os mesmos números da tela "Ver taxas"; o `secret` com o Client Secret responde 401. O cliente usa só o Bearer.
- Pedido no cartão de R$ 500,27: 3,49% = R$ 17,46 mais R$ 0,99 de gateway e antifraude, líquido R$ 481,82. Pix de R$ 398,71: 0,89% = R$ 3,55 mais R$ 0,99, líquido R$ 394,17. **O R$ 0,99 é um só por venda, nos dois meios.** A taxa do cartão incide sobre o total do pedido, frete incluso.
- 255 pedidos pagos pela Appmax em 35 dias (R$ 103.660,84): descontado R$ 2.613,69, ou **2,52%** (cartão 3,69%, Pix 1,19%). Parcelamento: R$ 0, a JK absorve o parcelamento sem juros e a Appmax não cobra à parte. Cartão em 6,1 parcelas em média (valor ponderado).

## O que a API NÃO entrega
Listagem de pedidos do lojista, antecipação, saque e estorno. A antecipação (2,49% ao mês, proporcional aos dias) é custo à parte: com parcelas de 6,1x em média, antecipar tudo custa cerca de 2,49% x 3,55 meses = 8,8% do valor do cartão. A fração realmente antecipada vem do Extrato financeiro (a Appmax manda por e-mail) ou do histórico da tela Saque.

## Para mexer
- Conta pura e leitura do pedido da Tray: `src/lib/appmax/liquido.ts` (teste em `scripts/teste-pedidos-tray.mts`, bloco "Appmax").
- Cliente (só Bearer, endereços fixos): `src/lib/appmax/cliente.ts`. Leitura: `ler.ts`. Vínculo: `vincular.ts`. Estado da tela: `estado.ts`.
- Pedido a pedido pode ser relido apagando `lido_em` da linha; pedido com cinco erros para de ser perguntado (`tentativas`).
