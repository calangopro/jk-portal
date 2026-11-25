import type { Tutorial } from "../tipos.ts";

export const margem: Tutorial = {
  href: "/admin/margem",
  resumo: "Quanto sobra em cada peça e até quanto dá para dar de desconto.",
  versoes: {
    todos: [
      {
        titulo: "Veja quanto do catálogo tem custo",
        texto: "A cobertura conta os produtos que o painel calcula pelas regras, os que têm peso ou custo gravado e os que ficam sem custo, com o motivo de cada grupo.",
        print: "margem-1.webp",
        regiao: { x: 24.4, y: 49.8, l: 73.1, a: 48 },
        alt: "Bloco Cobertura do custo com três cartões e a lista dos motivos de quem está sem custo.",
      },
      {
        titulo: "Revise as promoções abaixo da margem",
        texto: "A lista mostra a promoção que está valendo na loja e deixa menos do que a margem mínima. Toque no nome do produto para abrir e ajustar.",
        print: "margem-6.webp",
        regiao: { x: 24.4, y: 5.6, l: 73.1, a: 21.4 },
        alt: "Lista de promoções de hoje abaixo da margem mínima, com o desconto e a margem de cada produto.",
      },
      {
        titulo: "Troque o preço do grama",
        texto: "Quando o ouro ou a prata mudar, edite o preço do grama e toque em Salvar parâmetros. Todas as margens se recalculam sozinhas.",
        print: "margem-2.webp",
        regiao: { x: 24.4, y: 23, l: 35.8, a: 13 },
        alt: "Campos de preço do grama do ouro 18k e 10k nos parâmetros.",
      },
      {
        titulo: "Preencha as regras de custo",
        texto: "Escreva as gramas por milímetro de cada material, o peso de cada modelo, as pedras, o brinde, a caixinha e a folga, e toque em Salvar regras. O painel lê o nome de cada produto e calcula o custo.",
        print: "margem-5.webp",
        regiao: { x: 24.4, y: 11.2, l: 73.1, a: 58 },
        alt: "Bloco Regras de custo das peças com os campos de gramas por milímetro da prata e do ouro.",
      },
      {
        titulo: "Preencha as taxas da Appmax",
        texto: "Em Taxas do gateway, escreva a taxa do cartão e do Pix, a antecipação e a tarifa fixa por venda. A taxa efetiva aparece embaixo e entra em toda margem. Campo vazio conta zero.",
        print: "margem-4.webp",
        regiao: { x: 24.4, y: 10.5, l: 35.8, a: 89 },
        alt: "Bloco Taxas do gateway com os campos de tarifa fixa, taxa do cartão, do Pix e da antecipação.",
      },
      {
        titulo: "Importe a planilha de custos",
        texto: "Toque em Escolher a planilha e envie o arquivo .xlsx preenchido. Só as células com valor entram, e célula vazia nunca apaga um custo que já está lá.",
        print: "margem-2.webp",
        regiao: { x: 61.7, y: 8.6, l: 35.8, a: 22 },
        alt: "Bloco Importar a planilha do dono com o botão Escolher a planilha.",
      },
    ],
  },
};
