import type { Tutorial } from "../tipos.ts";

export const vendedores: Tutorial = {
  href: "/admin/vendedores",
  resumo: "Veja quanto cada vendedor vendeu no período, por fora da loja e na loja, e confira vendas que parecem repetidas.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em Este mês, 7 dias, 30 dias ou Mês passado. O ranking e os cartões se refazem para esse intervalo, e a data do período aparece ao lado.",
        print: "vendedores-1.webp",
        regiao: { x: 70.2, y: 35.2, l: 27.3, a: 4.8 },
        alt: "Seletor de período no alto da tela de vendedores.",
      },
      {
        titulo: "Leia os quatro cartões",
        texto: "Quem mais vendeu mostra o primeiro do ranking. Vendido por fora soma o que foi registrado em Registrar venda. Pedidos da loja marcados soma os pedidos do site que alguém marcou como seus. O último é dinheiro de cliente que voltou.",
        print: "vendedores-2.webp",
        regiao: { x: 24.4, y: 13.4, l: 73.1, a: 22.2 },
        alt: "Cartões Quem mais vendeu, Vendido por fora, Pedidos da loja marcados e Veio de pedido recuperado.",
      },
      {
        titulo: "Compare cada pessoa na tabela",
        texto: "A tabela vai do maior para o menor. A coluna De onde separa o que veio por fora da loja do que veio de pedido do site marcado. Ticket é o valor médio de cada venda, e Recuperado é o que veio de pedido que tinha travado.",
        print: "vendedores-2.webp",
        regiao: { x: 24.4, y: 45.6, l: 73.1, a: 27.5 },
        alt: "Tabela com cada vendedor, quanto vendeu, de onde veio, ticket e valor recuperado.",
      },
      {
        titulo: "Marque os pedidos que ficaram sem vendedor",
        texto: "A Tray não guarda quem vendeu. Quando o aviso diz que há pedidos pagos sem vendedor, cada pessoa marca os seus em Pedidos do site, com o botão Fui eu que vendi. Só assim eles entram na conta.",
        print: "vendedores-2.webp",
        regiao: { x: 24.4, y: 37.3, l: 60, a: 5.5 },
        alt: "Aviso com a quantidade e o valor dos pedidos pagos ainda sem vendedor marcado.",
      },
      {
        titulo: "Confira as vendas que parecem repetidas",
        texto: "Quando alguém lança uma venda parecida com outra, ela entra, mas aparece em Para conferir. Veja se o cliente e o valor não foram contados duas vezes, e peça o estorno de quem lançou se for o caso.",
        print: "vendedores-2.webp",
        regiao: { x: 24.4, y: 76.1, l: 73.1, a: 18 },
        alt: "Quadro Para conferir com uma venda lançada que parece repetida.",
      },
    ],
  },
};
