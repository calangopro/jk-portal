import type { Tutorial } from "../tipos.ts";

export const integracoes: Tutorial = {
  href: "/admin/integracoes",
  resumo: "Ligue o painel às ferramentas de medição, de anúncio e de contato, sem mostrar chave nenhuma na tela.",
  versoes: {
    todos: [
      {
        titulo: "Cole o ID e conecte",
        texto: "Cada cartão de cima é uma ligação de medição. Cole o ID no campo, como no exemplo cinza, e toque em Conectar.",
        print: "integracoes-1.webp",
        regiao: { x: 24.4, y: 35, l: 36, a: 42 },
        alt: "Cartão de uma ferramenta de medição desconectada, com o campo do ID e o botão Conectar.",
      },
      {
        titulo: "Confira o selo do cartão",
        texto: "O selo no canto diz se a ligação está Conectada ou Desconectada. Depois de conectar, volte aqui para ver se o selo mudou.",
        print: "integracoes-1.webp",
        regiao: { x: 49, y: 37, l: 11.5, a: 4 },
        alt: "Selo Desconectado no canto de um cartão.",
      },
      {
        titulo: "Troque o valor ou desconecte",
        texto: "Num cartão conectado, mude o valor e toque em Salvar. Para tirar a ligação do ar, toque em Desconectar.",
        print: "integracoes-1.webp",
        regiao: { x: 63.4, y: 63.5, l: 16, a: 5.5 },
        alt: "Botões Salvar e Desconectar de um cartão conectado.",
      },
      {
        titulo: "Cole a chave de um destino",
        texto: "Nos destinos dos contatos, cole a chave no campo e toque em Salvar. A tela confere a chave antes de gravar, e ela nunca volta para a tela.",
        print: "integracoes-2.webp",
        regiao: { x: 25.5, y: 62, l: 34, a: 19 },
        alt: "Cartão de um destino sem chave, com o campo de chave e o botão Salvar.",
      },
      {
        titulo: "Deixe em branco para manter",
        texto: "Em destino já ligado, o campo nasce vazio de propósito. Vazio quer dizer manter a chave que está salva. Remover chave desliga o destino.",
        print: "integracoes-2.webp",
        regiao: { x: 63, y: 62, l: 34, a: 19 },
        alt: "Cartão de um destino ligado, com o campo vazio e os botões Salvar e Remover chave.",
      },
      {
        titulo: "Envie os contatos guardados",
        texto: "Contato que chegou antes da chave, ou que falhou, fica guardado. Depois de colar a chave, toque em Enviar os guardados e eles seguem para o destino.",
        print: "integracoes-2.webp",
        regiao: { x: 63, y: 84, l: 34, a: 9.5 },
        alt: "Aviso de contatos guardados e o botão Enviar os 5 guardados.",
      },
    ],
  },
};
