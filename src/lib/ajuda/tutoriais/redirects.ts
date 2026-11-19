import type { Tutorial } from "../tipos.ts";

export const redirects: Tutorial = {
  href: "/admin/redirects",
  resumo: "Leve quem pede um endereço antigo para a página certa, e avise o Google que a página mudou de lugar.",
  versoes: {
    todos: [
      {
        titulo: "Veja os endereços quebrados",
        texto: "No alto ficam os endereços que alguém pediu e que não existem mais. Cada um mostra quantos pedidos teve, quando foi o último e de onde a pessoa veio.",
        print: "redirects-1.webp",
        regiao: { x: 24.4, y: 23, l: 73.1, a: 14 },
        alt: "Primeiro endereço quebrado da fila, com o número de pedidos e o palpite de destino.",
      },
      {
        titulo: "Aceite o palpite com Criar o desvio",
        texto: "O painel sugere a página que mais se parece com o endereço pedido. Se for isso mesmo, toque em Criar o desvio. Se o endereço não importa, toque em Tirar da fila.",
        print: "redirects-1.webp",
        regiao: { x: 78, y: 25.5, l: 19.5, a: 4.5 },
        alt: "Botões Criar o desvio e Tirar da fila no endereço quebrado.",
      },
      {
        titulo: "Sem palpite, escolha você o destino",
        texto: "Quando nenhuma página se parece, o cartão avisa. Escolha o destino no formulário logo abaixo, ou marque como 410 se a página saiu de vez e não tem substituta.",
        print: "redirects-1.webp",
        regiao: { x: 24.4, y: 38.7, l: 73.1, a: 16.3 },
        alt: "Endereço quebrado sem palpite de destino.",
      },
      {
        titulo: "Preencha o endereço antigo e o novo",
        texto: "Em Endereço antigo, escreva o que as pessoas ainda pedem, começando com barra. Em Levar para, ponha a página que responde a mesma dúvida, não a home.",
        print: "redirects-2.webp",
        regiao: { x: 26, y: 17.5, l: 70, a: 30 },
        alt: "Campos Endereço antigo, Tipo e Levar para do formulário Criar redirect.",
      },
      {
        titulo: "Escreva o motivo e toque em Criar redirect",
        texto: "Diga por que o desvio existe, numa frase. Daqui a seis meses ninguém vai lembrar. O Tipo padrão, Mudou de lugar, passa a força do endereço antigo para o novo.",
        print: "redirects-2.webp",
        regiao: { x: 26, y: 50, l: 70, a: 21 },
        alt: "Campo Motivo e o botão Criar redirect.",
      },
      {
        titulo: "Edite ou remova um desvio cadastrado",
        texto: "Em Desvios cadastrados, toque numa linha para abrir. Mude o que precisar e toque em Salvar alterações, ou em Remover este desvio. Um desvio novo pode levar até um minuto para valer.",
        print: "redirects-3.webp",
        regiao: { x: 24.4, y: 17.2, l: 73.1, a: 78 },
        alt: "Desvio cadastrado aberto, com os campos para editar e o link Remover este desvio.",
      },
    ],
  },
};
