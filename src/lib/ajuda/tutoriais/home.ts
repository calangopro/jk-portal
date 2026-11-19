import type { Tutorial } from "../tipos.ts";

export const home: Tutorial = {
  href: "/admin/home",
  resumo: "Mude os textos da página inicial do site, reordene as faixas e esconda o que não quer mostrar.",
  versoes: {
    todos: [
      {
        titulo: "Veja as faixas da página inicial",
        texto: "Cada cartão da tela é uma faixa da home, na ordem em que ela aparece no site. A primeira é a abertura, com o título e o campo de busca.",
        print: "home-1.webp",
        regiao: { x: 24.4, y: 38.5, l: 73.1, a: 12 },
        alt: "Cartão Abertura com busca, a primeira faixa da home, marcado como essencial.",
      },
      {
        titulo: "Escreva o texto direto nos campos",
        texto: "Clique no campo, apague e digite o texto novo. O número embaixo mostra quantas letras já usou e quantas cabem. Travessão não passa.",
        print: "home-1.webp",
        regiao: { x: 61, y: 51, l: 35, a: 11.5 },
        alt: "Campo Título da abertura, com o contador de letras logo abaixo.",
      },
      {
        titulo: "Arraste pela alça para reordenar",
        texto: "Segure a alça de pontinhos à esquerda do nome da faixa e arraste para cima ou para baixo. Pelo teclado, ative a alça e use as setas.",
        print: "home-2.webp",
        regiao: { x: 25.5, y: 24, l: 3, a: 3.5 },
        alt: "Alça de pontinhos ao lado do nome da faixa Por onde começar.",
      },
      {
        titulo: "Toque no olho para ocultar sem apagar",
        texto: "O olho esconde a faixa do site e guarda tudo que você escreveu. Toque de novo para mostrar. A abertura é essencial e não pode ser ocultada.",
        print: "home-2.webp",
        regiao: { x: 93, y: 24, l: 3.5, a: 3.8 },
        alt: "Botão do olho no canto do cartão da faixa.",
      },
      {
        titulo: "Toque em Salvar a home",
        texto: "O botão só liga quando você muda alguma coisa. Ao salvar, a home vai ao ar na hora, sem precisar publicar de novo.",
        print: "home-1.webp",
        regiao: { x: 25.7, y: 29.3, l: 9.9, a: 4 },
        alt: "Botão Salvar a home na barra acima das faixas.",
      },
      {
        titulo: "Confira em Ver a home",
        texto: "Abra o site para ver como ficou. Se não gostou de tudo, Voltar ao padrão desfaz as mudanças e devolve os textos de fábrica.",
        print: "home-1.webp",
        regiao: { x: 36.6, y: 29, l: 18.4, a: 4.4 },
        alt: "Botões Ver a home e Voltar ao padrão.",
      },
    ],
  },
};
