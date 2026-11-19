/**
 * Abrir a janela do Como usar de qualquer lugar do painel: o botão da barra de
 * topo chama isto, e a moldura, que desenha a janela uma vez só, escuta. É o
 * mesmo jeito do "Sugerir melhoria" (`sugestoes/abrir.ts`).
 */
export const EVENTO_DE_COMO_USAR = "jk:como-usar";

export function abrirComoUsar() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_DE_COMO_USAR));
}
