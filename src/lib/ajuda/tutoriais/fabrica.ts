import type { Tutorial } from "../tipos.ts";

export const fabrica: Tutorial = {
  href: "/admin/fabrica",
  resumo: "Acompanhe cada pedido pago da produção até o envio e mova de etapa conforme a peça anda.",
  versoes: {
    todos: [
      {
        titulo: "Escolha a etapa",
        texto: "Os quatro cartões de cima são as etapas: A produzir, Em produção, Pronto e Enviado. Toque numa delas para ver os pedidos que estão ali. O número é quantos pedidos tem em cada.",
        print: "fabrica-1.webp",
        regiao: { x: 24.4, y: 32.8, l: 73.1, a: 8.1 },
        alt: "Os quatro cartões de etapa da fila da fábrica, cada um com a contagem de pedidos.",
      },
      {
        titulo: "Procure um pedido",
        texto: "Digite o número do pedido, o nome do cliente, a peça ou até o texto da gravação. Os botões embaixo filtram por tipo de entrega e mostram só os atrasados.",
        print: "fabrica-1.webp",
        regiao: { x: 24.4, y: 48.7, l: 73.1, a: 11 },
        alt: "Campo de busca e filtros de entrega da fila.",
      },
      {
        titulo: "Leia o que a peça pede",
        texto: "Cada cartão mostra a numeração de cada aro e o texto da gravação, do jeito que o cliente escreveu. A data fica em âmbar depois de 4 dias do pagamento e em vermelho depois de 7.",
        print: "fabrica-2.webp",
        regiao: { x: 24.4, y: 12.3, l: 36.3, a: 40 },
        alt: "Cartão de um pedido com numeração e gravação a laser.",
      },
      {
        titulo: "Toque no botão grande para andar uma etapa",
        texto: "O botão verde leva o pedido para a etapa seguinte. Se a peça pulou uma etapa, toque em Mudar etapa e escolha para onde ela vai.",
        print: "fabrica-2.webp",
        regiao: { x: 25.7, y: 51.8, l: 47.4, a: 11.6 },
        alt: "Botões Começar a produzir, Anotar e Mudar etapa de um pedido.",
      },
      {
        titulo: "Mova vários de uma vez",
        texto: "Toque em Marcar vários, escolha os pedidos e toque na etapa de destino. O painel pede confirmação com a contagem antes de mover.",
        print: "fabrica-3.webp",
        regiao: { x: 24.4, y: 40.6, l: 73.1, a: 14.5 },
        alt: "Barra de seleção com dois pedidos escolhidos e os botões de etapa de destino.",
      },
    ],
  },
};
