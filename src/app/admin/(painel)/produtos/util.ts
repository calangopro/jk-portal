import type { Material } from "@/lib/margem/calculo";

/** Peças pequenas que a lista e a gaveta usam. */

export const reais = (n: number | null) =>
  n === null ? "sem preço" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Ignora o atalho de teclado quando a pessoa está digitando. */
export function digitando(e: KeyboardEvent) {
  const alvo = e.target as HTMLElement | null;
  return Boolean(alvo?.closest("input, textarea, select, [contenteditable=true]"));
}

/**
 * A margem de um produto como a lista e a gaveta precisam. Só chega ao
 * navegador de administrador: para os outros, a página nem calcula.
 */
export type MargemNaLista = {
  custo: number | null;
  detalhe: string | null;
  falta: string | null;
  reais: number | null;
  fracao: number | null;
  descontoMaximo: number | null;
  abaixo: boolean;
  descontoHoje: number | null;
  fracaoHoje: number | null;
  hojePassa: boolean;
  material: Material | null;
  familia: string | null;
  gramas: number | null;
  resto: number | null;
  custoFixo: number | null;
};

export const pct = (f: number | null, casas = 0) =>
  f === null ? "" : `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
