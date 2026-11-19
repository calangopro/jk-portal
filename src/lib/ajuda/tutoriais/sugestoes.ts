import type { Tutorial } from "../tipos.ts";

export const sugestoes: Tutorial = {
  href: "/admin/sugestoes",
  resumo: "Mande ideias para melhorar o painel, com prints, e acompanhe o andamento e a resposta de cada uma.",
  versoes: {
    todos: [
      {
        titulo: "Toque em Sugerir melhoria",
        texto: "O botão fica no alto de toda tela, ao lado do Como usar. Ele já leva junto o nome da tela onde você está, então não precisa explicar onde viu o problema.",
        print: "sugestoes-1.webp",
        regiao: { x: 76.8, y: 1.5, l: 13, a: 4.3 },
        alt: "Botão Sugerir melhoria na barra de cima do painel.",
      },
      {
        titulo: "Escreva o que seria bom ter ou mudar",
        texto: "Conte com suas palavras o que atrapalha ou o que ajudaria. Pode ser um exemplo do seu dia: quanto mais claro, mais fácil de a equipe entender e fazer.",
        print: "sugestoes-2.webp",
        regiao: { x: 31.9, y: 30.1, l: 36.3, a: 17 },
        alt: "Janela de sugestão com o campo de texto preenchido.",
      },
      {
        titulo: "Cole ou anexe um print",
        texto: "Se ajudar, mostre a tela. No computador, aperte Ctrl+V (ou Cmd+V no Mac) com o print copiado. No celular, toque em Anexar print. Cabem até 4 prints.",
        print: "sugestoes-2.webp",
        regiao: { x: 31.9, y: 50.1, l: 36.3, a: 14.5 },
        alt: "Área de prints da janela, com uma miniatura anexada e o botão Anexar print.",
      },
      {
        titulo: "Toque em Enviar sugestão",
        texto: "Pronto, ela entra na lista da equipe. Uma mensagem confirma o envio, e dali você pode ir direto para as suas sugestões.",
        print: "sugestoes-2.webp",
        regiao: { x: 31.9, y: 68.8, l: 12.1, a: 5 },
        alt: "Botão Enviar sugestão no fim da janela.",
      },
      {
        titulo: "Acompanhe o estado e a resposta",
        texto: "Em Time, Sugestões, você vê só as suas. O selo diz se está Nova, Planejada, Em andamento, Feita ou Não vai entrar, e a resposta de quem cuida do painel aparece embaixo do texto.",
        print: "sugestoes-1.webp",
        regiao: { x: 24.4, y: 36.8, l: 73.1, a: 57.3 },
        alt: "Lista com as sugestões da pessoa, cada uma com o estado e a resposta da equipe.",
      },
    ],
    diretoria: [
      {
        titulo: "Leia todas as sugestões do time",
        texto: "Aqui chegam as sugestões de todo mundo, com o nome de quem mandou, a tela e o aparelho. Os prints abrem ao tocar. A lista abre em Abertas, que é o que ainda não foi resolvido.",
        print: "sugestoes-3.webp",
        regiao: { x: 24.4, y: 36.8, l: 73.1, a: 4.3 },
        alt: "Abas de estado no alto da lista de sugestões, com a contagem de cada uma.",
      },
      {
        titulo: "Leve para o Roadmap o que vale a pena",
        texto: "Em Levar para o Roadmap, a ideia vira um cartão de trabalho. A partir daí o estado da sugestão anda sozinho junto com o cartão, e quem sugeriu acompanha por aqui.",
        print: "sugestoes-3.webp",
        regiao: { x: 26, y: 52.8, l: 12.3, a: 2.4 },
        alt: "Link Levar para o Roadmap embaixo do texto de uma sugestão nova.",
      },
      {
        titulo: "Escolha o estado e escreva a resposta",
        texto: "Em Estado, marque se está Planejada, Em andamento, Feita ou Não vai entrar. Na resposta, diga em uma frase o que vai acontecer. É esse texto que a pessoa lê. Sugestão que já tem cartão não deixa mudar o estado aqui.",
        print: "sugestoes-3.webp",
        regiao: { x: 26, y: 59.5, l: 70, a: 12 },
        alt: "Campos Estado e Resposta para quem sugeriu, já preenchidos.",
      },
      {
        titulo: "Toque em Salvar",
        texto: "O botão só liga depois que você muda algo. Ao salvar, o número de sugestões novas no menu diminui, e a pessoa vê a resposta na lista dela.",
        print: "sugestoes-3.webp",
        regiao: { x: 26, y: 71.9, l: 5.9, a: 4.5 },
        alt: "Botão Salvar no cartão da sugestão.",
      },
    ],
  },
};
