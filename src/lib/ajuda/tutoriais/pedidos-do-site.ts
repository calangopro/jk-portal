import type { Passo, Tutorial } from "../tipos.ts";

const busca: Passo = {
  titulo: "Procure o pedido",
  texto: "Digite o número do pedido, o nome ou o telefone do cliente, ou uma palavra da peça. A lista se refaz a cada letra, e o número do pedido vale em qualquer período.",
  print: "pedidos-do-site-1.webp",
  regiao: { x: 25.2, y: 31.5, l: 71.5, a: 7 },
  alt: "Campo de busca no topo da lista de pedidos do site.",
};

const filtros: Passo = {
  titulo: "Escolha o filtro e o período",
  texto: "Sem vendedor mostra o que ninguém marcou ainda. Meus mostra os seus, e Todos mostra tudo. Embaixo você troca o período: 30 dias, este mês, mês passado e assim por diante.",
  print: "pedidos-do-site-1.webp",
  regiao: { x: 25.2, y: 38.5, l: 71.5, a: 13.5 },
  alt: "Botões Sem vendedor, Meus e Todos, e os botões de período.",
};

const fui: Passo = {
  titulo: "Toque em Fui eu que vendi",
  texto: "Achou o pedido que você fechou? Toque no botão azul. O pedido entra no seu mês e no ranking. Pedido de outra pessoa não dá para tomar.",
  print: "pedidos-do-site-1.webp",
  regiao: { x: 25, y: 70.3, l: 13, a: 6.3 },
  alt: "Botão Fui eu que vendi no cartão do primeiro pedido.",
};

const historico: Passo = {
  titulo: "Veja o caminho do pedido no Histórico",
  texto: "O botão Histórico abre a vida do pedido: quem vendeu, por onde chegou, o que a fábrica fez e se houve caso de suporte. Serve para tirar dúvida sem perguntar no grupo.",
  print: "pedidos-do-site-1.webp",
  regiao: { x: 37.8, y: 70.3, l: 9, a: 6.3 },
  alt: "Botão Histórico ao lado do botão Fui eu que vendi.",
};

const varios: Passo = {
  titulo: "Vendeu vários? Marque de uma vez",
  texto: "Toque em Marcar vários, escolha os pedidos e confirme em Marcar como meus. O painel pede um segundo toque de confirmação antes de gravar.",
  print: "pedidos-do-site-2.webp",
  regiao: { x: 24.8, y: 56, l: 73, a: 43 },
  alt: "Dois pedidos escolhidos e a barra com o botão Marcar como meus.",
};

const valorVisivel: Passo = {
  titulo: "Você vê o valor de cada pedido",
  texto: "Gerência e diretoria veem o valor de todos os pedidos. O vendedor vê o valor só do pedido que já é dele, para ninguém somar o faturamento da loja.",
  print: "pedidos-do-site-3.webp",
  regiao: { x: 24.8, y: 13, l: 73, a: 30 },
  alt: "Pedidos escolhidos mostrando o valor de cada um.",
};

const paraQuem: Passo = {
  titulo: "Marque para quem vendeu",
  texto: "Com os pedidos escolhidos, abra a lista da barra e escolha a pessoa. Depois confirme: a venda passa a contar no mês e no ranking dela.",
  print: "pedidos-do-site-3.webp",
  regiao: { x: 24.8, y: 80.5, l: 72, a: 19 },
  alt: "Barra de marcação com a lista Marcar como venda de.",
};

export const pedidosDoSite: Tutorial = {
  href: "/admin/pedidos-do-site",
  resumo: "Ache o pedido que você vendeu pelo site e marque como seu, para ele contar no seu mês.",
  versoes: {
    todos: [busca, filtros, fui, historico, varios],
    gerente: [busca, filtros, valorVisivel, paraQuem, historico],
    diretoria: [busca, filtros, valorVisivel, paraQuem, historico],
  },
};
