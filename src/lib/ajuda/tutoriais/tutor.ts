import type { Tutorial } from "../tipos.ts";

export const tutor: Tutorial = {
  href: "/admin/tutor",
  resumo: "Cole o print da conversa e o Tutor responde com o que a Biblioteca JK sabe, com a frase pronta para o cliente.",
  versoes: {
    todos: [
      {
        titulo: "Escreva a dúvida ou cole o print",
        texto: "No campo Qual é a dúvida, escreva do seu jeito o que o cliente perguntou. Se preferir, só cole o print da conversa e deixe o campo vazio. O print costuma bastar.",
        print: "tutor-1.webp",
        regiao: { x: 25, y: 33, l: 72, a: 16 },
        alt: "Campo Qual é a dúvida da tela Tutor.",
      },
      {
        titulo: "Mande o print da conversa",
        texto: "No computador, cole o print direto com Ctrl+V. No celular, toque em Escolher o print e escolha a imagem da galeria. O print não fica guardado: o Tutor só lê e responde.",
        print: "tutor-1.webp",
        regiao: { x: 25, y: 49.5, l: 52, a: 11 },
        alt: "Botões Perguntar e Escolher o print, com a dica de colar com Ctrl+V.",
      },
      {
        titulo: "Toque em Perguntar e espere uns segundos",
        texto: "Com print, a resposta pode levar até 20 segundos, porque o Tutor precisa ler a conversa. Não toque duas vezes. Quando terminar, a resposta aparece embaixo.",
        print: "tutor-2.webp",
        regiao: { x: 24.4, y: 49.5, l: 29, a: 7.5 },
        alt: "Botão Perguntar com o texto da dúvida já escrito.",
      },
      {
        titulo: "Leia a parte Para você primeiro",
        texto: "Ela explica o que vale e o que conferir antes de responder. É para você, não para o cliente. Se a casa ainda não confirmou a regra, aparece um aviso em amarelo.",
        print: "tutor-2.webp",
        regiao: { x: 25, y: 64.5, l: 72, a: 12 },
        alt: "Resposta do Tutor na parte Para você.",
      },
      {
        titulo: "Copie a mensagem e mande ao cliente",
        texto: "A parte Para mandar ao cliente é a frase pronta. Toque em Copiar a mensagem, cole na conversa e ajuste o que precisar. Leia antes de enviar.",
        print: "tutor-2.webp",
        regiao: { x: 25, y: 76, l: 72, a: 18 },
        alt: "Frase pronta para o cliente e o botão Copiar a mensagem.",
      },
      {
        titulo: "Saiba o que o Tutor não inventa",
        texto: "Ele só responde com o que está na Biblioteca JK e no catálogo. Preço, prazo e regra que a casa não escreveu ele não completa. Quando não sabe, leva a pergunta para o chat do time.",
        print: "tutor-1.webp",
        regiao: { x: 24.4, y: 63.5, l: 73, a: 9 },
        alt: "Texto explicando que o Tutor usa só a Biblioteca JK e o catálogo.",
      },
    ],
  },
};
