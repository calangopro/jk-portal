import type { Tutorial } from "../tipos.ts";

export const grupo: Tutorial = {
  href: "/admin/grupo",
  resumo: "Troque o link do grupo de ofertas do WhatsApp, copie os links para divulgar e veja quem deixou o contato.",
  versoes: {
    todos: [
      {
        titulo: "Cole o link do grupo",
        texto: "Em Link do grupo, cole o convite do WhatsApp. Quando o grupo encher, troque só aqui: o anúncio, a bio e o QR das lojas continuam com o mesmo link.",
        print: "grupo-1.webp",
        regiao: { x: 25.7, y: 47, l: 35, a: 8.5 },
        alt: "Campo Link do grupo, com o convite de exemplo.",
      },
      {
        titulo: "Escolha o visual da página",
        texto: "Deixe em Acompanhar a campanha do dia para a página trocar de cor sozinha quando a campanha mudar. Se quiser um visual fixo, escolha na lista. Depois toque em Salvar.",
        print: "grupo-1.webp",
        regiao: { x: 25.7, y: 61, l: 35, a: 21 },
        alt: "Seletor Visual da página e botão Salvar.",
      },
      {
        titulo: "Copie o link certo para cada uso",
        texto: "A página do anúncio pede nome e WhatsApp e grava o contato. O link direto leva ao grupo sem cadastro, bom para QR e ManyChat. Toque em Copiar.",
        print: "grupo-1.webp",
        regiao: { x: 63, y: 38, l: 33.5, a: 33 },
        alt: "Dois links para divulgar, cada um com o botão Copiar.",
      },
      {
        titulo: "Leia os números dos últimos 30 dias",
        texto: "Os quatro cartões mostram quem deixou o contato, quem tocou no botão do grupo, quem não foi e quem entrou. Entrou só conta quando a ferramenta do grupo avisa.",
        print: "grupo-2.webp",
        regiao: { x: 24.4, y: 16.5, l: 73.1, a: 11.5 },
        alt: "Cartões com os números de contatos, cliques no grupo e entradas.",
      },
      {
        titulo: "Filtre os contatos e baixe a planilha",
        texto: "Toque em Não foi ao grupo para achar quem se cadastrou e parou no meio. Baixar planilha leva todos os contatos para o computador.",
        print: "grupo-2.webp",
        regiao: { x: 24.4, y: 39, l: 73.1, a: 10 },
        alt: "Filtros de contatos e o botão Baixar planilha.",
      },
      {
        titulo: "Confira os envios de cada contato",
        texto: "Na última coluna, cada destino mostra se o contato foi enviado, falhou ou está sem chave. Se falhou, aparece Tentar de novo embaixo.",
        print: "grupo-2.webp",
        regiao: { x: 77.3, y: 55, l: 20, a: 40 },
        alt: "Coluna Envios da lista de contatos, com o estado de cada destino.",
      },
    ],
  },
};
