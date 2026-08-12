/**
 * Eventos de clique que importam para o negócio. Vão para o dataLayer, que o
 * GTM encaminha ao GA4. Sem GTM carregado, a chamada não faz nada e não quebra.
 *
 * O Trello pede exatamente estes: produto, WhatsApp, telefone, rota e loja.
 */

export type TipoEvento =
  | "clique_produto"
  | "clique_whatsapp"
  | "clique_telefone"
  | "clique_rota"
  | "clique_loja";

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
