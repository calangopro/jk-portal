import type { Tutorial } from "../tipos.ts";

export const kommoFases: Tutorial = {
  href: "/admin/kommo/fases",
  resumo: "Ligue cada etapa dos funis da Kommo a uma fase padrão, para o painel somar loja com loja.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que é cada fase",
        texto: "Toque em O que é cada fase. A lista explica as oito fases padrão, de Entrada até Pós-venda. Use como régua para decidir onde cada etapa se encaixa.",
        print: "kommo-fases-2.webp",
        regiao: { x: 25, y: 36, l: 72, a: 34 },
        alt: "Quadro aberto com o nome e a explicação de cada fase.",
      },
      {
        titulo: "Veja o que falta conferir",
        texto: "A frase acima da lista conta quantas etapas têm fase só por palpite e quantas estão sem fase. O palpite vem do nome da etapa e ainda não foi conferido por ninguém.",
        print: "kommo-fases-1.webp",
        regiao: { x: 24, y: 45.5, l: 32, a: 5 },
        alt: "Frase com a contagem de etapas por palpite e etapas sem fase.",
      },
      {
        titulo: "Escolha a fase da etapa",
        texto: "No campo à direita da etapa, escolha a fase. Grava na hora, sem botão. A etapa passa a aparecer como Conferida, com o nome de quem escolheu.",
        print: "kommo-fases-1.webp",
        regiao: { x: 25.5, y: 80.5, l: 72, a: 9 },
        alt: "Etapa sem fase, com o campo de escolha da fase à direita.",
      },
      {
        titulo: "Confirme os palpites certos",
        texto: "Se os palpites pelo nome estiverem certos, toque em Confirmar todos os palpites e eles viram Conferida de uma vez. Corrija só os que estiverem errados.",
        print: "kommo-fases-1.webp",
        regiao: { x: 50.5, y: 45.5, l: 16.5, a: 5.5 },
        alt: "Botão Confirmar todos os palpites ao lado da contagem.",
      },
      {
        titulo: "Mexa sem medo",
        texto: "Mudar a fase aqui não muda nada na Kommo. Só muda como o painel soma as lojas no Funil da Kommo.",
        print: "kommo-fases-1.webp",
        regiao: { x: 24, y: 20, l: 55, a: 11 },
        alt: "Texto de abertura da tela dizendo que mudar aqui não mexe na Kommo.",
      },
    ],
  },
};
