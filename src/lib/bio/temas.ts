import type { CSSProperties } from "react";
import type { TemaDaBio } from "./tipos";

/**
 * Paleta de cada tema da bio, em variáveis CSS postas no contêiner da página.
 *
 * As cores de campanha são as do manual do tema da loja
 * (`jk-tema-loja/Esquenta/IDENTIDADE-ESQUENTA-BLACK.md`), com o contraste
 * conferido sobre o carvão real. Duas regras de lá que valem aqui também:
 *
 *   1. Sobre carvão, os dourados TROCAM de papel. `#BE9B60` vira texto
 *      aprovado (6,98:1) e o dourado escuro `#76582B`, que é o texto do tema
 *      claro, reprova (2,78:1). Por isso `--bio-acento` muda de tom por tema.
 *   2. Texto branco sobre dourado continua proibido (2,61:1). Botão dourado
 *      leva texto carvão.
 *
 * A foto do produto fica clara em todos os temas: "o escuro fica na moldura,
 * não na foto". Joia fotografada em fundo branco apaga sobre carvão.
 *
 * O Black sobe um degrau sobre o Esquenta, como na loja: linha mais forte,
 * dourado mais claro e o percentual em selo dourado sólido.
 *
 * Os três temas de data (aniversário, Natal e ano novo) são claros, porque a
 * festa pede luz, e cada um põe a cor no detalhe: vinho no aniversário, vinho
 * e verde sobre o areia da JK no Natal, dourado sobre branco no ano novo. O
 * enfeite que se mexe (confete, bolinha, chapéu) mora em `Enfeites.tsx`.
 * Contraste de cada par conferido em 24/09: o mais apertado é o texto de apoio
 * sobre o cartão areia do Natal, 5,18:1.
 */

type Paleta = {
  fundo: string;
  superficie: string;
  superficieAlta: string;
  texto: string;
  apoio: string;
  acento: string;
  linha: string;
  linhaForte: string;
  acao: string;
  acaoTexto: string;
  acaoRealce: string;
  selo: string;
  seloTexto: string;
  foto: string;
  /** Brilho atrás do título da oferta. Só nos temas escuros: no claro, a JK achou sujo. */
  brilho: string;
  erro: string;
  /** Bolinha do carrinho no cartão de produto, que fica sobre o rodapé desfocado da foto. */
  carrinho: string;
  carrinhoIcone: string;
  /** O cartão da oferta com contador: fundo, botão e caixas do relógio. */
  oferta: Oferta;
};

type Oferta = {
  fundo: string;
  borda: string;
  botao: string;
  botaoTexto: string;
  botaoBorda: string;
  botaoRealce: string;
  botaoTextoRealce: string;
  contador: string;
  contadorBorda: string;
  contadorDigito: string;
  contadorApoio: string;
};

