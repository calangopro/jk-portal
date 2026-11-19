import type { Tutorial } from "../tipos.ts";

export const fatos: Tutorial = {
  href: "/admin/fatos",
  resumo: "A lista de tudo o que o site pode afirmar sobre a JK, escrito uma vez e com a fonte registrada.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que já pode ser citado",
        texto: "Os três cartões mostram quantos fatos estão prontos para citar, quantos esperam validação e o total da base. Só fato aprovado aparece para quem escreve no editor.",
        print: "fatos-1.webp",
        regiao: { x: 24.4, y: 38.5, l: 73.1, a: 10.9 },
        alt: "Cartões com fatos prontos para citar, esperando validação e total na base.",
      },
      {
        titulo: "Cuide do fato desatualizado",
        texto: "Quando um fato desatualizado ainda é citado por um post publicado, aparece um aviso em vermelho. Abra o fato e revise os posts que dependem dele.",
        print: "fatos-1.webp",
        regiao: { x: 24.4, y: 52.4, l: 73.1, a: 6.8 },
        alt: "Aviso de fato desatualizado que ainda é citado por conteúdo publicado.",
      },
      {
        titulo: "Registre um fato novo",
        texto: "Escreva a afirmação como se fosse lida sozinha, com dado concreto. Informe o endereço da fonte e a data em que você conferiu. Um fato por afirmação.",
        print: "fatos-1.webp",
        regiao: { x: 24.4, y: 63.2, l: 73.1, a: 36.8 },
        alt: "Formulário Registrar fato, com a afirmação e os dados da fonte.",
      },
      {
        titulo: "Abra um fato para revisar",
        texto: "Cada fato mostra a frase, o status e quantos posts citam. Toque na linha para abrir a fonte, a data de conferência e o formulário de edição.",
        print: "fatos-2.webp",
        regiao: { x: 24.4, y: 17, l: 73.1, a: 8 },
        alt: "Linha de um fato aprovado, com o status e a quantidade de conteúdos que citam.",
      },
      {
        titulo: "Mude o status, não apague",
        texto: "Fato não se apaga. Se a informação mudou, troque o status para Desatualizado. Assim os posts que citaram aquilo continuam fáceis de achar e de corrigir.",
        print: "fatos-2.webp",
        regiao: { x: 24.4, y: 27, l: 73.1, a: 6 },
        alt: "Seletor de status ao lado da fonte e da data de conferência do fato.",
      },
    ],
  },
};
