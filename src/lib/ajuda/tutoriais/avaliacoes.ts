import type { Tutorial } from "../tipos.ts";

export const avaliacoes: Tutorial = {
  href: "/admin/avaliacoes",
  resumo: "Responda as avaliações do Google que ainda estão sem resposta e leve o horário do Google para a página da loja.",
  versoes: {
    todos: [
      {
        titulo: "Veja o que está sem resposta, loja por loja",
        texto: "No alto, os selos contam quantas avaliações esperam resposta e quantas têm nota baixa. Cada cartão é uma loja, com a nota e o total do Google. Só aparece o que ainda não foi respondido.",
        print: "avaliacoes-1.webp",
        regiao: { x: 24.4, y: 28.5, l: 73.1, a: 14 },
        alt: "Selos de avaliações sem resposta e o cabeçalho da Loja Exemplo Um com a nota do Google.",
      },
      {
        titulo: "Comece pelas notas baixas",
        texto: "A nota baixa vem na frente e leva um selo vermelho. Leia o texto do cliente com calma antes de responder. Toque em Responder embaixo da avaliação.",
        print: "avaliacoes-1.webp",
        regiao: { x: 24.4, y: 61.5, l: 73.1, a: 14 },
        alt: "Avaliação de duas estrelas com o selo Nota baixa e o botão Responder.",
      },
      {
        titulo: "Escreva a resposta da loja",
        texto: "Escreva no campo Resposta da loja. Nas avaliações de 4 e 5 estrelas, dá para tocar num começo pronto e ajustar. Para nota baixa, escreva uma resposta para aquele caso.",
        print: "avaliacoes-2.webp",
        regiao: { x: 26, y: 33.5, l: 70, a: 24 },
        alt: "Campo Resposta da loja preenchido com um começo pronto e o botão Conferir antes de publicar.",
      },
      {
        titulo: "Confira e publique no Google",
        texto: "Toque em Conferir antes de publicar e leia o texto como ele vai sair. Publicar no Google coloca a resposta no nome da loja, para qualquer pessoa ler. Se algo estiver errado, toque em Voltar e editar.",
        print: "avaliacoes-3.webp",
        regiao: { x: 26, y: 40, l: 70, a: 17 },
        alt: "Quadro Vai sair assim no Google com o texto e os botões Publicar no Google e Voltar e editar.",
      },
      {
        titulo: "Leve o horário do Google para a página da loja",
        texto: "O quadro Horário no Google mostra o horário que o Google tem. Se a página da loja estiver diferente ou sem horário, confira qual vale e toque em Usar este horário na página da loja.",
        print: "avaliacoes-1.webp",
        regiao: { x: 26, y: 42.6, l: 70, a: 16.5 },
        alt: "Quadro Horário no Google com o botão Usar este horário na página da loja.",
      },
    ],
  },
};
