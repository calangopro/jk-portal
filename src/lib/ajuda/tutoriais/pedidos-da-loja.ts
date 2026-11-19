import type { Tutorial } from "../tipos.ts";

export const pedidosDaLoja: Tutorial = {
  href: "/admin/vendas",
  resumo: "Acompanhe quanto a loja virtual vendeu hoje, ontem e no mês, de onde vieram as vendas e quais pedidos entraram.",
  versoes: {
    todos: [
      {
        titulo: "Veja hoje, ontem e o mês",
        texto: "Os quatro cartões de cima mostram quanto foi pago hoje, ontem e no mês na loja, e quanto foi vendido por fora da loja. Só pedido pago conta. Pedido esperando pagamento ou cancelado fica de fora.",
        print: "pedidos-da-loja-1.webp",
        regiao: { x: 24.4, y: 38.2, l: 73.1, a: 19.5 },
        alt: "Cartões com o faturamento de hoje, de ontem, do mês na loja e do mês por fora.",
      },
      {
        titulo: "Troque o período que você quer ver",
        texto: "Toque em Este mês, 7 dias, 30 dias ou Mês passado. Tudo que está abaixo muda junto, e cada cartão diz se subiu ou caiu em comparação com o período anterior.",
        print: "pedidos-da-loja-2.webp",
        regiao: { x: 70.2, y: 12.7, l: 27.3, a: 4.8 },
        alt: "Seletor de período com Este mês marcado.",
      },
      {
        titulo: "Leia faturamento, pedidos, ticket e cancelados",
        texto: "O ticket médio é o valor médio de cada pedido pago. Em Cancelados, quanto mais alta a porcentagem, mais pedidos foram criados e não pagos. Vale conversar com o time quando ela passa de 30%.",
        print: "pedidos-da-loja-2.webp",
        regiao: { x: 24.4, y: 20, l: 73.1, a: 25.5 },
        alt: "Cartões de faturamento pago, pedidos pagos, ticket médio e cancelados.",
      },
      {
        titulo: "Procure o melhor dia no gráfico",
        texto: "Cada barra é um dia do período, e a mais escura é o melhor dia. Passe o mouse ou toque numa barra para ver o valor e o número de pedidos. Em Ver em tabela, os mesmos números ficam em lista.",
        print: "pedidos-da-loja-2.webp",
        regiao: { x: 24.4, y: 48.4, l: 73.1, a: 40.4 },
        alt: "Gráfico de barras com o faturamento pago em cada dia do mês.",
      },
      {
        titulo: "Descubra de onde vêm as vendas",
        texto: "De onde vieram as vendas mostra o canal de cada pedido pago, como Instagram, Google ou outros. Ao lado, a forma de pagamento e quanto dos pedidos de cada uma foi cancelado.",
        print: "pedidos-da-loja-3.webp",
        regiao: { x: 24.4, y: 8.8, l: 73.1, a: 32.9 },
        alt: "Quadros com as vendas por canal e por forma de pagamento.",
      },
      {
        titulo: "Toque no número para abrir o pedido",
        texto: "Em Últimos pedidos, cada linha traz cliente, peças, origem, total e se está paga, aguardando ou cancelada. Toque no número do pedido para ver o histórico dele: quem vendeu, a fábrica e o suporte.",
        print: "pedidos-da-loja-4.webp",
        regiao: { x: 24.4, y: 41.1, l: 73.1, a: 52.8 },
        alt: "Lista dos últimos pedidos com número, cliente, origem, total e situação.",
      },
    ],
  },
};
