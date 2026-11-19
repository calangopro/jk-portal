import type { Tutorial } from "../tipos.ts";

export const redesCalendario: Tutorial = {
  href: "/admin/redes/calendario",
  resumo: "Veja o que saiu e o que vai sair em cada dia do mês e crie um post já na data escolhida.",
  versoes: {
    todos: [
      {
        titulo: "Olhe o mês inteiro",
        texto: "Cada dia mostra um quadradinho por post. O que está com contorno ainda vai sair, o vermelho deu erro e o cinza é ideia com data marcada. Use as setas de cima para trocar de mês.",
        print: "redes-calendario-1.webp",
        regiao: { x: 24.4, y: 29.3, l: 45.3, a: 62 },
        alt: "Calendário de novembro com miniaturas dos posts em cada dia.",
      },
      {
        titulo: "Toque num dia para ver o que tem nele",
        texto: "O dia escolhido abre ao lado, com a hora, as redes e a legenda de cada post. Toque num item para abrir o post, ou a publicação que já saiu.",
        print: "redes-calendario-1.webp",
        regiao: { x: 71.3, y: 29.3, l: 26.3, a: 30 },
        alt: "Lista do dia 19 de novembro com um post e um story agendados.",
      },
      {
        titulo: "Crie para aquele dia",
        texto: "Em dia que ainda não passou aparecem botões de Post e Story em horários sugeridos. Toque num deles e o compositor abre já com o dia e a hora marcados.",
        print: "redes-calendario-2.webp",
        regiao: { x: 71.3, y: 33, l: 26.3, a: 23.5 },
        alt: "Caixa Criar para este dia com os botões de post e story em horários sugeridos.",
      },
      {
        titulo: "Entenda de onde vem o horário",
        texto: "A frase embaixo dos botões diz qual faixa de horas rendeu mais no histórico de cada rede. É só uma sugestão: dá para trocar a hora no próprio post.",
        print: "redes-calendario-2.webp",
        regiao: { x: 72.4, y: 47.2, l: 23.9, a: 7.5 },
        alt: "Texto com a melhor faixa de horário de cada rede pelo histórico.",
      },
      {
        titulo: "Ou comece pelo Novo post",
        texto: "Se ainda não sabe o dia, toque em Novo post, no alto da tela. O compositor abre em branco e a data se escolhe lá.",
        print: "redes-calendario-1.webp",
        regiao: { x: 88.2, y: 21.4, l: 9.6, a: 5.5 },
        alt: "Botão Novo post no canto direito do título.",
      },
    ],
  },
};
