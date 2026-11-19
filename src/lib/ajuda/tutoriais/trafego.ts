import type { Tutorial } from "../tipos.ts";

export const trafego: Tutorial = {
  href: "/admin/trafego",
  resumo: "Quanto foi gasto em anúncio e quanto de venda paga voltou.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em Este mês, 7 dias, 30 dias ou Mês passado. Tudo na tela, dos cartões ao gráfico, passa a falar desse período.",
        print: "trafego-1.webp",
        regiao: { x: 70.2, y: 35.2, l: 27.3, a: 4.8 },
        alt: "Seletor de período ao lado das datas.",
      },
      {
        titulo: "Compare o gasto com a venda",
        texto: "Os cartões mostram quanto saiu em anúncio, quanto veio de venda de anúncio e quanto voltou para cada R$ 1. O mínimo conta só a venda com etiqueta, e o máximo conta tudo.",
        print: "trafego-1.webp",
        regiao: { x: 24.4, y: 53.7, l: 73.1, a: 28.8 },
        alt: "Quatro cartões: gasto em anúncio, venda de anúncio e as duas voltas por R$ 1.",
      },
      {
        titulo: "Leia cada plataforma",
        texto: "A tabela mostra gasto, venda paga com etiqueta, pedidos e volta de cada plataforma. Verde quer dizer que vendeu mais do que gastou.",
        print: "trafego-2.webp",
        regiao: { x: 24.4, y: 11.2, l: 73.1, a: 54.7 },
        alt: "Tabela Por plataforma com Meta e Google Ads.",
      },
      {
        titulo: "Confira se a leitura está ligada",
        texto: "Meta e Google Ads leem o gasto sozinhos, de hora em hora. Se um deles parar, esta caixa avisa. O botão Ler agora puxa os números na hora.",
        print: "trafego-3.webp",
        regiao: { x: 24.4, y: 11.3, l: 73.1, a: 37.5 },
        alt: "Caixa Leitura automática com as duas plataformas ligadas e o botão Ler agora.",
      },
      {
        titulo: "Lance um gasto à mão",
        texto: "Para plataforma sem leitura automática, escolha a plataforma, o valor e o dia. Para a fatura do mês, preencha também o último dia. Lançar de novo o mesmo dia troca o valor.",
        print: "trafego-3.webp",
        regiao: { x: 24.4, y: 51.9, l: 73.1, a: 24.4 },
        alt: "Formulário Lançar gasto à mão com plataforma, valor e datas.",
      },
      {
        titulo: "Desça para as campanhas",
        texto: "O cartão no alto leva às campanhas, aos conjuntos e aos anúncios, com o que está bom e o que está ruim em cada um.",
        print: "trafego-1.webp",
        regiao: { x: 24.4, y: 42.4, l: 73.1, a: 8.8 },
        alt: "Cartão Ver campanhas, conjuntos e anúncios.",
      },
    ],
  },
};
