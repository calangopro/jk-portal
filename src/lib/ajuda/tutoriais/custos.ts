import type { Tutorial } from "../tipos.ts";

export const custos: Tutorial = {
  href: "/admin/custos",
  resumo: "O que a loja gasta para funcionar, com o comprovante de cada custo.",
  versoes: {
    todos: [
      {
        titulo: "Veja o custo do mês até hoje",
        texto: "Os quatro cartões mostram o que a loja gasta por mês, por pedido e até hoje, ao lado do que foi vendido no mesmo período.",
        print: "custos-1.webp",
        regiao: { x: 24.4, y: 35.2, l: 73.1, a: 23.7 },
        alt: "Quatro cartões: custo todo mês, custo a cada pedido, custo de novembro até hoje e vendido no mesmo período.",
      },
      {
        titulo: "Leia o aviso embaixo dos cartões",
        texto: "Ele diz quantos custos têm valor exato e quantos são estimativa. A conta ainda não tira o custo das peças, então o que sobra não é lucro.",
        print: "custos-1.webp",
        regiao: { x: 24.4, y: 60, l: 60, a: 19 },
        alt: "Texto sobre o que ainda falta na conta e quadro do anúncio no mês.",
      },
      {
        titulo: "Adicione um custo novo",
        texto: "Abra Adicionar um custo, escreva o que é, o valor, quando se paga e o grupo. Marque Valor exato só se tiver comprovante, e diga de onde veio o número.",
        print: "custos-2.webp",
        regiao: { x: 24.4, y: 82.9, l: 73.1, a: 17 },
        alt: "Bloco Adicionar um custo aberto, com o primeiro campo do formulário.",
      },
      {
        titulo: "Anexe o comprovante",
        texto: "Em cada custo, toque em Anexar comprovante e escolha o PDF ou a imagem. Depois ele abre por um link que vale uma hora.",
        print: "custos-3.webp",
        regiao: { x: 26, y: 34.9, l: 13.5, a: 3.8 },
        alt: "Botão Anexar comprovante no primeiro custo da lista.",
      },
      {
        titulo: "Altere ou desative um custo",
        texto: "Alterar abre o formulário do custo. Desativar tira da conta sem apagar nada, e você pode reativar depois.",
        print: "custos-3.webp",
        regiao: { x: 40.2, y: 34.9, l: 12.8, a: 3.8 },
        alt: "Botões Alterar e Desativar no primeiro custo da lista.",
      },
    ],
  },
};
