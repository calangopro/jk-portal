import type { Tutorial } from "../tipos.ts";

export const funilDaKommo: Tutorial = {
  href: "/admin/funil",
  resumo: "Veja todos os negócios abertos da Kommo num funil só, descubra quem está esperando e abra o negócio para continuar a conversa.",
  versoes: {
    todos: [
      {
        titulo: "Comece pelos dois alertas",
        texto: "Esperando vendedor mostra os negócios que ninguém da loja assumiu. Cliente sem resposta mostra quem escreveu e não recebeu retorno. Toque num cartão e a lista lá embaixo mostra só esses negócios.",
        print: "funil-da-kommo-1.webp",
        regiao: { x: 24.4, y: 33.3, l: 73.1, a: 26.4 },
        alt: "Os cartões Esperando vendedor e Cliente sem resposta, com a quantidade de negócios atrasados.",
      },
      {
        titulo: "Filtre por período, loja ou vendedor",
        texto: "Escolha o período, a loja, o vendedor, o funil ou a origem e toque em Filtrar. Os números e as fases abaixo passam a olhar só esse recorte. Limpar volta ao todo. Os alertas de cima não mudam com o filtro.",
        print: "funil-da-kommo-1.webp",
        regiao: { x: 24.4, y: 62.7, l: 73.1, a: 12.8 },
        alt: "Filtros de período, loja, vendedor, funil e origem, com os botões Filtrar e Limpar.",
      },
      {
        titulo: "Leia os quatro números",
        texto: "Abertos agora e Valor em jogo mostram o tamanho do funil. Conversão diz quantos dos negócios fechados viraram venda. Primeira resposta é o tempo que a loja leva, no meio da fila, para responder um cliente novo.",
        print: "funil-da-kommo-2.webp",
        regiao: { x: 24.4, y: 7.3, l: 73.1, a: 19.5 },
        alt: "Cartões Abertos agora, Valor em jogo, Conversão e Primeira resposta.",
      },
      {
        titulo: "Siga o caminho por fase",
        texto: "Cada barra é uma fase, da Entrada até Esperando pagamento. Veja quantos negócios estão ali, quantos estão parados há mais de 7 dias e quantos esperam resposta. Toque em etapas nesta fase para ver o detalhe.",
        print: "funil-da-kommo-2.webp",
        regiao: { x: 24.4, y: 30.5, l: 73.1, a: 69.5 },
        alt: "As fases do funil, cada uma com a quantidade de negócios abertos e os selos de atenção.",
      },
      {
        titulo: "Veja por que as vendas se perdem",
        texto: "Em Motivos de perda aparecem as razões marcadas na Kommo nos negócios perdidos do período. O motivo no topo é o que mais derruba venda e vale conversar com o time sobre ele.",
        print: "funil-da-kommo-3.webp",
        regiao: { x: 24.4, y: 10.5, l: 73.1, a: 33.5 },
        alt: "Lista de motivos de perda com barras e a porcentagem de cada um.",
      },
      {
        titulo: "Abra o negócio na Kommo",
        texto: "Os negócios parados há mais tempo aparecem primeiro. Toque em Abrir na Kommo para ir direto ao negócio e continuar a conversa lá. O painel só mostra, quem atende é a Kommo.",
        print: "funil-da-kommo-3.webp",
        regiao: { x: 24.4, y: 57.5, l: 73.1, a: 39.5 },
        alt: "Cartões de negócios parados, cada um com o botão Abrir na Kommo.",
      },
    ],
  },
};
