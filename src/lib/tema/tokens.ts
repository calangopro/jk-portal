/**
 * Quais tokens o admin pode editar, e o que cada um significa em português.
 *
 * REGRA QUE CUSTA CARO ESQUECER: esta lista NÃO pode ser deduzida lendo o
 * `@theme` do globals.css. O Tailwind v4 remove do `:root` final todo token que
 * nenhuma utilidade consome, e hoje `--color-header`, `--color-surface`,
 * `--color-surface-alt`, `--color-glow` e `--color-wine-soft` estão declarados
 * lá e simplesmente não existem no CSS servido. Oferecer um deles no painel
 * seria entregar um controle que não muda nada na tela.
 *
 * Por isso a lista é escrita à mão aqui e conferida por `verificarTokens()`
 * (src/lib/tema/verificar.ts), que lê o CSS gerado e falha se algum token
 * desta lista tiver sumido.
 */

export type GrupoDeToken = "acao" | "texto" | "superficie";

export const GRUPOS: Record<GrupoDeToken, string> = {
  acao: "Ação e destaque",
  texto: "Texto",
  superficie: "Fundo e borda",
};

export type TokenDeCor = {
  /** Nome sem prefixo. `brand` vira `--color-brand` e a classe `bg-brand`. */
  nome: string;
  rotulo: string;
  ajuda: string;
  grupo: GrupoDeToken;
  padrao: string;
};

export const TOKENS_DE_COR: TokenDeCor[] = [
  {
    nome: "brand",
    rotulo: "Cor de ação",
    ajuda: "O dourado da marca. Pinta o botão principal, ícones e destaques.",
    grupo: "acao",
    padrao: "#be9b60",
  },
  {
    nome: "brand-light",
    rotulo: "Ação clara",
    ajuda: "Versão luminosa, usada no hover do botão e em detalhes sobre fundo escuro.",
    grupo: "acao",
    padrao: "#d8b877",
  },
  {
    nome: "brand-nav",
    rotulo: "Dourado de texto",
    ajuda:
      "Usado quando o dourado precisa virar TEXTO (rótulos, links, menu). Por ser texto pequeno, é o token que mais reprova no contraste.",
    grupo: "texto",
    padrao: "#84663c",
  },
  {
    nome: "brand-strong",
    rotulo: "Dourado escuro",
    ajuda: "Dourado mais fechado, para texto que precisa de contraste maior sobre fundo claro.",
    grupo: "texto",
    padrao: "#76582b",
  },
  {
    nome: "wine",
    rotulo: "Vinho",
    ajuda: "Acento romântico da marca. Aparece em faixas de destaque e no botão secundário.",
    grupo: "acao",
    padrao: "#7a2230",
  },
  {
    nome: "wine-deep",
    rotulo: "Vinho escuro",
    ajuda: "Fecho do vinho, para hover e para o fundo dos painéis escuros.",
    grupo: "acao",
    padrao: "#5c1922",
  },
  {
    nome: "background",
    rotulo: "Fundo da página",
    ajuda: "O marfim que sustenta o site inteiro. Mexer aqui muda a temperatura de tudo.",
    grupo: "superficie",
    padrao: "#f7f3ec",
  },
  {
    nome: "foreground",
    rotulo: "Texto principal",
    ajuda: "Cor do texto corrido. É o par de contraste mais importante do site.",
    grupo: "texto",
    padrao: "#141414",
  },
  {
    nome: "ink",
    rotulo: "Título",
    ajuda: "Tinta dos títulos, e do texto que fica em cima do botão dourado.",
    grupo: "texto",
    padrao: "#171512",
  },
  {
    nome: "muted",
    rotulo: "Texto de apoio",
    ajuda: "Legenda, data, tempo de leitura. Precisa continuar legível, não é decoração.",
    grupo: "texto",
    padrao: "#5f594f",
  },
  {
    nome: "charcoal",
    rotulo: "Painel escuro",
    ajuda: "Fundo das faixas escuras e do modo de medição.",
    grupo: "superficie",
    padrao: "#1a1815",
  },
  {
    nome: "border",
    rotulo: "Borda",
    ajuda: "Linha fina entre blocos. Quente e discreta, nunca cinza puro.",
    grupo: "superficie",
    padrao: "#e8e2d8",
  },
];

/**
 * Tokens que também precisam sair como triplete RGB.
 *
 * O CSS aplica alfa sobre eles (`rgb(var(--jk-brand-rgb) / 0.24)`) em vidro,
 * sombra, borda e gradiente. Gravar só o hex deixaria essas partes na cor
 * antiga, e o site sairia metade de uma cor e metade de outra.
 */
export const TRIPLETES: Record<string, string> = {
  brand: "--jk-brand-rgb",
  "brand-light": "--jk-brand-light-rgb",
  wine: "--jk-wine-rgb",
  background: "--jk-bg-rgb",
};

export type TokenDeRaio = { nome: string; rotulo: string; ajuda: string; padrao: string };

export const TOKENS_DE_RAIO: TokenDeRaio[] = [
  { nome: "sm", rotulo: "Cantos pequenos", ajuda: "Campos, botões e etiquetas.", padrao: "10px" },
  { nome: "md", rotulo: "Cantos médios", ajuda: "Imagem de produto e miniaturas.", padrao: "14px" },
  { nome: "lg", rotulo: "Cantos grandes", ajuda: "Cartões de conteúdo.", padrao: "20px" },
  { nome: "xl", rotulo: "Cantos maiores", ajuda: "Painéis largos e faixas de destaque.", padrao: "28px" },
];

/**
 * Combinações de cor que existem de verdade na tela, para o aviso de contraste.
 *
 * Não é uma matriz de todos contra todos: são os pares que o site realmente
 * usa. Avisar sobre combinação que nunca aparece só ensina a pessoa a ignorar
 * o aviso.
 */
export type ParDeContraste = {
  frente: string;
  fundo: string;
  onde: string;
  /** Texto grande basta 3:1 (título a partir de 24px, ou 18,66px em negrito). */
  textoGrande?: boolean;
};

export const PARES_DE_CONTRASTE: ParDeContraste[] = [
  { frente: "foreground", fundo: "background", onde: "Texto corrido na página" },
  { frente: "ink", fundo: "background", onde: "Títulos", textoGrande: true },
  { frente: "muted", fundo: "background", onde: "Legenda, data e tempo de leitura" },
  { frente: "brand-nav", fundo: "background", onde: "Rótulo dourado e link do menu" },
  { frente: "brand-strong", fundo: "background", onde: "Dourado escuro sobre a página" },
  { frente: "ink", fundo: "brand", onde: "Texto dentro do botão dourado" },
  { frente: "brand-light", fundo: "charcoal", onde: "Dourado sobre a faixa escura" },
  { frente: "brand-light", fundo: "wine-deep", onde: "Dourado sobre o painel vinho" },
];

/** Paleta da marca, fixada no topo do seletor (exigência do REGRAS.md §4). */
export const PALETA_DA_MARCA: { hex: string; nome: string }[] = [
  { hex: "#be9b60", nome: "Dourado" },
  { hex: "#d8b877", nome: "Dourado claro" },
  { hex: "#84663c", nome: "Dourado de texto" },
  { hex: "#76582b", nome: "Dourado escuro" },
  { hex: "#7a2230", nome: "Bordô" },
  { hex: "#5c1922", nome: "Bordô escuro" },
  { hex: "#1a1815", nome: "Carvão" },
  { hex: "#f7f3ec", nome: "Marfim" },
  { hex: "#e8e2d8", nome: "Borda" },
  { hex: "#ffffff", nome: "Branco" },
];
