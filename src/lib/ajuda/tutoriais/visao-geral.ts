import type { Tutorial } from "../tipos.ts";

export const visaoGeral: Tutorial = {
  href: "/admin",
  resumo: "O resumo do negócio numa tela, com o que pede atenção primeiro.",
  versoes: {
    todos: [
      {
        titulo: "Comece pelo que pede atenção",
        texto: "A Visão geral mostra só o que o seu acesso abre. Não tem dado que você não pode ver, e o que aparece muda de pessoa para pessoa.",
        print: "visao-geral-1.webp",
        regiao: { x: 24.4, y: 12.5, l: 55, a: 10 },
        alt: "Título da Visão geral dizendo o nível de acesso da pessoa.",
      },
      {
        titulo: "Entre num setor pelos cartões",
        texto: "Cada cartão colorido leva a um setor. Quando há número, ele resume o que está rolando lá dentro. Toque no cartão para abrir.",
        print: "visao-geral-1.webp",
        regiao: { x: 24.4, y: 28.6, l: 50, a: 24.5 },
        alt: "Três cartões de setor: Vendas, Time e Tráfego.",
      },
      {
        titulo: "Veja o que espera você no chat",
        texto: "Mensagem nova ou pedido que espera o seu setor aparece numa faixa própria. Toque nela e você cai direto no chat do time.",
        print: "visao-geral-1.webp",
        regiao: { x: 24.4, y: 57.1, l: 73.1, a: 11.2 },
        alt: "Faixa dizendo que há duas mensagens novas no chat do time.",
      },
      {
        titulo: "Leia os avisos e siga o link",
        texto: "Cada aviso diz o problema ou a chance, o motivo e para onde ir. O link no fim do aviso abre a tela certa para resolver.",
        print: "visao-geral-1.webp",
        regiao: { x: 24.4, y: 72.5, l: 73.1, a: 21 },
        alt: "Dois cartões de aviso, um de atenção e outro de problema, cada um com um link no fim.",
      },
    ],
    diretoria: [
      {
        titulo: "Confira a meta do mês",
        texto: "A barra mostra quanto da meta já entrou. O risco preto marca onde ela deveria estar hoje, e ao lado você vê quanto falta e quanto precisa entrar por dia.",
        print: "visao-geral-2.webp",
        regiao: { x: 24.4, y: 29.1, l: 73.1, a: 33 },
        alt: "Cartão da meta de novembro com a barra de progresso e o risco preto do ritmo.",
      },
      {
        titulo: "Mude a meta quando precisar",
        texto: "Abra Mudar a meta, escreva o faturamento que a loja quer no mês e toque em Salvar a meta. O painel refaz as contas na hora.",
        print: "visao-geral-2.webp",
        regiao: { x: 25.8, y: 60.2, l: 9, a: 3 },
        alt: "Texto Mudar a meta no fim do cartão da meta.",
      },
      {
        titulo: "Abra os setores pelos cartões",
        texto: "A diretoria vê todas as salas. Cada cartão traz o número do setor, como vendas do mês ou gasto em anúncio, e leva para dentro dele.",
        print: "visao-geral-2.webp",
        regiao: { x: 24.4, y: 69.4, l: 73.1, a: 30 },
        alt: "Cartões dos setores com o número de cada um.",
      },
      {
        titulo: "Veja o resultado do mês",
        texto: "O quadro mostra o que entrou e o que saiu até hoje. A sobra ainda não é lucro, porque falta tirar o custo das peças. O texto embaixo diz isso.",
        print: "visao-geral-3.webp",
        regiao: { x: 24.4, y: 11.2, l: 73.1, a: 57.8 },
        alt: "Quadro Resultado de novembro com o vendido, os custos e a sobra.",
      },
      {
        titulo: "Compare com os 30 dias de antes",
        texto: "Faturamento, pedidos, ticket e pedidos que não viraram venda vêm com seta de subiu ou caiu. Mais abaixo ficam os avisos e os gráficos.",
        print: "visao-geral-3.webp",
        regiao: { x: 24.4, y: 73.5, l: 73.1, a: 24 },
        alt: "Quatro números dos últimos 30 dias, cada um com a variação sobre o período anterior.",
      },
    ],
  },
};