const PALETAS: Record<TemaDaBio, Paleta> = {
  padrao: {
    fundo: "#F7F3EC",
    superficie: "#FFFFFF",
    superficieAlta: "#FBFAF8",
    texto: "#171512",
    apoio: "#5F594F",
    acento: "#76582B",
    linha: "#E8E2D8",
    linhaForte: "rgba(118, 88, 43, 0.35)",
    // Carvão na ação principal: sobre marfim, o dourado cheio some como botão.
    acao: "#1A1815",
    acaoTexto: "#F7F3EC",
    acaoRealce: "#2A2620",
    // Bordô para o desconto, que é o acento de destaque da marca no claro.
    selo: "#7A2230",
    seloTexto: "#FFFFFF",
    foto: "#FFFFFF",
    brilho: "transparent",
    erro: "#9B1C1C",
    carrinho: "#FFFFFF",
    carrinhoIcone: "#171512",
    oferta: {
      fundo: "#FFFFFF",
      borda: "rgba(118, 88, 43, 0.35)",
      botao: "transparent",
      botaoTexto: "#171512",
      botaoBorda: "#76582B",
      botaoRealce: "#76582B",
      botaoTextoRealce: "#F7F3EC",
      contador: "#FBFAF8",
      contadorBorda: "#E8E2D8",
      contadorDigito: "#171512",
      contadorApoio: "#5F594F",
    },
  },
  esquenta: {
    fundo: "#171512",
    superficie: "#1D1B18",
    superficieAlta: "#24211C",
    texto: "#F7EFDF",
    apoio: "#A79E92",
    acento: "#CFA55E",
    linha: "rgba(190, 155, 96, 0.28)",
    linhaForte: "rgba(190, 155, 96, 0.52)",
    acao: "#BE9B60",
    acaoTexto: "#171512",
    acaoRealce: "#CFA55E",
    // O selo fica POR CIMA da foto, que é branca. Precisa ser opaco: dourado
    // translúcido sobre branco some.
    selo: "#171512",
    seloTexto: "#E3CB9C",
    foto: "#FFFFFF",
    brilho: "rgba(207, 165, 94, 0.18)",
    erro: "#F2A7A7",
    carrinho: "#BE9B60",
    carrinhoIcone: "#171512",
    oferta: {
      fundo: "#1D1B18",
      borda: "rgba(190, 155, 96, 0.52)",
      botao: "transparent",
      botaoTexto: "#F7EFDF",
      botaoBorda: "#CFA55E",
      botaoRealce: "#CFA55E",
      botaoTextoRealce: "#171512",
      contador: "#24211C",
      contadorBorda: "rgba(190, 155, 96, 0.28)",
      contadorDigito: "#E3CB9C",
      contadorApoio: "#A79E92",
    },
  },
  black: {
    fundo: "#171512",
    superficie: "#1D1B18",
    superficieAlta: "#2A2620",
    texto: "#F7EFDF",
    apoio: "#A79E92",
    acento: "#E3CB9C",
    linha: "rgba(190, 155, 96, 0.4)",
    linhaForte: "rgba(190, 155, 96, 0.7)",
    acao: "#CFA55E",
    acaoTexto: "#171512",
    acaoRealce: "#E3CB9C",
    selo: "#BE9B60",
    seloTexto: "#171512",
    foto: "#FFFFFF",
    brilho: "rgba(207, 165, 94, 0.26)",
    erro: "#F2A7A7",
    carrinho: "#E3CB9C",
    carrinhoIcone: "#171512",
    oferta: {
      fundo: "#1D1B18",
      borda: "rgba(190, 155, 96, 0.7)",
      botao: "transparent",
      botaoTexto: "#F7EFDF",
      botaoBorda: "#E3CB9C",
      botaoRealce: "#E3CB9C",
      botaoTextoRealce: "#171512",
      contador: "#2A2620",
      contadorBorda: "rgba(190, 155, 96, 0.4)",
      contadorDigito: "#E3CB9C",
      contadorApoio: "#A79E92",
    },
  },
  aniversario: {
    fundo: "#F9F3F0",
    superficie: "#FFFFFF",
    superficieAlta: "#FCF7F5",
    texto: "#171512",
    apoio: "#5F594F",
    acento: "#7A2230",
    linha: "#EEDFDA",
    linhaForte: "rgba(122, 34, 48, 0.32)",
    acao: "#7A2230",
    acaoTexto: "#FFFFFF",
    acaoRealce: "#5C1922",
    selo: "#7A2230",
    seloTexto: "#FFFFFF",
    foto: "#FFFFFF",
    brilho: "transparent",
    erro: "#9B1C1C",
    carrinho: "#7A2230",
    carrinhoIcone: "#FFFFFF",
    // Cartão rosado com fita de presente (`Enfeites.tsx`), botão vinho cheio e
    // o relógio em caixas vinho: o aniversário é a campanha do vinho.
    oferta: {
      fundo: "#F5E6E2",
      borda: "rgba(122, 34, 48, 0.25)",
      botao: "#7A2230",
      botaoTexto: "#FFFFFF",
      botaoBorda: "#7A2230",
      botaoRealce: "#5C1922",
      botaoTextoRealce: "#FFFFFF",
      contador: "#7A2230",
      contadorBorda: "#7A2230",
      contadorDigito: "#FFFFFF",
      contadorApoio: "rgba(255, 255, 255, 0.85)",
    },
  },
  natal: {
    // O areia da JK (`--color-sand`) no fundo, vinho na ação e verde no
    // detalhe. Verde e vinho juntos em área grande viram enfeite de loja de
    // departamento; em ponto pequeno, viram Natal com cara de joalheria.
    fundo: "#F4ECE0",
    superficie: "#FFFDF9",
    superficieAlta: "#FAF5EC",
    texto: "#171512",
    apoio: "#5F594F",
    acento: "#1F4D36",
    linha: "#E4D6C1",
    linhaForte: "rgba(31, 77, 54, 0.32)",
    acao: "#7A2230",
    acaoTexto: "#FFFFFF",
    acaoRealce: "#5C1922",
    selo: "#1F4D36",
    seloTexto: "#FFFFFF",
    foto: "#FFFFFF",
    brilho: "transparent",
    erro: "#9B1C1C",
    carrinho: "#1F4D36",
    carrinhoIcone: "#FFFFFF",
    // Cartão em areia sólido, um tom mais quente que a página para se
    // destacar. Pedido da JK em 24/09: o cartão de vidro saía esbranquiçado,
    // com um brilho verde no topo, e ficou "feio pra porra". Botão verde cheio
    // e relógio em caixas vinho.
    oferta: {
      fundo: "#EBDDC6",
      borda: "rgba(31, 77, 54, 0.25)",
      botao: "#1F4D36",
      botaoTexto: "#FFFFFF",
      botaoBorda: "#1F4D36",
      botaoRealce: "#173B29",
      botaoTextoRealce: "#FFFFFF",
      contador: "#7A2230",
      contadorBorda: "#7A2230",
      contadorDigito: "#FFFFFF",
      contadorApoio: "rgba(255, 255, 255, 0.85)",
    },
  },
  anonovo: {
    // Branco quente e dourado. A ação fica em carvão pelo mesmo motivo do tema
    // padrão: dourado cheio sobre fundo claro some como botão.
    fundo: "#FBF8F2",
    superficie: "#FFFFFF",
    superficieAlta: "#FDFBF7",
    texto: "#171512",
    apoio: "#5F594F",
    acento: "#76582B",
    linha: "#EFE6D6",
    linhaForte: "rgba(190, 155, 96, 0.45)",
    acao: "#1A1815",
    acaoTexto: "#F7EFDF",
    acaoRealce: "#2A2620",
    selo: "#171512",
    seloTexto: "#E3CB9C",
    foto: "#FFFFFF",
    brilho: "transparent",
    erro: "#9B1C1C",
    carrinho: "#BE9B60",
    carrinhoIcone: "#171512",
    // A mesma ideia do Natal, no dourado: cartão areia dourado, botão dourado
    // com borda escura (sem ela o botão some no cartão, 2,11:1) e relógio em
    // carvão com o número dourado, como convite de réveillon.
    oferta: {
      fundo: "#F2E6CC",
      borda: "rgba(190, 155, 96, 0.55)",
      botao: "#BE9B60",
      botaoTexto: "#171512",
      botaoBorda: "#84663C",
      botaoRealce: "#D8B877",
      botaoTextoRealce: "#171512",
      contador: "#1A1815",
      contadorBorda: "#1A1815",
      contadorDigito: "#E3CB9C",
      contadorApoio: "#CBBFAE",
    },
  },
};

