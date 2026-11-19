import type { Tutorial } from "../tipos.ts";

export const conector: Tutorial = {
  href: "/admin/conector",
  resumo: "Ligue o painel ao Claude, veja quem está ligado e acompanhe tudo o que ele fez.",
  versoes: {
    todos: [
      {
        titulo: "Ligue pelo claude.ai",
        texto: "Siga os três passos do quadro: abra Conectores em claude.ai, adicione um conector personalizado com o nome indicado e toque em Conectar. Na tela do Claude, escolha Permitir.",
        print: "conector-1.webp",
        regiao: { x: 25.5, y: 42.5, l: 35, a: 15.5 },
        alt: "Quadro No Claude com os três passos para ligar o conector.",
      },
      {
        titulo: "Copie o endereço do conector",
        texto: "O endereço fica logo abaixo dos passos. Toque em Copiar e cole no campo do claude.ai. Não precisa digitar nada.",
        print: "conector-1.webp",
        regiao: { x: 26, y: 61.5, l: 34, a: 8 },
        alt: "Caixa com o endereço do conector e o botão Copiar.",
      },
      {
        titulo: "Ou ligue pelo terminal",
        texto: "No Claude Code, copie o comando e rode no terminal. Se preferir uma chave fixa, dê um nome, escolha Ler e escrever ou Só ler e toque em Criar chave. A chave aparece uma vez só.",
        print: "conector-1.webp",
        regiao: { x: 63, y: 39, l: 35, a: 41 },
        alt: "Quadro No Claude Code, com o comando para copiar e o formulário de nova chave.",
      },
      {
        titulo: "Desligue um acesso",
        texto: "Na lista Acessos ligados, cada linha mostra quem ligou, o que pode fazer e o último uso. Toque em Desligar e o acesso é cortado na hora.",
        print: "conector-2.webp",
        regiao: { x: 24.4, y: 8, l: 74, a: 21.5 },
        alt: "Lista de acessos ligados, com o botão Desligar em cada linha.",
      },
      {
        titulo: "Acompanhe o que o Claude fez",
        texto: "A lista abaixo guarda cada operação, deu certo ou não. Quando falha, o motivo aparece em vermelho na coluna Resultado.",
        print: "conector-2.webp",
        regiao: { x: 24.4, y: 33, l: 74, a: 36 },
        alt: "Lista O que o Claude fez, com uma operação que falhou.",
      },
      {
        titulo: "Veja o que ele pode fazer",
        texto: "No fim da tela, as operações vêm agrupadas por área. As marcadas muda o site pedem o seu sim na conversa antes de rodar.",
        print: "conector-3.webp",
        regiao: { x: 24.4, y: 36, l: 74, a: 60 },
        alt: "Quadro O que o Claude pode fazer, com as áreas e a quantidade de operações.",
      },
    ],
  },
};
