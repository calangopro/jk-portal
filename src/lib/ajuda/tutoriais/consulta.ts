import type { Tutorial } from "../tipos.ts";

export const consulta: Tutorial = {
  href: "/admin/consulta",
  resumo: "Responda o cliente na hora: o produto com o preço de hoje e o link, onde tem pronta entrega e quando a peça chega.",
  versoes: {
    todos: [
      {
        titulo: "Procure o produto",
        texto: "Digite o nome, o modelo ou o código do produto. A lista filtra a cada letra. Sem digitar nada, aparecem os mais vendidos primeiro.",
        print: "consulta-1.webp",
        regiao: { x: 24, y: 37.5, l: 73.5, a: 6.5 },
        alt: "Campo de busca de produto, abaixo das abas Produto, Prazo e Lojas.",
      },
      {
        titulo: "Leia o preço de hoje",
        texto: "O preço é o que a loja cobra hoje, e já considera a promoção. Quando há desconto, o preço antigo aparece riscado. Ao lado, os dias úteis de produção que a própria loja declara.",
        print: "consulta-1.webp",
        regiao: { x: 24, y: 47, l: 73.5, a: 48 },
        alt: "Lista de produtos com preço, selo de desconto e dias úteis.",
      },
      {
        titulo: "Copie o preço e o link",
        texto: "Toque no produto para abrir. Copiar preço e link coloca a frase pronta na sua área de transferência: é só colar na conversa com o cliente.",
        print: "consulta-2.webp",
        regiao: { x: 24, y: 44, l: 73.5, a: 30 },
        alt: "Produto aberto, com os botões Copiar preço e link, Copiar só o link e Abrir na loja.",
      },
      {
        titulo: "Veja quando a peça chega",
        texto: "Se fechar hoje, o painel mostra a data para retirar em loja, enviar pelos Correios ou mandar de moto. Ver a conta explica o cálculo, e Copiar a frase leva o texto pronto.",
        print: "consulta-2.webp",
        regiao: { x: 24.4, y: 73, l: 73.5, a: 27 },
        alt: "Quadro Se fechar hoje, quando chega, com três formas de entrega.",
      },
      {
        titulo: "Simule outro prazo na aba Prazo",
        texto: "Para uma peça fora do catálogo, ou para testar outro prazo, abra Prazo, digite os dias úteis de produção e o dia do fechamento. As datas se refazem na hora.",
        print: "consulta-3.webp",
        regiao: { x: 24, y: 38, l: 73.5, a: 47 },
        alt: "Aba Prazo com os dias úteis de produção, o dia do fechamento e as três datas.",
      },
      {
        titulo: "Veja a pronta entrega nas lojas",
        texto: "A aba Lojas mostra onde cada peça está à mão, com quem avisou e há quantos dias. Ao abrir um produto, marque que a loja tem ou que acabou, para o time inteiro saber.",
        print: "consulta-4.webp",
        regiao: { x: 24.4, y: 38, l: 73, a: 18 },
        alt: "Aba Lojas com os cartões das lojas e a pronta entrega informada.",
      },
    ],
  },
};
