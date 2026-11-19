import type { Tutorial } from "../tipos.ts";

export const recuperacao: Tutorial = {
  href: "/admin/recuperacao",
  resumo: "Chame quem criou um pedido na loja e não pagou, começando pelo maior valor, e marque o que aconteceu com cada um.",
  versoes: {
    todos: [
      {
        titulo: "Escolha quantos dias olhar",
        texto: "Toque em 7, 14 ou 30 dias. A lista mostra os pedidos não pagos desse período. Quem paga um pedido novo sai da lista sozinho, você não precisa tirar.",
        print: "recuperacao-1.webp",
        regiao: { x: 80.1, y: 36.7, l: 17.4, a: 4.8 },
        alt: "Seletor de 7, 14 e 30 dias no alto da tela de recuperação.",
      },
      {
        titulo: "Veja quanto dinheiro está parado",
        texto: "Para chamar é o valor de quem ninguém procurou ainda. Em contato é de quem já está sendo atendido. Os dois cartões verdes mostram quem voltou e pagou, na loja ou por fora.",
        print: "recuperacao-1.webp",
        regiao: { x: 24.4, y: 44, l: 73.1, a: 22.3 },
        alt: "Cartões Para chamar, Em contato, Voltaram e pagaram e Pagaram por fora.",
      },
      {
        titulo: "Chame o cliente pelo WhatsApp",
        texto: "A lista vai do maior valor para o menor. Em cada cartão você vê o que travou, como Cartão não aprovado ou Pix não pago. Toque em Abrir no WhatsApp para falar, ou em Procurar na Kommo para achar a conversa.",
        print: "recuperacao-2.webp",
        regiao: { x: 24.4, y: 22.4, l: 73.1, a: 25.9 },
        alt: "Cartão de um cliente com valor, o que travou, telefone e os links do WhatsApp e da Kommo.",
      },
      {
        titulo: "Toque em Estou falando com a pessoa",
        texto: "Marque assim que começar a conversa. O cartão sai de Para chamar e vai para Em contato, com o seu nome, para ninguém chamar o mesmo cliente duas vezes. Se passar de um dia sem resultado, o aviso fica vermelho.",
        print: "recuperacao-2.webp",
        regiao: { x: 26, y: 41.9, l: 15.6, a: 4.6 },
        alt: "Botão Estou falando com a pessoa no cartão de um cliente.",
      },
      {
        titulo: "Registre quando o cliente pagou por fora",
        texto: "Se ele pagou por Pix, link ou cartão fora da loja, toque em Pagou por fora da loja, escolha como pagou, digite quanto entrou e toque em Registrar. Isso lança a venda e tira o cliente da fila.",
        print: "recuperacao-3.webp",
        regiao: { x: 42, y: 29, l: 38, a: 9.5 },
        alt: "Formulário Pagou por fora da loja aberto, com forma de pagamento, valor e botão Registrar.",
      },
      {
        titulo: "Tire da fila quem não vai mais comprar",
        texto: "Toque em Tirar da fila, escolha o motivo e confirme. O cliente vai para Tirados da fila, lá embaixo, e dá para trazer de volta com Voltar para a fila se mudar de ideia.",
        print: "recuperacao-3.webp",
        regiao: { x: 79.7, y: 29.4, l: 7.7, a: 3.8 },
        alt: "Botão Tirar da fila no cartão de um cliente.",
      },
    ],
  },
};
