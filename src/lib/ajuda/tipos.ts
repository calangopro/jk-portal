/**
 * Como usar: o que um tutorial é, em dado puro.
 *
 * Cada tela do painel pode ter um tutorial (`tutoriais/<tela>.ts`). Ele tem um
 * resumo de uma frase e uma lista curta de passos por GRUPO DE NÍVEL. A versão
 * `todos` serve a quem não tem versão própria; o grupo só ganha a dele quando a
 * tela muda para ele (o vendedor não vê o valor dos outros, o gerente marca
 * venda para outra pessoa). Arquivo puro: o teste (`npm run verificar:ajuda`)
 * e o player leem daqui.
 */

export const GRUPOS = ["diretoria", "gerente", "vendas", "fabrica", "trafego", "social_media", "conteudo"] as const;
export type GrupoDeNivel = (typeof GRUPOS)[number];

export const NOME_DO_GRUPO: Record<GrupoDeNivel, string> = {
  diretoria: "Diretoria",
  gerente: "Gerente",
  vendas: "Vendas",
  fabrica: "Fábrica",
  trafego: "Tráfego",
  social_media: "Social media",
  conteudo: "Conteúdo",
};

/** Retângulo em porcentagem do print: x e y do canto de cima à esquerda, l de largura e a de altura. */
export type Regiao = { x: number; y: number; l: number; a: number };

export type Passo = {
  /** Curto, no imperativo: "Toque em Fui eu que vendi". */
  titulo: string;
  /** Uma ou duas frases. No máximo 240 caracteres. */
  texto: string;
  /** Nome do arquivo em `public/ajuda/`, por exemplo `hoje-1.webp`. */
  print: string;
  /** A parte do print que o cursor e o anel mostram. */
  regiao: Regiao;
  /** Print de celular (390 x 844). Sem isso, o print é de computador (1280 x 800). */
  celular?: boolean;
  /** O que o print mostra, para leitor de tela. Sem isso, o player monta com o título. */
  alt?: string;
};

export type VersaoDoTutorial = Passo[];

export type Tutorial = {
  /** O `href` da tela em `setores.ts`. */
  href: string;
  /** Para que serve a tela, numa frase. */
  resumo: string;
  versoes: { todos: VersaoDoTutorial } & Partial<Record<GrupoDeNivel, VersaoDoTutorial>>;
};

export const TAMANHO_DO_PRINT = { computador: { l: 1280, a: 800 }, celular: { l: 390, a: 844 } } as const;
export const MAXIMO_DO_TEXTO = 240;
