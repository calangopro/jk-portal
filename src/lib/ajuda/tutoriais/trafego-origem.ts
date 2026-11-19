import type { Tutorial } from "../tipos.ts";

export const trafegoOrigem: Tutorial = {
  href: "/admin/trafego/origem",
  resumo: "De qual campanha, conjunto e anúncio veio cada pedido da loja.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em Este mês, 7 dias, 30 dias ou Mês passado. Trinta dias é o melhor, porque em sete há pouco pedido para ler.",
        print: "trafego-origem-1.webp",
        regiao: { x: 70.2, y: 32.3, l: 27.3, a: 4.8 },
        alt: "Seletor de período no alto da tela.",
      },
      {
        titulo: "Veja quantos pedidos viram anúncio",
        texto: "Os cartões contam os pedidos pagos, quantos têm a chegada anotada, quantos vieram de anúncio e quantos o painel liga ao anúncio exato.",
        print: "trafego-origem-1.webp",
        regiao: { x: 24.4, y: 39.5, l: 73.1, a: 17.5 },
        alt: "Quatro cartões com pedidos pagos e de onde eles vieram.",
      },
      {
        titulo: "Confira o link da bio",
        texto: "Este quadro separa quem entrou pelo link da bio depois de clicar num anúncio de quem entrou sem anúncio antes. Assim a bio não engana a conta.",
        print: "trafego-origem-1.webp",
        regiao: { x: 24.4, y: 64.9, l: 73.1, a: 35 },
        alt: "Quadro Link da bio com chegadas, chegadas de anúncio e chegadas sem anúncio.",
      },
      {
        titulo: "Mude como a lista se organiza",
        texto: "Toque em Por anúncio, Por conjunto, Por campanha, Pela UTM ou Pedido a pedido. A lista muda na hora, sem recarregar a página.",
        print: "trafego-origem-2.webp",
        regiao: { x: 25.7, y: 10.5, l: 70.5, a: 4.5 },
        alt: "Abas da lista de origem dos pedidos.",
      },
      {
        titulo: "Busque e filtre os pedidos",
        texto: "Digite o número do pedido, a UTM, a campanha ou o anúncio. Só pagos, Só de anúncio e Pelo link da bio estreitam a lista.",
        print: "trafego-origem-2.webp",
        regiao: { x: 25.7, y: 16.5, l: 71, a: 5.5 },
        alt: "Campo de busca e filtros da lista.",
      },
      {
        titulo: "Abra um pedido",
        texto: "Em Pedido a pedido, cada linha mostra as UTMs como chegaram e a que anúncio foram ligadas. Toque no número do pedido para ver o histórico completo.",
        print: "trafego-origem-3.webp",
        regiao: { x: 24.4, y: 26.5, l: 73.1, a: 22 },
        alt: "Primeiro pedido da lista com as UTMs e o selo Anúncio exato.",
      },
    ],
  },
};
