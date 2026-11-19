import type { Passo, Tutorial } from "../tipos.ts";

const cartoes: Passo = {
  titulo: "Veja o seu dia e o seu mês",
  texto: "Os três cartões de cima mostram o que você vendeu hoje, no mês e o ticket médio. Só entram aqui as vendas fechadas fora do site: Pix, link de pagamento, venda pelo WhatsApp.",
  print: "registrar-venda-1.webp",
  regiao: { x: 24.4, y: 35.2, l: 73.1, a: 17.5 },
  alt: "Os três cartões do topo da tela: vendas de hoje, do mês e ticket médio.",
};

const resto: Passo[] = [
  {
    titulo: "Digite o valor e como pagou",
    texto: "Escreva quanto entrou e escolha a forma: Pix, link de pagamento, cartão ou dinheiro. Pedido pago pelo site não precisa ser lançado aqui, ele já vem da loja.",
    print: "registrar-venda-1.webp",
    regiao: { x: 25.5, y: 62.8, l: 71, a: 8.5 },
    alt: "Campos Valor recebido e Como pagou do formulário Nova venda.",
  },
  {
    titulo: "Diga quem comprou e o que vendeu",
    texto: "Preencha o nome e o WhatsApp do cliente, o que foi vendido, por onde ele veio e o dia da venda. Venda antiga entra com o dia em que aconteceu, até um ano para trás.",
    print: "registrar-venda-1.webp",
    regiao: { x: 25.5, y: 71.3, l: 71, a: 26.3 },
    alt: "Campos de nome, WhatsApp, produto, canal e dia da venda.",
  },
  {
    titulo: "Marque Mandar para a fábrica quando precisar",
    texto: "Se a peça ainda vai ser feita, gravada ou despachada, marque a caixa. Ela abre a numeração, a gravação e a entrega, e a venda entra na fila da fábrica.",
    print: "registrar-venda-2.webp",
    regiao: { x: 25.5, y: 31, l: 71, a: 12.6 },
    alt: "Caixa Mandar para a fábrica abaixo dos campos da venda.",
  },
  {
    titulo: "Toque em Registrar venda",
    texto: "Confira o valor e toque no botão. Se o painel achar que a venda já existe, ele avisa antes de gravar. Aí você decide se é outra venda mesmo.",
    print: "registrar-venda-2.webp",
    regiao: { x: 25.5, y: 43.2, l: 13.5, a: 6.8 },
    alt: "Botão Registrar venda no fim do formulário.",
  },
  {
    titulo: "Errou? Estorne, não apague",
    texto: "A venda de hoje ou de ontem que você lançou errada pode ser estornada na lista Vendas do mês. Venda não se apaga, para o histórico continuar certo.",
    print: "registrar-venda-2.webp",
    regiao: { x: 24.4, y: 54.7, l: 73.1, a: 39.2 },
    alt: "Lista Vendas do mês, com as últimas vendas lançadas.",
  },
];

const quemVendeu: Passo = {
  titulo: "Escolha quem vendeu",
  texto: "Você lança a venda em nome de qualquer vendedor. Escolha a pessoa em Quem vendeu antes de registrar, para a venda contar no ranking dela.",
  print: "registrar-venda-3.webp",
  regiao: { x: 25.5, y: 48.3, l: 71, a: 8.4 },
  alt: "Campo Quem vendeu, que só aparece para gerência e diretoria.",
};

const gerencia = [quemVendeu, ...resto];

export const registrarVenda: Tutorial = {
  href: "/admin/registrar-venda",
  resumo: "Lance a venda que você fechou fora do site, com o cliente, o valor e, se for o caso, a ida para a fábrica.",
  versoes: {
    todos: [cartoes, ...resto],
    gerente: gerencia,
    diretoria: gerencia,
  },
};
