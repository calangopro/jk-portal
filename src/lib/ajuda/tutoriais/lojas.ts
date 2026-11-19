import type { Tutorial } from "../tipos.ts";

export const lojas: Tutorial = {
  href: "/admin/lojas",
  resumo: "Cuide da página de cada loja física: veja o que falta, edite os dados e ponha no ar ou tire do ar.",
  versoes: {
    todos: [
      {
        titulo: "Veja cada loja e se ela está no ar",
        texto: "Cada cartão é uma loja física, com o endereço e o caminho da página. A etiqueta da direita diz se está No ar, em Rascunho, Em revisão ou Arquivada.",
        print: "lojas-1.webp",
        regiao: { x: 24.4, y: 35.2, l: 73.1, a: 20 },
        alt: "Cartão da Loja Exemplo Um, com endereço, caminho da página e a etiqueta No ar.",
      },
      {
        titulo: "Leia o aviso do que falta",
        texto: "Em amarelo a tela diz o que ainda não foi preenchido: endereço, cidade, telefone ou mapa. Sem endereço e cidade a loja não pode ir ao ar, para não publicar um dado errado.",
        print: "lojas-1.webp",
        regiao: { x: 24.4, y: 79, l: 73.1, a: 21 },
        alt: "Cartão de uma loja em rascunho com o aviso Falta endereço, cidade, telefone, mapa.",
      },
      {
        titulo: "Toque em Editar para mexer nos dados",
        texto: "Editar abre a página da loja com endereço, telefone, horário de funcionamento e fotos. Lembre que endereço e telefone precisam ser iguais aos do Google Meu Negócio.",
        print: "lojas-1.webp",
        regiao: { x: 25.8, y: 48.5, l: 19, a: 4.5 },
        alt: "Botões Editar, Ver e Tirar do ar de uma loja.",
      },
      {
        titulo: "Ponha no ar ou tire do ar",
        texto: "Toque em Publicar para a página aparecer no site, ou em Tirar do ar para voltar a rascunho. O botão Ver abre a página pública da loja em outra aba.",
        print: "lojas-1.webp",
        regiao: { x: 25.8, y: 48.5, l: 19, a: 4.5 },
        alt: "Botões Ver e Tirar do ar de uma loja que está no ar.",
      },
      {
        titulo: "Cadastre uma loja nova",
        texto: "Toque em Nova loja. O painel cria um rascunho e já abre a página de edição para você preencher. Ela só vai ao ar quando você tocar em Publicar.",
        print: "lojas-1.webp",
        regiao: { x: 88, y: 25.2, l: 9.5, a: 6 },
        alt: "Botão Nova loja no canto superior direito da tela.",
      },
    ],
  },
};
