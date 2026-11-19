import type { Tutorial } from "../tipos.ts";

export const kommoAutomacoes: Tutorial = {
  href: "/admin/kommo/automacoes",
  resumo: "Escolha o que o painel cria e move sozinho na Kommo, e ligue cada automação com segurança.",
  versoes: {
    todos: [
      {
        titulo: "Veja quantas estão ligadas",
        texto: "A frase no alto diz quantas das quatro automações estão ligadas. Todas nascem desligadas, e com nenhuma ligada o painel não escreve nada na Kommo.",
        print: "kommo-automacoes-1.webp",
        regiao: { x: 24, y: 32.5, l: 30, a: 4 },
        alt: "Frase no alto da tela dizendo que uma de quatro automações está ligada.",
      },
      {
        titulo: "Leia o que cada uma faz",
        texto: "Cada cartão diz quando a automação age e o que ela faz na Kommo. Leia com calma: criar ou mover negócio pode mandar mensagem para cliente de verdade.",
        print: "kommo-automacoes-1.webp",
        regiao: { x: 25.5, y: 44.5, l: 33, a: 28 },
        alt: "Cartão Recuperação de pedido com os textos Quando e O que faz na Kommo.",
      },
      {
        titulo: "Escolha o funil e a etapa",
        texto: "Escolha o funil e a etapa onde o negócio nasce. Se quiser, escolha também quem fica como responsável pelo negócio criado.",
        print: "kommo-automacoes-2.webp",
        regiao: { x: 26, y: 7, l: 68.5, a: 8.5 },
        alt: "Campos de etapa e de responsável de uma automação.",
      },
      {
        titulo: "Ajuste a espera e o teto",
        texto: "A espera é quanto tempo depois do evento a automação age. O teto limita quantas escritas ela faz por hora. Toque em Salvar. Mexer numa automação ligada desliga ela.",
        print: "kommo-automacoes-2.webp",
        regiao: { x: 26, y: 17, l: 34, a: 18 },
        alt: "Campos de espera e de teto por hora, com o botão Salvar.",
      },
      {
        titulo: "Confira e ligue",
        texto: "Abra o funil na Kommo e veja o que o Salesbot de cada etapa faz. Depois marque que conferiu e toque em Ligar. Quem liga vira o autor de cada escrita.",
        print: "kommo-automacoes-2.webp",
        regiao: { x: 25.5, y: 37.5, l: 34.5, a: 61 },
        alt: "Aviso Antes de ligar, com a caixa de conferência marcada e o botão Ligar.",
      },
      {
        titulo: "Acompanhe o que foi feito",
        texto: "No fim da tela fica a lista do que o painel fez na Kommo. Toque em Recusas e erros para ver só o que deu problema e agir.",
        print: "kommo-automacoes-3.webp",
        regiao: { x: 24, y: 61, l: 75, a: 34 },
        alt: "Lista O que o painel fez na Kommo, com uma escrita recusada.",
      },
    ],
  },
};
