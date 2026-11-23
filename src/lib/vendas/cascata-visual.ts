import type { CSSProperties } from "react";
import type { OrigemDoNumero, TipoDaLinha } from "./cascata";

/**
 * Como a cascata se desenha (cartão 80), num lugar só para a gaveta do pedido e a
 * tela de Vendas ficarem iguais. Nenhuma cor é verde nem vermelha: essas ficam
 * para bom e ruim (`COR_DO_TOM`). A cor também não é o único sinal: o que é
 * estimativa vem hachurado, o que falta vem tracejado, e todo valor vem escrito.
 */

export const COR_DA_CASCATA: Record<TipoDaLinha | "sobra", string> = {
  taxa: "#2f5d8a",
  imposto: "#7a6ab0",
  custo: "#9a6b1f",
  frete: "#4b8a96",
  embalagem: "#a4617a",
  anuncio: "#5d6b7a",
  sobra: "#1b1b1b",
};

/** Cheio quando exato, hachurado quando média ou estimado, vazio e tracejado quando falta. */
export function preenchimentoDaCascata(cor: string, origem: OrigemDoNumero): CSSProperties {
  if (origem === "real") return { background: cor };
  if (origem === "estimado" || origem === "media") return { backgroundImage: `repeating-linear-gradient(135deg, ${cor} 0 3px, rgba(255,255,255,0.55) 3px 6px)`, backgroundColor: cor };
  return { background: "transparent", border: `1.5px dashed ${cor}` };
}

export const ROTULO_DA_LINHA: Record<TipoDaLinha, string> = {
  taxa: "Taxa da Appmax",
  imposto: "Imposto",
  custo: "Custo das peças",
  frete: "Frete",
  embalagem: "Embalagem e brinde",
  anuncio: "Anúncio",
};
