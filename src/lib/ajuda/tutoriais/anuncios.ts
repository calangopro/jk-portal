import type { Tutorial } from "../tipos.ts";

export const anuncios: Tutorial = {
  href: "/admin/anuncios",
  resumo: "Quanto cada produto aguenta pagar de anúncio por venda sem ficar abaixo da margem mínima.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o preço de venda",
        texto: "O de hoje na loja usa o preço que está valendo agora. Com desconto de campanha mostra o que acontece se você baixar o preço.",
        print: "anuncios-1.webp",
        regiao: { x: 35.7, y: 37, l: 31.5, a: 5.5 },
        alt: "Botões O de hoje na loja e Com desconto de campanha.",
      },
      {
        titulo: "Teste um desconto antes da campanha",
        texto: "Escolha Com desconto de campanha e escreva a porcentagem. Os números da tela mudam na hora, e o aviso diz quantos produtos deixam de aguentar anúncio.",
        print: "anuncios-2.webp",
        regiao: { x: 35.7, y: 37, l: 52, a: 5.5 },
        alt: "Cenário com desconto de campanha e o campo da porcentagem.",
      },
      {
        titulo: "Leia os quatro números",
        texto: "Eles contam os produtos com custo, quantos aguentam anúncio, quantos não aguentam e o limite mediano que dá para pagar por venda.",
        print: "anuncios-1.webp",
        regiao: { x: 24.4, y: 51.2, l: 73.1, a: 10.7 },
        alt: "Quatro cartões de resumo do limite de anúncio.",
      },
      {
        titulo: "Veja onde vale anunciar",
        texto: "À esquerda ficam os produtos que já vendem e têm a maior folga por venda. À direita, os que não aguentam nem um real de anúncio neste preço.",
        print: "anuncios-1.webp",
        regiao: { x: 24.4, y: 63.5, l: 73.1, a: 34.5 },
        alt: "Dois quadros: Onde vale anunciar e Não anuncie neste preço.",
      },
      {
        titulo: "Busque, ordene e baixe",
        texto: "Busque por nome ou código, filtre a categoria e escolha a ordem. Baixar para o gerenciador gera a planilha pronta para o Meta e o Google.",
        print: "anuncios-3.webp",
        regiao: { x: 25.7, y: 50.5, l: 71, a: 12.5 },
        alt: "Campo de busca, filtros e botão Baixar para o gerenciador.",
      },
      {
        titulo: "Leia o limite de cada produto",
        texto: "Pode pagar por venda é o teto de anúncio para manter a margem. Empata em é o limite do prejuízo, e ROAS mínimo é o retorno que o anúncio precisa dar.",
        print: "anuncios-3.webp",
        regiao: { x: 24.5, y: 64.4, l: 73, a: 34 },
        alt: "Tabela de produtos com preço, limite por venda, ponto de empate e ROAS mínimo.",
      },
    ],
  },
};
