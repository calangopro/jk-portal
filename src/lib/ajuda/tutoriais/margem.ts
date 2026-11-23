import type { Tutorial } from "../tipos.ts";

export const margem: Tutorial = {
  href: "/admin/margem",
  resumo: "Quanto sobra em cada peça e até quanto dá para dar de desconto.",
  versoes: {
    todos: [
      {
        titulo: "Veja quantos produtos têm custo",
        texto: "Os três cartões contam quantos produtos já têm custo e quantos estão abaixo da margem mínima, hoje e no preço cheio. Número vermelho pede atenção.",
        print: "margem-1.webp",
        regiao: { x: 24.4, y: 31.9, l: 73.1, a: 14.9 },
        alt: "Três cartões com produtos com custo, promoções abaixo da margem e preço cheio abaixo da margem.",
      },
      {
        titulo: "Revise as promoções abaixo da margem",
        texto: "A lista mostra a promoção que está valendo na loja e deixa menos do que a margem mínima. Toque no nome do produto para abrir e ajustar.",
        print: "margem-1.webp",
        regiao: { x: 24.4, y: 49.8, l: 73.1, a: 21.4 },
        alt: "Lista de promoções de hoje abaixo da margem mínima, com o desconto e a margem de cada produto.",
      },
      {
        titulo: "Troque o preço do grama do ouro",
        texto: "Quando o ouro mudar, edite o preço do grama e toque em Salvar parâmetros. Todas as margens se recalculam sozinhas.",
        print: "margem-2.webp",
        regiao: { x: 24.4, y: 23, l: 35.8, a: 13 },
        alt: "Campos de preço do grama do ouro 18k e 10k nos parâmetros.",
      },
      {
        titulo: "Preencha as taxas da Appmax",
        texto: "Em Taxas do gateway, escreva a taxa do cartão e do Pix, a antecipação e a tarifa fixa por venda. A taxa efetiva aparece embaixo e entra em toda margem. Campo vazio conta zero.",
        print: "margem-4.webp",
        regiao: { x: 24.4, y: 10.5, l: 35.8, a: 50 },
        alt: "Bloco Taxas do gateway com os campos de tarifa fixa, taxa do cartão, do Pix e da antecipação.",
      },
      {
        titulo: "Importe a planilha de custos",
        texto: "Toque em Escolher a planilha e envie o arquivo .xlsx preenchido. Só as células com valor entram, e célula vazia nunca apaga um custo que já está lá.",
        print: "margem-2.webp",
        regiao: { x: 61.7, y: 8.6, l: 35.8, a: 22 },
        alt: "Bloco Importar a planilha do dono com o botão Escolher a planilha.",
      },
      {
        titulo: "Preencha o peso de cada família",
        texto: "Cada modelo pesa igual, então o peso vale para a família toda. Escreva os gramas, os aros de referência e o resto, e toque em Salvar na linha.",
        print: "margem-3.webp",
        regiao: { x: 54.8, y: 44.5, l: 30.5, a: 5 },
        alt: "Campos de gramas, aros de referência e resto da primeira família de ouro.",
      },
    ],
  },
};
