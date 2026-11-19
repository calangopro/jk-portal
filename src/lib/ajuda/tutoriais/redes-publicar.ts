import type { Tutorial } from "../tipos.ts";

export const redesPublicar: Tutorial = {
  href: "/admin/redes/publicar",
  resumo: "Monte um post uma vez, mande para várias redes agora ou numa hora marcada e acompanhe o que saiu.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que está na fila",
        texto: "As abas separam o que está na fila, os rascunhos, o que já saiu e o que deu erro. Cada post mostra quando sai e uma linha por rede com o estado dele ali.",
        print: "redes-publicar-1.webp",
        regiao: { x: 24.4, y: 29.3, l: 73.1, a: 50 },
        alt: "Abas de posts e os dois primeiros posts da fila, com o estado em cada rede.",
      },
      {
        titulo: "Tire da fila quando precisar",
        texto: "Toque em Tirar da fila e confirme. O post vai para Rascunhos e o que já saiu em alguma rede continua lá. Depois dá para editar e agendar de novo.",
        print: "redes-publicar-2.webp",
        regiao: { x: 26, y: 72.5, l: 33, a: 13 },
        alt: "Confirmação de tirar o post da fila, com os botões Sim, tirar da fila e Voltar.",
      },
      {
        titulo: "Toque em Novo post e escolha o que é",
        texto: "O botão Novo post fica no alto da tela. Escolha o que é: Post, Reels e Shorts, Story, Vídeo longo ou Só texto. Um post com duas fotos ou mais vira carrossel sozinho.",
        print: "redes-publicar-3.webp",
        regiao: { x: 24.4, y: 29.4, l: 47.7, a: 16.6 },
        alt: "Compositor de novo post com os botões de formato: Post, Reels e Shorts, Story, Vídeo longo e Só texto.",
      },
      {
        titulo: "Ponha a mídia e escreva a legenda",
        texto: "Toque em Escolher foto ou vídeo. Descreva a imagem em poucas palavras, para quem não enxerga. Logo abaixo vem a legenda, e o contador mostra o limite das redes escolhidas.",
        print: "redes-publicar-3.webp",
        regiao: { x: 24.4, y: 48.1, l: 47.7, a: 33.4 },
        alt: "Cartão Mídia com uma imagem enviada, a descrição dela e o botão Adicionar outra.",
      },
      {
        titulo: "Escolha as redes e quando sai",
        texto: "Marque as redes em Para onde vai: a tela avisa na hora o que não cabe em cada uma. Em Quando sai, escolha Agora ou Agendar e use uma sugestão pelo histórico, ou escolha o dia e a hora.",
        print: "redes-publicar-4.webp",
        regiao: { x: 24.4, y: 10.9, l: 47.7, a: 76 },
        alt: "Seleção de redes com o aviso Cabe nas regras da rede e os botões Agora e Agendar com horários sugeridos.",
      },
      {
        titulo: "Confirme antes de sair",
        texto: "Toque em Agendar ou em Publicar agora. Uma última tela repete onde e quando o post vai sair, em público e no nome da JK. Se não estiver pronto, toque em Salvar rascunho.",
        print: "redes-publicar-4.webp",
        regiao: { x: 24.4, y: 88.6, l: 47.7, a: 11 },
        alt: "Barra de baixo com os botões Agendar e Salvar rascunho.",
      },
    ],
  },
};
