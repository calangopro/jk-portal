import type { Tutorial } from "../tipos.ts";

export const gargalos: Tutorial = {
  href: "/admin/gargalos",
  resumo: "O mapa de onde o dinheiro vaza, do anúncio até o pagamento.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em Este mês, 7 dias, 30 dias ou Mês passado. Trinta dias é o melhor para começar, porque em sete há pouco pedido para a conta valer.",
        print: "gargalos-1.webp",
        regiao: { x: 70.2, y: 29.8, l: 27.3, a: 4.4 },
        alt: "Seletor de período no alto da tela de Gargalos.",
      },
      {
        titulo: "Comece pelo mapa de gargalos",
        texto: "Cada cartão diz onde o dinheiro vaza, a gravidade e o motivo. Os que mais custam vêm primeiro, então resolva de cima para baixo.",
        print: "gargalos-1.webp",
        regiao: { x: 24.4, y: 37, l: 73.1, a: 40 },
        alt: "Três cartões do mapa de gargalos, em ordem de gravidade.",
      },
      {
        titulo: "Siga o link do cartão",
        texto: "No fim de cada cartão há um link, como Abrir a fila de recuperação. Toque nele para ir direto à tela onde o problema se resolve.",
        print: "gargalos-1.webp",
        regiao: { x: 25.4, y: 54, l: 16, a: 3.6 },
        alt: "Link Abrir a fila de recuperação no fim do primeiro cartão.",
      },
      {
        titulo: "Veja onde o caminho perde mais gente",
        texto: "O funil vai da visita ao pagamento. A barra de cada etapa mostra quanto da anterior passou, e a maior perda aparece em vermelho.",
        print: "gargalos-2.webp",
        regiao: { x: 24.4, y: 34.5, l: 73.1, a: 9 },
        alt: "Etapa Puseram no carrinho marcada em vermelho como a maior perda do caminho.",
      },
      {
        titulo: "Compare a plataforma com a loja",
        texto: "Para cada plataforma, veja o que ela diz que vendeu e o que a loja recebeu de verdade. A diferença mostra quanto o número dela está inflado.",
        print: "gargalos-3.webp",
        regiao: { x: 24.4, y: 11.3, l: 73.1, a: 47.4 },
        alt: "Quadro A plataforma contra a loja, com Meta e Google Ads lado a lado.",
      },
      {
        titulo: "Confira a conta da margem",
        texto: "Esse quadro mostra quanto cada venda pode gastar em anúncio com a margem de referência. Se cada venda custou mais que isso, o anúncio está caro.",
        print: "gargalos-3.webp",
        regiao: { x: 24.4, y: 61.7, l: 73.1, a: 26.4 },
        alt: "Quadro Por que o anúncio fica caro, com o máximo por venda e o custo de cada venda paga.",
      },
    ],
  },
};
