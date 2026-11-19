import type { Tutorial } from "../tipos.ts";

export const hoje: Tutorial = {
  href: "/admin/hoje",
  resumo: "A lista do que você precisa resolver agora, do mais urgente para o menos.",
  versoes: {
    todos: [
      {
        titulo: "Comece o dia por aqui",
        texto: "Hoje junta num lugar só o que está esperando por você: clientes, casos de suporte e mensagens. Você não precisa abrir oito telas para saber o que fazer.",
        print: "hoje-1.webp",
        regiao: { x: 30, y: 10, l: 47, a: 14 },
        alt: "Tela Hoje com o título dizendo quantas coisas esperam pela pessoa.",
      },
      {
        titulo: "O vermelho passou do prazo",
        texto: "A lista vai do mais urgente para o menos. Cartão vermelho já passou do prazo, amarelo pede atenção. Resolva de cima para baixo.",
        print: "hoje-1.webp",
        regiao: { x: 31, y: 26, l: 61, a: 34 },
        alt: "Primeiro cartão da lista, em vermelho, com dois clientes esperando na Kommo.",
      },
      {
        titulo: "Toque no botão do cartão",
        texto: "Cada cartão tem um botão que leva direto ao lugar de resolver. Toque nele e a tela certa abre.",
        print: "hoje-1.webp",
        regiao: { x: 32, y: 51.5, l: 15, a: 6.5 },
        alt: "Botão Abrir na Kommo no fim do primeiro cartão.",
      },
      {
        titulo: "Veja há quanto tempo espera",
        texto: "Ao lado do nome do cartão aparece o tempo de espera, como 3 h ou 1 dia. É esse tempo que decide a cor.",
        print: "hoje-1.webp",
        regiao: { x: 31, y: 61, l: 61, a: 26 },
        alt: "Segundo cartão, amarelo, com o tempo de espera de um dia no canto.",
      },
      {
        titulo: "Volte a esta tela quando quiser",
        texto: "A lista se refaz cada vez que você abre Hoje. O que você resolveu some sozinho, e quando não sobra nada a tela diz Tudo em dia.",
        print: "hoje-1.webp",
        regiao: { x: 4, y: 14, l: 18, a: 5 },
        alt: "Menu lateral com Hoje marcado, dentro do setor Início.",
      },
    ],
  },
};
