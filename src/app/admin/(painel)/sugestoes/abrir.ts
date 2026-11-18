/**
 * Abrir a janela de sugerir melhoria de qualquer lugar do painel: o botão da
 * barra de topo e o da tela do roadmap chamam isto, e a moldura, que desenha a
 * janela uma vez só, escuta. Assim os dois botões do topo (celular e
 * computador) não abrem duas janelas.
 */
export const EVENTO_DE_SUGERIR = "jk:sugerir-melhoria";

export function abrirSugestao() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_DE_SUGERIR));
}
