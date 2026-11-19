import type { Passo, Tutorial } from "../tipos.ts";

const novo: Passo = {
  titulo: "Crie um conteúdo ou abra um da lista",
  texto: "Toque em Novo conteúdo e escolha um modelo: ele já traz a estrutura certa. Para continuar um texto, abra o post pela lista, que agrupa tudo por assunto.",
  print: "conteudos-1.webp",
  regiao: { x: 81, y: 18.6, l: 16.5, a: 6 },
  alt: "Botão Novo conteúdo no topo da lista de posts.",
};

const titulo: Passo = {
  titulo: "Escreva o título e a resposta rápida",
  texto: "O título é o que aparece maior na busca, até 60 caracteres. A resposta rápida vai no topo da página e responde a dúvida em 2 a 4 frases, sozinha, sem depender do resto.",
  print: "conteudos-2.webp",
  regiao: { x: 24.4, y: 26.5, l: 41.9, a: 61 },
  alt: "Campos Título da página e Resposta rápida do editor.",
};

const blocos: Passo = {
  titulo: "Monte o texto com blocos",
  texto: "Escreva no editor. O botão + acompanha a linha em que você está, e digitar / abre a mesma lista de blocos: subtítulos, listas, tabelas, perguntas frequentes e produtos da loja.",
  print: "conteudos-3.webp",
  regiao: { x: 26.6, y: 44, l: 37.5, a: 53 },
  alt: "Editor com um texto de exemplo e o botão + ao lado da linha.",
};

const fontes: Passo = {
  titulo: "Registre as fontes",
  texto: "Toda afirmação factual precisa de fonte. Busque um fato aprovado na base e clique nele: a frase entra no texto e a fonte é registrada. Sem pelo menos uma, o post não é publicado.",
  print: "conteudos-4.webp",
  regiao: { x: 24.4, y: 24, l: 41.9, a: 73 },
  alt: "Bloco Fontes, com a busca na base de fatos e uma fonte registrada.",
};

const analise: Passo = {
  titulo: "Confira o analisador",
  texto: "À direita, a nota de SEO, GEO e voz da marca vem com a lista do que resolver. Alguns erros em vermelho barram a publicação, e o amarelo é sugestão. Toque num item para a IA ajudar.",
  print: "conteudos-2.webp",
  regiao: { x: 70.4, y: 36, l: 28.6, a: 62 },
  alt: "Painel de análise com as notas e a lista de itens a resolver.",
};

export const conteudos: Tutorial = {
  href: "/admin/conteudos",
  resumo: "Os posts do site: a lista, o editor, as fontes, o analisador e a publicação.",
  versoes: {
    todos: [
      novo,
      titulo,
      blocos,
      fontes,
      analise,
      {
        titulo: "Publique ou agende",
        texto: "Com tudo certo, toque em Publicar, lá em cima. Para sair em outro dia, escolha a data e a hora em Publicar em outra hora e toque em Agendar. A hora vale para São Paulo.",
        print: "conteudos-5.webp",
        regiao: { x: 24.4, y: 43.8, l: 41.9, a: 37.7 },
        alt: "Bloco Publicar em outra hora, com o campo de data e hora e o botão Agendar.",
      },
    ],
    conteudo: [
      novo,
      titulo,
      blocos,
      fontes,
      analise,
      {
        titulo: "Salve e chame quem revisa",
        texto: "Toque em Salvar rascunho e use Ver preview para conferir a página como ela vai ao ar. Quando o texto estiver pronto, avise quem revisa antes de publicar. Publicar vai ao ar na hora, então só toque depois da conferência.",
        print: "conteudos-2.webp",
        regiao: { x: 24.4, y: 11.4, l: 41.9, a: 12 },
        alt: "Barra do editor com os botões Ver preview, Salvar rascunho e Publicar.",
      },
    ],
  },
};
