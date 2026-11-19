import type { Passo, Tutorial } from "../tipos.ts";

const entra: Passo = {
  titulo: "A venda ganha na Kommo entra sozinha",
  texto: "Quando você move o negócio para Venda ganha na Kommo, ele aparece aqui. Com o número do pedido no campo Pedido Tray, vira venda sua do site. Sem ele, vira venda por fora. Não lance de novo.",
  print: "vendas-da-kommo-1.webp",
  regiao: { x: 24.4, y: 10, l: 73.1, a: 24 },
  alt: "Título e explicação da tela Vendas da Kommo.",
};

const resumo: Passo = {
  titulo: "Leia os quatro números",
  texto: "Pedidos do site marcados, vendas por fora lançadas, o que está na conferência e o que espera o pedido chegar. Em conferência e esperando, olhe com atenção.",
  print: "vendas-da-kommo-1.webp",
  regiao: { x: 24.4, y: 36.5, l: 73.1, a: 11 },
  alt: "Quatro cartões com os números da Kommo nos últimos dias.",
};

const filaVendedor: Passo = {
  titulo: "Leia o aviso da fila de conferência",
  texto: "Quando o painel não tem certeza, ele deixa a venda na fila e diz o motivo, como parece pedido já pago ou ganho sem valor. Quem resolve é a gerência. Se for venda sua, avise.",
  print: "vendas-da-kommo-1.webp",
  regiao: { x: 24.4, y: 48, l: 73.1, a: 28 },
  alt: "Fila de conferência com um cartão avisando que parece um pedido já pago.",
};

const lista: Passo = {
  titulo: "Veja as vendas que vieram da Kommo",
  texto: "A lista mostra cada venda com o estado ao lado do nome: pedido do site marcado, venda por fora lançada ou esperando o pedido chegar. Troque o período nos botões de cima.",
  print: "vendas-da-kommo-2.webp",
  regiao: { x: 24.4, y: 34, l: 73.1, a: 60 },
  alt: "Lista Vendas que vieram da Kommo, cada uma com seu estado.",
};

const botoes: Passo = {
  titulo: "Abra o negócio ou o histórico",
  texto: "Abrir na Kommo leva ao negócio. Histórico, quando existe, mostra o caminho do pedido: quem vendeu, a fábrica e o suporte.",
  print: "vendas-da-kommo-2.webp",
  regiao: { x: 75, y: 52, l: 22, a: 7 },
  alt: "Botões Histórico e Abrir na Kommo no cartão de uma venda.",
};

const cartaoDaFila: Passo = {
  titulo: "Resolva cada caso da fila",
  texto: "Cada cartão traz o cliente, o valor e o motivo da dúvida. Confira os dados e decida: é o mesmo pedido, é venda por fora, ou não é venda.",
  print: "vendas-da-kommo-3.webp",
  regiao: { x: 24.4, y: 3, l: 73.1, a: 35 },
  alt: "Cartão da fila com cliente, valor, motivo e os campos para resolver.",
};

const campos: Passo = {
  titulo: "Confirme o vendedor e o pedido",
  texto: "Escolha o vendedor e, se a venda foi pelo site, digite o número do pedido. Se não houver pedido, deixe o campo vazio.",
  print: "vendas-da-kommo-3.webp",
  regiao: { x: 24.4, y: 21, l: 73.1, a: 9 },
  alt: "Campos Vendedor e Pedido do site dentro do cartão da fila.",
};

const acoes: Passo = {
  titulo: "Escolha o que fazer com a venda",
  texto: "Marcar o pedido liga a venda ao pedido do site. Lançar como venda por fora grava a venda sem pedido do site. Tirar da fila descarta quando não é venda.",
  print: "vendas-da-kommo-3.webp",
  regiao: { x: 25, y: 30.5, l: 45, a: 6.5 },
  alt: "Botões Marcar o pedido, Lançar como venda por fora, Tirar da fila e Abrir na Kommo.",
};

const gerencia = [entra, cartaoDaFila, campos, acoes, lista];

export const vendasDaKommo: Tutorial = {
  href: "/admin/vendas-da-kommo",
  resumo: "A venda ganha na Kommo que entrou sozinha no painel, e a fila do que precisa de conferência.",
  versoes: {
    todos: [entra, resumo, filaVendedor, lista, botoes],
    gerente: gerencia,
    diretoria: gerencia,
  },
};
