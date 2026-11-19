import type { Tutorial } from "../tipos.ts";

const nova = {
  titulo: "Crie a campanha",
  texto: "Escreva o nome, o dia em que começa e o dia em que termina, e toque em Criar campanha. Ela nasce como rascunho e aparece na lista com a situação ao lado.",
  print: "campanhas-1.webp",
  regiao: { x: 24.4, y: 35.2, l: 73.1, a: 12.8 },
  alt: "Formulário de nova campanha com nome, datas e o botão Criar campanha.",
};
const abrir = {
  titulo: "Abra a campanha na lista",
  texto: "Toque no nome da campanha. A etiqueta vermelha avisa quantos produtos ficam abaixo da margem mínima ou sem custo cadastrado. A etiqueta da direita diz em que etapa ela está.",
  print: "campanhas-1.webp",
  regiao: { x: 24.4, y: 50.8, l: 73.1, a: 11.6 },
  alt: "Campanha Black Friday Exemplo na lista, com o aviso de margem e a situação Esperando aprovação.",
};
const montar = {
  titulo: "Dê o desconto aos produtos",
  texto: "Escreva uma porcentagem em Desconto para todos e toque em Aplicar a todos. Para uma peça só, mude o desconto ou o preço na linha dela. Os preços sempre terminam em ,90.",
  print: "campanhas-2.webp",
  regiao: { x: 24.4, y: 57.2, l: 73.1, a: 34 },
  alt: "Campo Desconto para todos, botão Aplicar a todos e a tabela de produtos da campanha.",
};
const adicionar = {
  titulo: "Adicione mais produtos",
  texto: "Mais abaixo, busque pelo nome ou pelo código, marque as peças e adicione com o desconto escolhido. Para tirar uma peça, toque na lixeira da linha dela.",
  print: "campanhas-3.webp",
  regiao: { x: 24.4, y: 70, l: 73.1, a: 30 },
  alt: "Bloco Adicionar produtos com busca e lista de peças para marcar.",
};
const conferir = {
  titulo: "Confira a situação de cada peça",
  texto: "A coluna Situação diz Dentro quando o desconto cabe na margem e Passa do limite quando não cabe. Resolva as que passam antes de mandar, subindo o preço ou baixando o desconto.",
  print: "campanhas-2.webp",
  regiao: { x: 24.5, y: 65.3, l: 73, a: 26.4 },
  alt: "Tabela da campanha com as situações Dentro e Passa do limite.",
};
const mandar = {
  titulo: "Mande para aprovação",
  texto: "Com os preços prontos, toque em Mandar para aprovação. A campanha passa a Esperando aprovação e a diretoria decide. Até lá, você pode voltar para rascunho se precisar mexer.",
  print: "campanhas-2.webp",
  regiao: { x: 24.4, y: 44.5, l: 73.1, a: 10 },
  alt: "Quadro com o botão Mandar para aprovação.",
};

export const campanhas: Tutorial = {
  href: "/admin/campanhas",
  resumo: "Monte descontos por produto, confira a margem e mande a campanha para aprovação.",
  versoes: {
    todos: [nova, abrir, montar, adicionar, conferir, mandar],
    diretoria: [
      nova,
      montar,
      conferir,
      mandar,
      {
        titulo: "Leia o aviso de margem antes de aprovar",
        texto: "Quando a campanha chega para aprovar, o painel diz quantos produtos ficam abaixo da margem mínima ou sem custo. A tabela mostra a margem, o desconto máximo e quanto cada venda aguenta de anúncio.",
        print: "campanhas-4.webp",
        regiao: { x: 24.4, y: 44, l: 73.1, a: 13 },
        alt: "Quadro de aprovação com o aviso de um produto abaixo da margem mínima.",
      },
      {
        titulo: "Aprove ou devolva com uma nota",
        texto: "Toque em Aprovar para liberar a campanha. Se algum produto passa do limite, escreva o porquê na nota para poder aprovar. Para pedir ajuste, escreva o que mudar e toque em Devolver para ajuste.",
        print: "campanhas-4.webp",
        regiao: { x: 26, y: 54.6, l: 69.8, a: 16 },
        alt: "Campo de nota com os botões Aprovar e Devolver para ajuste.",
      },
    ],
  },
};
