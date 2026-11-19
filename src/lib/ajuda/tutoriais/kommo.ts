import type { Tutorial } from "../tipos.ts";

export const kommo: Tutorial = {
  href: "/admin/kommo",
  resumo: "Ligue cada usuário da Kommo a uma pessoa do painel ou a uma loja física, para dizer de quem é cada negócio.",
  versoes: {
    todos: [
      {
        titulo: "Veja quem ainda não foi ligado",
        texto: "A frase no alto diz quantos usuários ativos da Kommo ainda estão sem ligação. Quem já está certo aparece com o selo Ligado no canto do cartão.",
        print: "kommo-1.webp",
        regiao: { x: 24, y: 32, l: 74, a: 4.5 },
        alt: "Frase no alto da tela dizendo que dois usuários ativos ainda estão sem ligação.",
      },
      {
        titulo: "Diga o que o usuário é",
        texto: "No campo É, escolha Loja física, Vendedor, Diretoria ou Outro. Agência e usuário de teste entram em Outro.",
        print: "kommo-1.webp",
        regiao: { x: 25.5, y: 46.5, l: 23.5, a: 9 },
        alt: "Campo É de um usuário, com a lista de tipos.",
      },
      {
        titulo: "Ligue à pessoa ou à loja",
        texto: "Vendedor liga a uma Pessoa do painel. Loja física liga a uma Loja física. É esse laço que mostra de quem é o negócio e de qual loja veio a venda.",
        print: "kommo-1.webp",
        regiao: { x: 49, y: 46.5, l: 47.5, a: 9 },
        alt: "Campos Pessoa do painel e Loja física do mesmo usuário.",
      },
      {
        titulo: "Confira o palpite pelo nome",
        texto: "Quando o nome do usuário parece o de uma loja, a tela já deixa a loja escolhida. É só um palpite: nada vale até você tocar em Salvar.",
        print: "kommo-2.webp",
        regiao: { x: 24.4, y: 47, l: 74, a: 24.5 },
        alt: "Cartão de um usuário sem ligação, com a loja já sugerida pelo nome.",
      },
      {
        titulo: "Toque em Salvar",
        texto: "O Salvar vale para um usuário de cada vez. Depois de salvar, o selo do cartão passa para Ligado e o aviso do alto conta um a menos.",
        print: "kommo-2.webp",
        regiao: { x: 25.5, y: 64.5, l: 5.6, a: 5.5 },
        alt: "Botão Salvar no fim do cartão do usuário.",
      },
    ],
  },
};
