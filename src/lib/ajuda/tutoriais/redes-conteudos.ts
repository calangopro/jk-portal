import type { Tutorial } from "../tipos.ts";

export const redesConteudos: Tutorial = {
  href: "/admin/redes/conteudos",
  resumo: "Descubra quais posts renderam mais que o normal da conta e aprenda com o que deu certo.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em 7, 28 ou 90 dias para mudar quais posts aparecem. O normal de cada conta é sempre calculado pelos últimos 90 dias, qualquer que seja o período escolhido.",
        print: "redes-conteudos-1.webp",
        regiao: { x: 79.9, y: 25, l: 17.6, a: 4.8 },
        alt: "Seletor de período com 7, 28 e 90 dias.",
      },
      {
        titulo: "Mude o que ordena a lista",
        texto: "Escolha entre mais vistos, mais interações, maior engajamento, mais comentados, mais compartilhados ou mais salvos. O número grande de cada cartão acompanha a ordem escolhida.",
        print: "redes-conteudos-1.webp",
        regiao: { x: 24.1, y: 32.3, l: 73.8, a: 4.3 },
        alt: "Fileira de botões de ordem, de Mais vistos até Mais salvos.",
      },
      {
        titulo: "Filtre por rede e por tipo",
        texto: "Na segunda fileira, escolha uma rede e um tipo: vídeos e Reels, fotos e carrosséis ou stories. Cada post só é comparado com posts do mesmo tipo da mesma conta.",
        print: "redes-conteudos-1.webp",
        regiao: { x: 24.1, y: 37.5, l: 73.8, a: 4.3 },
        alt: "Filtros de rede e de tipo de publicação.",
      },
      {
        titulo: "Procure o selo verde",
        texto: "O selo verde diz quantas vezes o post passou do normal da conta, como 3,4 vezes o normal. Ele só aparece em quem rendeu o dobro ou mais.",
        print: "redes-conteudos-1.webp",
        regiao: { x: 24.4, y: 44, l: 73.1, a: 12 },
        alt: "Resumo com três publicações acima do normal e os selos verdes nos três primeiros cartões.",
      },
      {
        titulo: "Abra o post para ver os detalhes",
        texto: "Toque num cartão para abrir a página do post, com os números dele e os comentários, que dá para responder ali mesmo.",
        print: "redes-conteudos-1.webp",
        regiao: { x: 24.4, y: 48.8, l: 17.6, a: 45.7 },
        alt: "Cartão de um post com o número de visualizações, o formato, a data e a legenda.",
      },
    ],
  },
};
