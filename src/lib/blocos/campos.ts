import type { TipoDeBloco } from "./tipos";

/**
 * Descritores de campo por tipo de bloco.
 *
 * É daqui que o formulário do admin nasce. Sem isto, cada bloco novo exigiria
 * escrever uma tela nova, que é exatamente a dependência de desenvolvedor que
 * este projeto quer eliminar: criar bloco passa a ser declarar campos.
 */

export type TipoDeCampo = "texto" | "textoLongo" | "numero" | "listaDeTexto";

export type Campo = {
  nome: string;
  rotulo: string;
  tipo: TipoDeCampo;
  /** Explicação curta, para quem edita não precisar adivinhar o efeito. */
  ajuda?: string;
  /** Teto de caracteres, quando existe motivo editorial para limitar. */
  maximo?: number;
};

export type DefinicaoDeBloco = {
  nome: string;
  descricao: string;
  campos: Campo[];
};

export const BLOCOS: Record<TipoDeBloco, DefinicaoDeBloco> = {
  "hero-busca": {
    nome: "Abertura com busca",
    descricao: "Primeira tela: título, frase de apoio, campo de busca e os três atalhos flutuantes.",
    campos: [
      { nome: "eyebrow", rotulo: "Rótulo acima do título", tipo: "texto", maximo: 40 },
      { nome: "titulo", rotulo: "Título", tipo: "texto", ajuda: "É o H1 da home. Um só por página.", maximo: 70 },
      { nome: "lede", rotulo: "Frase de apoio", tipo: "textoLongo", maximo: 180 },
      { nome: "placeholder", rotulo: "Texto dentro do campo de busca", tipo: "texto", ajuda: "Curto: no celular, texto longo corta no meio.", maximo: 40 },
      { nome: "sugestoes", rotulo: "Sugestões de busca", tipo: "listaDeTexto", ajuda: "Uma por linha. Aparecem como etiquetas abaixo do campo." },
      { nome: "atalhoMedidorTitulo", rotulo: "Atalho do medidor: título", tipo: "texto", maximo: 30 },
      { nome: "atalhoMedidorApoio", rotulo: "Atalho do medidor: apoio", tipo: "textoLongo", maximo: 90 },
      { nome: "atalhoLojasTitulo", rotulo: "Atalho das lojas: título", tipo: "texto", maximo: 30 },
      { nome: "atalhoLojasApoio", rotulo: "Atalho das lojas: apoio", tipo: "textoLongo", maximo: 90 },
      { nome: "atalhoLojaTitulo", rotulo: "Atalho da loja oficial", tipo: "texto", maximo: 34 },
    ],
  },
  "ultimos-conteudos": {
    nome: "Últimos posts",
    descricao: "Grade com os posts mais recentes.",
    campos: [
      { nome: "titulo", rotulo: "Título da seção", tipo: "texto", maximo: 50 },
      { nome: "quantidade", rotulo: "Quantos posts mostrar", tipo: "numero", ajuda: "De 1 a 12. Múltiplos de 3 fecham a grade certinho." },
      { nome: "verTodos", rotulo: "Texto do link à direita", tipo: "texto", maximo: 30 },
    ],
  },
  vitrine: {
    nome: "Vitrine de produtos",
    descricao:
      "Carrossel com uma amostra do catálogo da Tray, sorteada a cada revalidação. Preço e estoque vêm da loja; aqui nada é editado.",
    campos: [
      { nome: "titulo", rotulo: "Título da seção", tipo: "texto", maximo: 50 },
      { nome: "subtitulo", rotulo: "Frase de apoio", tipo: "textoLongo", maximo: 140 },
      { nome: "quantidade", rotulo: "Quantos produtos", tipo: "numero", ajuda: "De 4 a 12." },
      { nome: "botao", rotulo: "Texto do link do produto", tipo: "texto", maximo: 20 },
    ],
  },
  trilhas: {
    nome: "Por onde começar",
    descricao: "Portas de entrada por assunto. Só aparecem os assuntos que já têm post publicado.",
    campos: [
      { nome: "titulo", rotulo: "Título da seção", tipo: "texto", maximo: 50 },
      { nome: "subtitulo", rotulo: "Frase de apoio", tipo: "textoLongo", maximo: 140 },
    ],
  },
  medidor: {
    nome: "Medidor de aliança",
    descricao: "Faixa em vidro destacando a ferramenta de medir o tamanho da aliança.",
    campos: [
      { nome: "titulo", rotulo: "Título", tipo: "texto", maximo: 70 },
      { nome: "texto", rotulo: "Texto", tipo: "textoLongo", maximo: 220 },
      { nome: "botao", rotulo: "Texto do botão", tipo: "texto", maximo: 24 },
    ],
  },
  lojas: {
    nome: "Lojas por cidade",
    descricao: "Etiquetas com as cidades que têm loja publicada.",
    campos: [
      { nome: "titulo", rotulo: "Título da seção", tipo: "texto", maximo: 50 },
      { nome: "subtitulo", rotulo: "Frase de apoio", tipo: "textoLongo", maximo: 140 },
    ],
  },
  prova: {
    nome: "Por que a JK",
    descricao:
      "Fábrica própria, número de lojas e anos de mercado. Os números saem dos fatos institucionais com fonte registrada, e não são editáveis aqui de propósito.",
    campos: [{ nome: "titulo", rotulo: "Rótulo da seção", tipo: "texto", maximo: 40 }],
  },
  cta: {
    nome: "Chamada final",
    descricao: "Faixa escura no fim da página.",
    campos: [
      { nome: "eyebrow", rotulo: "Rótulo", tipo: "texto", maximo: 30 },
      { nome: "titulo", rotulo: "Título", tipo: "texto", maximo: 70 },
      { nome: "texto", rotulo: "Texto", tipo: "textoLongo", maximo: 200 },
      { nome: "botao", rotulo: "Texto do botão", tipo: "texto", maximo: 24 },
    ],
  },
};
