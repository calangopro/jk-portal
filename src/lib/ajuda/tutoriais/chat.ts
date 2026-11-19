import type { Tutorial } from "../tipos.ts";

export const chat: Tutorial = {
  href: "/admin/chat",
  resumo: "A conversa do time, ao vivo, em salas por setor, com pedido de resposta que ninguém esquece.",
  versoes: {
    todos: [
      {
        titulo: "Escolha a sala",
        texto: "A sala Geral é para avisos de todo mundo. Cada setor tem a sua. Todo o time lê e escreve em todas, então não conte nada que não possa ser lido por todos.",
        print: "chat-1.webp",
        regiao: { x: 24, y: 11.5, l: 19.5, a: 40 },
        alt: "Lista de salas do chat: Geral, Vendas, Fábrica, Loja, Tráfego e Diretoria.",
      },
      {
        titulo: "Veja quem está online",
        texto: "Embaixo das salas aparece quem está com o painel aberto agora. Online quer dizer que a pessoa está olhando. Fora quer dizer que o painel dela está fechado.",
        print: "chat-1.webp",
        regiao: { x: 24, y: 52, l: 19.5, a: 26 },
        alt: "Quadro Online agora com as pessoas do time.",
      },
      {
        titulo: "Atenda os pedidos de resposta",
        texto: "Quando alguém pede resposta, a faixa amarela mostra há quanto tempo está esperando. Toque em Responder para falar, ou em Resolvido quando já foi atendido.",
        print: "chat-1.webp",
        regiao: { x: 44.6, y: 18, l: 52.5, a: 17 },
        alt: "Faixa de pedido esperando resposta na sala, com os botões Responder e Resolvido.",
      },
      {
        titulo: "Escreva e envie",
        texto: "Digite a mensagem e aperte Enter. Para pular linha, Shift e Enter. Precisa de resposta? Toque em Pedir resposta antes de enviar, e a mensagem entra na faixa de pedidos.",
        print: "chat-1.webp",
        regiao: { x: 44.6, y: 85, l: 52.5, a: 9 },
        alt: "Campo de mensagem com o botão Pedir resposta e o botão de enviar.",
      },
      {
        titulo: "Marque pessoas, setores e pedidos",
        texto: "Digite @ para marcar uma pessoa ou um setor, e a lista aparece. Quem é marcado recebe aviso em qualquer sala. Também dá para citar um pedido da loja digitando /pedido e o número.",
        print: "chat-2.webp",
        regiao: { x: 45.5, y: 76, l: 50.5, a: 17 },
        alt: "Lista de sugestões que abre ao digitar arroba no campo de mensagem.",
      },
      {
        titulo: "No celular, as salas ficam no topo",
        texto: "No celular as salas viram botões que rolam de lado, em cima da conversa. A mensagem aparece grande e o campo de escrever fica embaixo. Funciona igual ao computador.",
        print: "chat-3.webp",
        regiao: { x: 3, y: 14.5, l: 94, a: 30 },
        celular: true,
        alt: "Chat no celular, com as salas em botões no topo e a conversa embaixo.",
      },
    ],
  },
};
