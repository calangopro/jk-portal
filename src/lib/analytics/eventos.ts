/**
 * Eventos de clique que importam para o negócio. Vão para o dataLayer, que o
 * GTM encaminha ao GA4. Sem GTM carregado, a chamada não faz nada e não quebra.
 *
 * O Trello pede produto, WhatsApp, telefone, rota e loja. Waze e guia entraram
 * depois, e estão aqui porque o markup já os emite.
 */

export type TipoEvento =
  | "clique_produto"
  | "clique_whatsapp"
  | "clique_telefone"
  | "clique_rota"
  // Waze já era emitido no markup das páginas de loja e estava fora desta
  // lista, então o tipo mentia sobre o que a medição recebe de verdade.
  | "clique_waze"
  | "clique_loja"
  // Saída para outro guia, vinda do bloco de chamada para ação. Separada de
  // `clique_loja` porque leitura e visita à unidade são resultados diferentes.
  | "clique_guia";

type Detalhe = {
  /** De onde partiu, ex.: "guia/alianca-de-namoro" ou "loja/guarulhos". */
  origem?: string;
  /** Nome do destino, ex.: nome do produto ou da unidade. */
  destino?: string;
  url?: string;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function registrarEvento(tipo: TipoEvento, detalhe: Detalhe = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: tipo, ...detalhe });
}
