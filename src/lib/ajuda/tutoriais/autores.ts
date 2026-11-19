import type { Tutorial } from "../tipos.ts";

export const autores: Tutorial = {
  href: "/admin/autores",
  resumo: "Cadastre quem assina e quem revisa os posts. Cada pessoa ganha uma página própria no site.",
  versoes: {
    todos: [
      {
        titulo: "Veja quem está sem credencial",
        texto: "O aviso no topo conta as pessoas ativas que ainda não têm credencial. É a credencial que explica por que aquela assinatura vale, e o Google gosta de ver isso.",
        print: "autores-1.webp",
        regiao: { x: 24.4, y: 34.2, l: 73.1, a: 6.8 },
        alt: "Aviso dizendo que uma pessoa ativa está sem credencial preenchida.",
      },
      {
        titulo: "Cadastre quem assina",
        texto: "Preencha o nome, o cargo e a credencial da pessoa. Escreva só o que é verdade: nunca invente formação nem tempo de casa. O endereço da página sai do nome se você deixar em branco.",
        print: "autores-1.webp",
        regiao: { x: 24.4, y: 51, l: 73.1, a: 30 },
        alt: "Campos de nome, endereço da página, cargo e credencial do formulário Cadastrar pessoa.",
      },
      {
        titulo: "Abra a pessoa para editar",
        texto: "Na lista Cadastradas, toque no nome para abrir o cadastro. Quem está sem credencial aparece marcado, e quem foi desativada também.",
        print: "autores-2.webp",
        regiao: { x: 24.4, y: 13, l: 73.1, a: 8.5 },
        alt: "Linha de uma pessoa cadastrada, com cargo e quantidade de conteúdos.",
      },
      {
        titulo: "Complete a credencial e a apresentação",
        texto: "Escreva o que sustenta a assinatura e uma apresentação curta, que aparece na página da pessoa e na busca. Perfis públicos entram um por linha, só os reais.",
        print: "autores-2.webp",
        regiao: { x: 26.3, y: 40, l: 70.6, a: 36 },
        alt: "Campos de cargo, credencial e apresentação de uma pessoa aberta para edição.",
      },
      {
        titulo: "Salve, confira a página ou desative",
        texto: "Toque em Salvar alterações. Use Ver a página no site para conferir como a pessoa aparece, e Desativar se ela deixar de assinar. Desativar não apaga os posts dela.",
        print: "autores-3.webp",
        regiao: { x: 26.3, y: 60, l: 70, a: 19 },
        alt: "Botão Salvar alterações e os links Ver a página no site e Desativar.",
      },
    ],
  },
};
