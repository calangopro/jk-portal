import type { Passo, Tutorial } from "../tipos.ts";

const passar: Passo = {
  titulo: "Passe o caso e volte a vender",
  texto: "Caiu pedra, ajuste, troca, atraso? Não resolva sozinho. Toque em Passar um caso: o suporte assume o cliente e você volta a vender. O painel te avisa quando o caso fechar.",
  print: "suporte-1.webp",
  regiao: { x: 24.4, y: 29, l: 73, a: 10 },
  alt: "Faixa com o botão Passar um caso, no topo da tela Suporte pós-venda.",
};

const assunto: Passo = {
  titulo: "Escolha o assunto e o pedido",
  texto: "Toque no assunto que mais se parece com o caso. Depois digite o número do pedido ou o nome do cliente. O painel traz o nome, o telefone e a etapa da fábrica sozinho.",
  print: "suporte-2.webp",
  regiao: { x: 24.4, y: 35.5, l: 73.5, a: 28 },
  alt: "Formulário com os botões de assunto e o campo Pedido do cliente.",
};

const relato: Passo = {
  titulo: "Conte o que o cliente disse",
  texto: "Escreva em uma ou duas frases o que ele pediu. Se tiver um print da conversa, cole aqui com Ctrl+V ou toque em Mandar o print. É melhor um print do que explicar.",
  print: "suporte-2.webp",
  regiao: { x: 24.4, y: 65.5, l: 73.5, a: 20 },
  alt: "Campo O que o cliente disse e o botão Mandar o print da conversa.",
};

const esperando: Passo = {
  titulo: "Marque se o cliente está esperando",
  texto: "Se ele está esperando resposta agora, marque a caixa. O caso vai para o topo da fila do suporte. Depois toque em Passar para o suporte.",
  print: "suporte-2.webp",
  regiao: { x: 24.4, y: 87, l: 73.5, a: 11 },
  alt: "Caixa O cliente está esperando resposta agora e o botão Passar para o suporte.",
};

const acompanhe: Passo = {
  titulo: "Acompanhe seus casos abertos",
  texto: "Os casos que você passou ficam em Seus casos abertos, com o relógio de quanto tempo estão sem dono. Ver o print e Histórico do pedido ajudam a lembrar do caso.",
  print: "suporte-1.webp",
  regiao: { x: 24.4, y: 56, l: 73, a: 38 },
  alt: "Cartão de um caso aberto, com o assunto, o cliente, o relato e o tempo sem dono.",
};

const nota: Passo = {
  titulo: "Leia a nota do caso fechado",
  texto: "Quando o suporte fecha, aparece uma etiqueta Nova e a nota dele, com o que ficou combinado com o cliente. Leia e, se precisar, fale com o cliente. A nota é para você.",
  print: "suporte-4.webp",
  regiao: { x: 24.4, y: 69, l: 73, a: 28 },
  alt: "Caso fechado com a etiqueta Nova e a nota do suporte em verde.",
};

const fila: Passo = {
  titulo: "Veja a fila e quem espera",
  texto: "Os casos sem dono aparecem primeiro. Cliente esperando fica em destaque, e o relógio mostra há quanto tempo o caso está parado. Resolva primeiro o que está mais antigo.",
  print: "suporte-3.webp",
  regiao: { x: 24.4, y: 58, l: 73, a: 35 },
  alt: "Fila do suporte com um caso sem dono e o botão Assumir.",
};

const falar: Passo = {
  titulo: "Fale com o cliente",
  texto: "WhatsApp do cliente abre a conversa. Ficha mostra tudo o que ele já comprou, e Histórico do pedido mostra a fábrica e o envio. Veja isso antes de responder.",
  print: "suporte-3.webp",
  regiao: { x: 25, y: 85.5, l: 56, a: 6 },
  alt: "Botões WhatsApp do cliente, Histórico do pedido e Ficha.",
};

const assumir: Passo = {
  titulo: "Toque em Assumir",
  texto: "Assumir põe o caso no seu nome, e o vendedor vê que alguém cuida dele. Sem assumir, outra pessoa do suporte pode começar o mesmo caso.",
  print: "suporte-3.webp",
  regiao: { x: 61, y: 85.5, l: 9, a: 6 },
  alt: "Botão Assumir destacado entre os botões do caso.",
};

const fechar: Passo = {
  titulo: "Feche com uma nota",
  texto: "Resolveu? Toque em Fechar o caso e escreva o que foi combinado com o cliente. É a nota que o vendedor lê. Se for venda e não suporte, devolva o caso com o motivo.",
  print: "suporte-3.webp",
  regiao: { x: 69.5, y: 85.5, l: 12, a: 6 },
  alt: "Botão Fechar o caso ao lado do botão Assumir.",
};

export const suporte: Tutorial = {
  href: "/admin/suporte",
  resumo: "Passe o caso de pós-venda para o suporte, sem perder tempo, e leia a nota quando ele fechar.",
  versoes: {
    todos: [passar, assunto, relato, esperando, acompanhe, nota],
    gerente: [fila, falar, assumir, fechar, nota],
    diretoria: [fila, falar, assumir, fechar, nota],
  },
};
