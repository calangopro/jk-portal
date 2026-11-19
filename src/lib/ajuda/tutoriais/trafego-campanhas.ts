import type { Tutorial } from "../tipos.ts";

export const trafegoCampanhas: Tutorial = {
  href: "/admin/trafego/campanhas",
  resumo: "O que cada campanha, conjunto e anúncio gastou e trouxe, com o veredito de cada um.",
  versoes: {
    todos: [
      {
        titulo: "Escolha a plataforma",
        texto: "Toque em Meta ou em Google Ads. Ao lado, escolha o período. Trinta dias é o melhor, porque anúncio pequeno não junta dado em menos tempo.",
        print: "trafego-campanhas-1.webp",
        regiao: { x: 24.4, y: 29.3, l: 14, a: 4.8 },
        alt: "Botões Meta e Google Ads acima dos números.",
      },
      {
        titulo: "Leia os cinco números do topo",
        texto: "Gasto, venda pelo canal inteiro, volta pelo canal, venda que a plataforma diz e custo por compra. A cor da volta diz se paga a conta.",
        print: "trafego-campanhas-1.webp",
        regiao: { x: 24.4, y: 39.5, l: 73.1, a: 25.5 },
        alt: "Cinco cartões de resumo do período.",
      },
      {
        titulo: "Veja os vencedores e o que rever",
        texto: "O verde mostra o que tem espaço para crescer. O vermelho mostra o que queima verba e pede que você reveja ou pause.",
        print: "trafego-campanhas-2.webp",
        regiao: { x: 24.4, y: 11.3, l: 73.1, a: 38 },
        alt: "Dois quadros lado a lado: vencedores em verde e para rever ou pausar em vermelho.",
      },
      {
        titulo: "Busque e filtre a tabela",
        texto: "Troque entre Campanhas, Conjuntos e Anúncios, busque pelo nome e filtre por veredito. Marque Só ligados para ver só o que está no ar.",
        print: "trafego-campanhas-2.webp",
        regiao: { x: 25.7, y: 59.5, l: 70.5, a: 12 },
        alt: "Abas da tabela, campo de busca e filtros de veredito.",
      },
      {
        titulo: "Compare o Meta com a UTM",
        texto: "O resultado do Meta é o que a plataforma diz. O da UTM é pedido pago da loja de quem clicou no anúncio. O da UTM fica abaixo, e é o que a loja confirma.",
        print: "trafego-campanhas-2.webp",
        regiao: { x: 24.4, y: 75.5, l: 73.1, a: 22 },
        alt: "Colunas de veredito, gasto, resultado do Meta, resultado da UTM e custo por resultado.",
      },
      {
        titulo: "Toque no nome para descer",
        texto: "Toque no nome da campanha para abrir os conjuntos dela, e no conjunto para ver os anúncios. A linha aberta explica o número em palavras.",
        print: "trafego-campanhas-3.webp",
        regiao: { x: 24.4, y: 14, l: 73.1, a: 19 },
        alt: "Primeira campanha aberta, com a explicação do custo por compra e a venda pela UTM.",
      },
    ],
  },
};
