import type { Passo, Tutorial } from "../tipos.ts";

const abas: Passo = {
  titulo: "Comece pela aba Aguardando",
  texto: "Nenhum comentário aparece no site antes de passar por aqui. A aba Aguardando mostra a fila, com o número entre parênteses. Publicados, Spam e Recusados guardam o resto.",
  print: "comentarios-1.webp",
  regiao: { x: 24.4, y: 31.4, l: 73.1, a: 4.3 },
  alt: "Abas Aguardando, Publicados, Spam, Recusados e Todos.",
};

const moderar: Passo = {
  titulo: "Decida cada comentário",
  texto: "Toque em Publicar para o comentário ir ao ar, Recusar para tirar da fila ou Spam para propaganda. Publicado pode voltar para a fila em Tirar do ar.",
  print: "comentarios-1.webp",
  regiao: { x: 24.4, y: 52.4, l: 26, a: 4 },
  alt: "Botões Publicar, Recusar e Spam embaixo de um comentário.",
};

export const comentarios: Tutorial = {
  href: "/admin/comentarios",
  resumo: "A fila de moderação dos comentários dos posts. Nada vai ao ar sem passar por aqui.",
  versoes: {
    todos: [
      abas,
      {
        titulo: "Leia o comentário e o post",
        texto: "Cada cartão mostra quem escreveu, quando e em qual post. Toque no nome do post para ver a página no site. Dúvida de cliente é boa ideia de pauta.",
        print: "comentarios-1.webp",
        regiao: { x: 24.4, y: 38.8, l: 73.1, a: 19.8 },
        alt: "Cartão de um comentário com autor, data, post e texto.",
      },
      moderar,
      {
        titulo: "Aprove vários de uma vez",
        texto: "Quando há mais de um comentário na fila, o botão Aprovar os pendentes publica todos de uma vez. Use só depois de ler a fila inteira.",
        print: "comentarios-1.webp",
        regiao: { x: 82.8, y: 23.1, l: 14.7, a: 4.8 },
        alt: "Botão Aprovar os pendentes no topo da tela.",
      },
    ],
    diretoria: [
      { ...abas, print: "comentarios-2.webp" },
      {
        titulo: "Toque em Responder",
        texto: "A diretoria responde pela loja. A resposta sai embaixo do comentário, assinada como JK Alianças. Escreva como quem atende no balcão e não prometa o que a loja não cumpre.",
        print: "comentarios-2.webp",
        regiao: { x: 24.4, y: 38.8, l: 73.1, a: 36 },
        alt: "Cartão de comentário com a caixa de resposta da loja aberta.",
      },
      {
        titulo: "Publique a resposta",
        texto: "Toque em Publicar resposta. Se o comentário ainda estava na fila, ele vai ao ar junto, para a resposta não ficar solta. Errou? Apague a resposta no próprio cartão.",
        print: "comentarios-2.webp",
        regiao: { x: 26, y: 69, l: 30, a: 6 },
        alt: "Botões Publicar resposta e Cancelar.",
      },
      {
        titulo: "Decida cada comentário",
        texto: "Toque em Publicar para ir ao ar, Recusar para tirar da fila ou Spam para propaganda. Comentário em Spam pode ser apagado de vez, só pela diretoria.",
        print: "comentarios-2.webp",
        regiao: { x: 26, y: 76.5, l: 27, a: 5 },
        alt: "Botões Publicar, Recusar e Spam embaixo do cartão.",
      },
    ],
  },
};
