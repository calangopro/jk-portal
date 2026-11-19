import type { Tutorial } from "../tipos.ts";

export const oportunidades: Tutorial = {
  href: "/admin/oportunidades",
  resumo: "Quem vale chamar nos próximos dias: aniversário, data do casal, casamento chegando e um ano da compra.",
  versoes: {
    todos: [
      {
        titulo: "Escolha a janela de dias",
        texto: "Em cima, à direita, escolha 7, 30 ou 90 dias. A lista mostra quem tem uma data importante dentro desse prazo. O painel só abre a conversa: quem escreve ao cliente é você.",
        print: "oportunidades-1.webp",
        regiao: { x: 24.4, y: 10, l: 73.1, a: 29 },
        alt: "Título da tela Oportunidades e os botões de 7, 30 e 90 dias.",
      },
      {
        titulo: "Leia os três números",
        texto: "Nesta semana é o que vence de hoje a sete dias. Passaram da data é o que ninguém marcou ainda: vale chamar com atraso. Resolva primeiro o que está em amarelo.",
        print: "oportunidades-1.webp",
        regiao: { x: 24.4, y: 39.5, l: 73.1, a: 20.3 },
        alt: "Três cartões: nesta semana, em 30 dias e passaram da data.",
      },
      {
        titulo: "Filtre pelo tipo ou só os seus",
        texto: "Toque em um tipo, como Aniversário de namoro, para ver só ele. Marque Só os meus clientes para ver apenas quem está com você.",
        print: "oportunidades-1.webp",
        regiao: { x: 24, y: 60.5, l: 73.5, a: 11.5 },
        alt: "Filtros por tipo de oportunidade e a caixa Só os meus clientes.",
      },
      {
        titulo: "Abra a conversa no WhatsApp",
        texto: "Cada cartão diz o motivo e o que oferecer. Toque em Abrir no WhatsApp para falar com o cliente com a mensagem à mão. O nome do cliente abre a ficha dele.",
        print: "oportunidades-2.webp",
        regiao: { x: 24.4, y: 42, l: 36, a: 26 },
        alt: "Cartão de uma oportunidade com o motivo, o que oferecer e o botão do WhatsApp.",
      },
      {
        titulo: "Marque Já falei ou Não vale",
        texto: "Falou com o cliente? Toque em Já falei e ele sai da lista. Se a data não é do casal, toque em Não vale. A marca vale só para essa data: no ano que vem o aviso volta.",
        print: "oportunidades-2.webp",
        regiao: { x: 39.5, y: 60, l: 17, a: 6.5 },
        alt: "Botões Já falei e Não vale ao lado do botão do WhatsApp.",
      },
    ],
  },
};
