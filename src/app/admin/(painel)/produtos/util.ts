/** Peças pequenas que a lista e a gaveta usam. */

export const reais = (n: number | null) =>
  n === null ? "sem preço" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Ignora o atalho de teclado quando a pessoa está digitando. */
export function digitando(e: KeyboardEvent) {
  const alvo = e.target as HTMLElement | null;
  return Boolean(alvo?.closest("input, textarea, select, [contenteditable=true]"));
}
