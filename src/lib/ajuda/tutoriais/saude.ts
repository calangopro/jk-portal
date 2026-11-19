import type { Tutorial } from "../tipos.ts";

export const saude: Tutorial = {
  href: "/admin/saude",
  resumo: "Veja o que roda sozinho e para onde vão os contatos captados, e descubra na hora o que parou.",
  versoes: {
    todos: [
      {
        titulo: "Comece pelo resumo do alto",
        texto: "A etiqueta no alto diz Tudo funcionando ou quantas ligações pedem ação. Se estiver vermelha, desça e ache quais são.",
        print: "saude-1.webp",
        regiao: { x: 24.4, y: 29.5, l: 17, a: 5 },
        alt: "Etiqueta vermelha dizendo que três ligações pedem ação.",
      },
      {
        titulo: "Olhe para onde vai o contato",
        texto: "O primeiro quadro lista os destinos dos contatos captados nos formulários. Cada linha tem o estado com ícone e palavra, e o número que sustenta o estado.",
        print: "saude-1.webp",
        regiao: { x: 24.4, y: 36, l: 74, a: 50 },
        alt: "Quadro Para onde vai o contato captado, com três destinos e o estado de cada um.",
      },
      {
        titulo: "Leia o que fazer",
        texto: "Quando uma linha não está boa, ela diz o que fazer logo abaixo. Destino sem chave não é erro: é uma ligação que ainda não foi feita, e os contatos ficam guardados.",
        print: "saude-1.webp",
        regiao: { x: 26, y: 41.5, l: 71, a: 15 },
        alt: "Linha de um destino recusando, com a frase O que fazer.",
      },
      {
        titulo: "Vá a Integrações para consertar",
        texto: "Toque em Abrir Integrações. É lá que se cola uma chave nova ou se liga o destino que ficou de fora.",
        print: "saude-1.webp",
        regiao: { x: 86.5, y: 38, l: 11.5, a: 3.5 },
        alt: "Link Abrir Integrações no canto do quadro de destinos.",
      },
      {
        titulo: "Confira o que roda sozinho",
        texto: "O segundo quadro lista as rotinas agendadas: ler pedidos, gasto de anúncio, redes. O que está Parado ou em Atenção vem com a frase do que fazer.",
        print: "saude-2.webp",
        regiao: { x: 24.4, y: 26, l: 74, a: 62 },
        alt: "Quadro O que roda sozinho, com rotinas funcionando, em atenção e parada.",
      },
      {
        titulo: "Entenda quando vira parada",
        texto: "A nota no pé da tela explica a regra: uma rotina é dada como parada quando passa perto de três vezes o intervalo dela sem uma rodada boa.",
        print: "saude-2.webp",
        regiao: { x: 24, y: 89.5, l: 56, a: 6 },
        alt: "Nota no pé da tela explicando quando uma rotina é dada como parada.",
      },
    ],
  },
};
