import type { Tutorial } from "../tipos.ts";

export const clientes: Tutorial = {
  href: "/admin/clientes",
  resumo: "A ficha de cada cliente: o que ele já comprou, em que fase está e tudo o que aconteceu com ele, num lugar só.",
  versoes: {
    todos: [
      {
        titulo: "Ache o cliente",
        texto: "Digite o nome, o telefone ou o número do pedido. A busca começa sozinha, sem precisar apertar nada. Telefone e e-mail não ficam no endereço da página, para ninguém vazar.",
        print: "clientes-1.webp",
        regiao: { x: 24, y: 29.5, l: 73.5, a: 7 },
        alt: "Campo de busca de clientes no topo da tela.",
      },
      {
        titulo: "Comece pelos seus clientes",
        texto: "Clientes com você traz quem você marcou que cuida. Compraram por último mostra quem pagou nos últimos 30 dias: boa hora para uma mensagem de agradecimento.",
        print: "clientes-1.webp",
        regiao: { x: 24, y: 38.5, l: 73.5, a: 60 },
        alt: "Listas Clientes com você e Compraram por último.",
      },
      {
        titulo: "Fale com o cliente pela ficha",
        texto: "Na ficha, os botões do topo abrem o WhatsApp, ligam, buscam o cliente na Kommo e passam o caso para o suporte. Passar para o suporte leva o pedido junto.",
        print: "clientes-ficha-1.webp",
        regiao: { x: 24, y: 30, l: 51, a: 6.5 },
        alt: "Botões Abrir no WhatsApp, Ligar, Kommo e Passar para o suporte.",
      },
      {
        titulo: "Veja o negócio na Kommo",
        texto: "O quadro Na Kommo mostra os negócios do cliente, em que etapa estão e quem cuida. Venda ganha aparece em verde. Toque em Abrir na Kommo para ir direto à conversa.",
        print: "clientes-ficha-1.webp",
        regiao: { x: 24, y: 41.5, l: 73.5, a: 34 },
        alt: "Quadro Na Kommo com um negócio fechado como venda ganha.",
      },
      {
        titulo: "Preencha o que você sabe dele",
        texto: "Marque a fase (namoro, noivado, casamento marcado) e as datas que importam. É daqui que saem os avisos de aniversário e de casamento na tela Oportunidades.",
        print: "clientes-ficha-2.webp",
        regiao: { x: 24, y: 68, l: 73.5, a: 31 },
        alt: "Bloco O que sabemos, com a fase do cliente e o nome do par.",
      },
      {
        titulo: "Leia a linha do tempo",
        texto: "Do mais novo para o mais antigo: pedidos, vendas por fora, fábrica, Kommo e cadastro no grupo. O botão Histórico abre o caminho de cada pedido. Dá para atender sem perguntar a ninguém.",
        print: "clientes-ficha-3.webp",
        regiao: { x: 26, y: 21, l: 72, a: 62 },
        alt: "Linha do tempo do cliente, com pagamento, fábrica, Kommo e pedido.",
      },
    ],
  },
};