export function variaveisDoTema(tema: TemaDaBio): CSSProperties {
  const p = PALETAS[tema];
  return {
    "--bio-fundo": p.fundo,
    "--bio-superficie": p.superficie,
    "--bio-superficie-alta": p.superficieAlta,
    "--bio-texto": p.texto,
    "--bio-apoio": p.apoio,
    "--bio-acento": p.acento,
    "--bio-linha": p.linha,
    "--bio-linha-forte": p.linhaForte,
    "--bio-acao": p.acao,
    "--bio-acao-texto": p.acaoTexto,
    "--bio-acao-realce": p.acaoRealce,
    "--bio-selo": p.selo,
    "--bio-selo-texto": p.seloTexto,
    "--bio-foto": p.foto,
    "--bio-brilho": p.brilho,
    "--bio-erro": p.erro,
    "--bio-carrinho": p.carrinho,
    "--bio-carrinho-icone": p.carrinhoIcone,
    "--bio-oferta-fundo": p.oferta.fundo,
    "--bio-oferta-borda": p.oferta.borda,
    "--bio-oferta-botao": p.oferta.botao,
    "--bio-oferta-botao-texto": p.oferta.botaoTexto,
    "--bio-oferta-botao-borda": p.oferta.botaoBorda,
    "--bio-oferta-botao-realce": p.oferta.botaoRealce,
    "--bio-oferta-botao-texto-realce": p.oferta.botaoTextoRealce,
    "--bio-contador-fundo": p.oferta.contador,
    "--bio-contador-borda": p.oferta.contadorBorda,
    "--bio-digito": p.oferta.contadorDigito,
    "--bio-contador-apoio": p.oferta.contadorApoio,
  } as CSSProperties;
}

/** Cor da barra do navegador, que no Instagram é a moldura da página. */
export function corDaBarra(tema: TemaDaBio): string {
  return PALETAS[tema].fundo;
}

export function temaEscuro(tema: TemaDaBio): boolean {
  return tema === "esquenta" || tema === "black";
}
