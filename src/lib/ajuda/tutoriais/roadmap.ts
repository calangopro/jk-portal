import type { Tutorial } from "../tipos.ts";

export const roadmap: Tutorial = {
  href: "/admin/roadmap",
  resumo: "O quadro de quem mexe no código do painel: o que está para fazer, quem pegou e onde, com aviso de cruzamento.",
  versoes: {
    todos: [
      {
        titulo: "Veja quem está mexendo",
        texto: "O quadro Em trabalho agora mostra cada pessoa com cartão em Fazendo ou Em revisão, e quantos desses são feitos pelo Claude dela.",
        print: "roadmap-1.webp",
        regiao: { x: 24.4, y: 42.5, l: 73.5, a: 10.5 },
        alt: "Quadro Em trabalho agora com duas pessoas e os cartões de cada uma.",
      },
      {
        titulo: "Preste atenção ao aviso amarelo",
        texto: "Quando dois cartões em trabalho mexem no mesmo lugar, o quadro avisa e diz qual caminho cruza. Combinem quem junta primeiro e traga o main antes de juntar.",
        print: "roadmap-1.webp",
        regiao: { x: 24.4, y: 54, l: 73.5, a: 17 },
        alt: "Aviso amarelo dizendo que dois cartões mexem no mesmo lugar.",
      },
      {
        titulo: "Filtre por pessoa e por tipo",
        texto: "Toque em Meus para ver só os seus cartões, ou escolha uma pessoa ou um tipo. Os botões escuros são os que estão valendo.",
        print: "roadmap-1.webp",
        regiao: { x: 24.4, y: 73, l: 73.5, a: 9.5 },
        alt: "Botões de filtro por pessoa e por tipo.",
      },
      {
        titulo: "Percorra as colunas",
        texto: "Cada coluna é uma etapa, de Ideias até No ar. O cartão anda sozinho quando o GitHub avisa que o pedido abriu ou foi juntado. Cartão com aviso mostra Cruza com e o número.",
        print: "roadmap-2.webp",
        regiao: { x: 24.4, y: 25.5, l: 74, a: 62 },
        alt: "Cinco colunas do quadro com cartões de exemplo.",
      },
      {
        titulo: "Abra um cartão",
        texto: "Toque no cartão para abrir a gaveta. Ela mostra quem pegou, o ramo, os caminhos que o trabalho mexe e o aviso de cruzamento, e é dali que se pega ou se move o cartão.",
        print: "roadmap-3.webp",
        regiao: { x: 55, y: 0, l: 45, a: 45 },
        alt: "Gaveta aberta de um cartão com o responsável, o aviso de cruzamento e o ramo.",
      },
      {
        titulo: "Crie o cartão antes de mexer",
        texto: "Trabalho sem cartão não começa. Toque em Novo cartão, escreva o que vai fazer, e depois pegue o cartão dizendo o ramo e os caminhos que vai mexer.",
        print: "roadmap-1.webp",
        regiao: { x: 24.4, y: 35, l: 14, a: 5.5 },
        alt: "Botão Novo cartão no alto da tela.",
      },
    ],
  },
};
