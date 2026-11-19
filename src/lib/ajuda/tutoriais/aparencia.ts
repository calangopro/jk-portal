import type { Tutorial } from "../tipos.ts";

export const aparencia: Tutorial = {
  href: "/admin/aparencia",
  resumo: "Troque as cores e os cantos do site inteiro de uma vez, com a conferência de leitura feita na hora.",
  versoes: {
    todos: [
      {
        titulo: "Ache a cor que quer mudar",
        texto: "As cores estão em grupos: ação e destaque, texto, fundo e borda. Cada uma explica onde aparece no site, para você saber o que está mexendo.",
        print: "aparencia-1.webp",
        regiao: { x: 24.4, y: 24.7, l: 38.1, a: 48 },
        alt: "Grupo Ação e destaque, com quatro cores e a explicação de cada uma.",
      },
      {
        titulo: "Toque no quadrado ou digite o código",
        texto: "Toque no quadrado de cor para escolher, ou escreva o código no campo, como #BE9B60. A mudança aparece na hora no quadro Como vai ficar, ainda sem valer no site.",
        print: "aparencia-1.webp",
        regiao: { x: 72.5, y: 30.5, l: 25, a: 5.5 },
        alt: "Quadrado de cor e campo com o código da cor de ação.",
      },
      {
        titulo: "Confira a legibilidade",
        texto: "Cada linha é um par de cores que existe no site, com a nota de contraste. Se alguma reprovar, toque em corrigir para usar o tom mais próximo que passa.",
        print: "aparencia-1.webp",
        regiao: { x: 65, y: 24.7, l: 32.5, a: 47.7 },
        alt: "Quadro Legibilidade, com a razão de contraste de cada combinação.",
      },
      {
        titulo: "Ajuste os cantos",
        texto: "Em Cantos, escreva o arredondamento em px ou rem, como 10px ou 0.75rem. O quadradinho ao lado mostra como fica. Valor fora do formato impede de salvar.",
        print: "aparencia-2.webp",
        regiao: { x: 24.4, y: 69.1, l: 38.1, a: 30 },
        alt: "Campos de cantos pequenos, médios, grandes e maiores, cada um com um quadradinho de amostra.",
      },
      {
        titulo: "Toque em Salvar aparência",
        texto: "O botão só liga quando algo mudou e a legibilidade passou. Ao salvar, o site todo muda na hora. Voltar ao padrão da marca desfaz tudo e devolve as cores de fábrica.",
        print: "aparencia-2.webp",
        regiao: { x: 66.3, y: 95, l: 28.5, a: 4.5 },
        alt: "Botões Salvar aparência e Voltar ao padrão da marca.",
      },
    ],
  },
};
