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
  digito: string;
  foto: string;
  brilho: string;
  erro: string;
  /** Bolinha do carrinho no cartão de produto, que fica sobre o escurecido da foto. */
  carrinho: string;
  carrinhoIcone: string;
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
    digito: "#171512",
    foto: "#FFFFFF",
    brilho: "rgba(216, 184, 119, 0.28)",
    erro: "#9B1C1C",
    carrinho: "#FFFFFF",
    carrinhoIcone: "#171512",
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
    digito: "#E3CB9C",
    foto: "#FFFFFF",
    brilho: "rgba(207, 165, 94, 0.18)",
    erro: "#F2A7A7",
    carrinho: "#BE9B60",
    carrinhoIcone: "#171512",
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
    digito: "#E3CB9C",
    foto: "#FFFFFF",
    brilho: "rgba(207, 165, 94, 0.26)",
    erro: "#F2A7A7",
    carrinho: "#E3CB9C",
    carrinhoIcone: "#171512",
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
    "--bio-digito": p.digito,
    "--bio-foto": p.foto,
    "--bio-brilho": p.brilho,
    "--bio-erro": p.erro,
    "--bio-carrinho": p.carrinho,
    "--bio-carrinho-icone": p.carrinhoIcone,
  } as CSSProperties;
}

/** Cor da barra do navegador, que no Instagram é a moldura da página. */
export function corDaBarra(tema: TemaDaBio): string {
  return PALETAS[tema].fundo;
}

export function temaEscuro(tema: TemaDaBio): boolean {
  return tema !== "padrao";
}
