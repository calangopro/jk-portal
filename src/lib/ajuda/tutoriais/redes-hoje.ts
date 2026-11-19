import type { Tutorial } from "../tipos.ts";

export const redesHoje: Tutorial = {
  href: "/admin/redes",
  resumo: "Veja de manhã o que sai hoje, o que esperam de resposta e como estão os números de cada rede.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que sai nas próximas 48 horas",
        texto: "O primeiro cartão lista os posts marcados para os próximos dois dias, com a hora e as redes. Toque num deles para abrir e mudar, ou em Ver a fila para ver todos.",
        print: "redes-hoje-1.webp",
        regiao: { x: 24.4, y: 29.9, l: 23.6, a: 39.5 },
        alt: "Cartão Saindo nas próximas 48 horas com dois posts agendados.",
      },
      {
        titulo: "Responda quem comentou",
        texto: "O segundo cartão conta os comentários esperando resposta, separados por rede. Toque em Responder, post a post para ir direto à tela de comentários.",
        print: "redes-hoje-1.webp",
        regiao: { x: 49.1, y: 29.9, l: 23.6, a: 39.5 },
        alt: "Cartão de comentários esperando resposta, com o total e a contagem por rede.",
      },
      {
        titulo: "Repare no que está em alta",
        texto: "O terceiro cartão mostra os posts que renderam mais de duas vezes o normal da própria conta nos últimos 7 dias. É um bom lugar para achar o que vale repetir.",
        print: "redes-hoje-1.webp",
        regiao: { x: 73.8, y: 29.9, l: 24, a: 39.5 },
        alt: "Cartão Em alta nos últimos 7 dias com três posts e quantas vezes cada um passou do normal.",
      },
      {
        titulo: "Comece um post ou um story",
        texto: "Os botões Post e Story, no alto, abrem o compositor em branco. É por aqui que começa tudo o que vai sair nas redes.",
        print: "redes-hoje-1.webp",
        regiao: { x: 82.5, y: 21, l: 16.5, a: 6.5 },
        alt: "Botões Post e Story no canto direito do título da tela.",
      },
      {
        titulo: "Troque o período e leia os totais",
        texto: "Toque em 7, 28 ou 90 dias para mudar o período. Os quatro cartões somam todas as redes e comparam com o período anterior, quando ele foi lido por inteiro.",
        print: "redes-hoje-2.webp",
        regiao: { x: 24.4, y: 7.5, l: 73.1, a: 26 },
        alt: "Seletor de período e os cartões de seguidores, visualizações, interações e publicações.",
      },
      {
        titulo: "Confira rede por rede",
        texto: "Cada rede tem o próprio cartão, com seguidores, visualizações, alcance e interações. Quando uma rede não informa um número, a tela escreve isso em vez de mostrar zero.",
        print: "redes-hoje-2.webp",
        regiao: { x: 24.4, y: 45.5, l: 73.1, a: 37.5 },
        alt: "Cartões do Instagram e do Facebook com seguidores, gráfico e números do período.",
      },
    ],
  },
};
