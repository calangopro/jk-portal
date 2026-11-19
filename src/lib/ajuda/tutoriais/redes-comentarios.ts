import type { Tutorial } from "../tipos.ts";

export const redesComentarios: Tutorial = {
  href: "/admin/redes/comentarios",
  resumo: "Responda em nome da JK o que comentaram nas redes e tire da fila o que não precisa de resposta.",
  versoes: {
    todos: [
      {
        titulo: "Comece pelos sem resposta",
        texto: "A aba Sem resposta abre primeiro e mostra quantos comentários esperam. Respondidos e Fora da fila guardam o que já foi tratado.",
        print: "redes-comentarios-1.webp",
        regiao: { x: 24.4, y: 32.3, l: 73.1, a: 5.6 },
        alt: "Abas Sem resposta, Respondidos e Fora da fila, com 14 comentários esperando.",
      },
      {
        titulo: "Filtre por rede ou por post",
        texto: "Toque numa rede para ver só os comentários dela. Em Por post, os comentários ficam juntos, embaixo da publicação que os recebeu.",
        print: "redes-comentarios-1.webp",
        regiao: { x: 24.4, y: 38.8, l: 73.1, a: 5.6 },
        alt: "Filtros de rede e o seletor Um por um ou Por post.",
      },
      {
        titulo: "Leia o comentário e o post",
        texto: "Cada cartão mostra quem comentou, o texto e a publicação que recebeu. Toque em Ver o post para abrir os números dela.",
        print: "redes-comentarios-1.webp",
        regiao: { x: 24.4, y: 45.8, l: 36.1, a: 27.3 },
        alt: "Cartão de um comentário com o texto e a publicação a que ele pertence.",
      },
      {
        titulo: "Escreva a resposta",
        texto: "Toque em Responder e escreva no campo que se abre. A resposta sai em nome da JK, então escreva como a marca fala, sem travessão.",
        print: "redes-comentarios-2.webp",
        regiao: { x: 26, y: 66.5, l: 33, a: 19 },
        alt: "Campo Resposta, em nome da JK, com um texto de exemplo escrito.",
      },
      {
        titulo: "Confirme antes de publicar",
        texto: "A tela avisa onde a resposta vai sair e pede um segundo toque. Depois de publicada, só dá para apagar pela própria rede.",
        print: "redes-comentarios-2.webp",
        regiao: { x: 26, y: 83, l: 33, a: 11.5 },
        alt: "Aviso de que a resposta sai agora no Instagram, em público, e o botão Sim, publicar a resposta.",
      },
      {
        titulo: "Tire da fila o que não precisa de resposta",
        texto: "Não precisa de resposta só tira da fila e não manda nada à rede. Ocultar esconde o comentário do público na rede, e dá para mostrar de novo por lá.",
        print: "redes-comentarios-1.webp",
        regiao: { x: 35.7, y: 66, l: 23, a: 5.8 },
        alt: "Botões Não precisa de resposta e Ocultar embaixo de um comentário.",
      },
    ],
  },
};
