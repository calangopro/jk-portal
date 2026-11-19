import type { Tutorial } from "../tipos.ts";

export const pautas: Tutorial = {
  href: "/admin/pautas",
  resumo: "A fila do que escrever a seguir, decidida pelo que a busca do Google já mostra.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que a busca pede",
        texto: "Em Oportunidades no Search Console ficam as consultas em que a JK aparece e quase ninguém clica. O número ao lado do nome diz quanto vale atacar: quanto maior, melhor.",
        print: "pautas-1.webp",
        regiao: { x: 24.4, y: 66, l: 73.1, a: 18 },
        alt: "Primeira oportunidade da lista, com impressões, cliques, CTR e posição.",
      },
      {
        titulo: "Toque em Virar pauta",
        texto: "Quando a consulta valer o texto, toque em Virar pauta. Ela entra na fila com o número do dia guardado, para você comparar depois se a página melhorou.",
        print: "pautas-1.webp",
        regiao: { x: 85.9, y: 68.9, l: 9.9, a: 4.5 },
        alt: "Botão Virar pauta ao lado de uma oportunidade.",
      },
      {
        titulo: "Escreva uma pauta à mão",
        texto: "Para o assunto que não vem da busca, como uma dúvida que o atendimento ouve toda semana, preencha o formulário. Informe a consulta alvo e, se quiser, o assunto e o modelo.",
        print: "pautas-2.webp",
        regiao: { x: 24.4, y: 7.6, l: 73.1, a: 70.5 },
        alt: "Formulário Pauta escrita à mão.",
      },
      {
        titulo: "Acompanhe a fila",
        texto: "A Fila separa as pautas por situação: ideia, pronta para escrever, escrevendo e publicada. Mude a situação no seletor de cada pauta conforme o trabalho anda.",
        print: "pautas-3.webp",
        regiao: { x: 24.4, y: 54.8, l: 73.1, a: 16.8 },
        alt: "Pauta pronta para escrever, com o seletor de situação à direita.",
      },
      {
        titulo: "Vire a pauta em rascunho",
        texto: "Toque em Virar rascunho e o editor abre já preenchido com a consulta alvo e o modelo. Depois que o rascunho existe, o botão vira Abrir o rascunho.",
        print: "pautas-3.webp",
        regiao: { x: 85.7, y: 61, l: 10.2, a: 5.5 },
        alt: "Botão Virar rascunho no cartão de uma pauta.",
      },
    ],
  },
};
