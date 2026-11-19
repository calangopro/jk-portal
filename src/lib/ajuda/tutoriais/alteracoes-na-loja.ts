import type { Tutorial } from "../tipos.ts";

export const alteracoesNaLoja: Tutorial = {
  href: "/admin/alteracoes-na-loja",
  resumo: "Veja tudo o que o painel mandou para a Tray: quem mudou, o que era, o que ficou e o que a loja recusou.",
  versoes: {
    todos: [
      {
        titulo: "Leia a lista do mais novo para o mais antigo",
        texto: "Cada cartão é uma mudança que saiu do painel para a loja. No alto aparece o tipo, o código e o nome da peça. Aparecem as 150 mais recentes.",
        print: "alteracoes-na-loja-1.webp",
        regiao: { x: 24.4, y: 34.4, l: 73.1, a: 19.4 },
        alt: "Cartão de uma alteração de estoque, com a peça, o selo Gravado e conferido e a data.",
      },
      {
        titulo: "Compare o antes e o depois",
        texto: "O valor de antes aparece riscado e o novo vem em negrito. Preço, promoção, estoque e fotos aparecem do mesmo jeito. Embaixo fica quem fez e a hora.",
        print: "alteracoes-na-loja-1.webp",
        regiao: { x: 24.4, y: 64.5, l: 73.1, a: 11 },
        alt: "Cartão de uma alteração de preço promocional, de sem promoção para R$ 2.700,00.",
      },
      {
        titulo: "Procure o selo vermelho ou amarelo",
        texto: "Gravado e conferido quer dizer que a Tray aceitou e o painel leu de volta. A Tray recusou traz o motivo escrito. Precisa conferir quer dizer que a Tray disse que gravou, mas a mudança não apareceu.",
        print: "alteracoes-na-loja-1.webp",
        regiao: { x: 24.4, y: 76.6, l: 73.1, a: 23.4 },
        alt: "Cartão com o selo A Tray recusou e a explicação do motivo.",
      },
      {
        titulo: "Para desfazer, edite o produto de novo",
        texto: "Esta tela só mostra o histórico, nada se desfaz aqui. Para voltar atrás, abra a peça em Produtos e grave o valor antigo. Isso vira uma linha nova nesta lista.",
        print: "alteracoes-na-loja-1.webp",
        regiao: { x: 24.4, y: 11.5, l: 55, a: 18 },
        alt: "Título da tela e a frase que explica que ela mostra tudo o que o painel mandou para a loja.",
      },
    ],
  },
};
