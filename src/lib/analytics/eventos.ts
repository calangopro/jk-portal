/**
 * Eventos de clique que importam para o negócio.
 *
 * Cada evento sai por dois canais, e os dois são necessários:
 *
 *   1. `dataLayer`, que é o do GTM. O contêiner é o MESMO da loja
 *      (GTM-WWT3T789) e hoje carrega Google Ads e Pinterest, sem GA4. Serve
 *      para montar conversão de anúncio a partir de clique no portal.
 *   2. `gtag`, que é o GA4 direto (ver `Medicao`). É por aqui que o evento
 *      chega ao relatório, na mesma propriedade em que a Tray registra a venda.
 *
 * Sem nenhum dos dois carregado (desenvolvimento, integração desligada), a
 * chamada não faz nada e não quebra.
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
  /** De onde partiu, ex.: "/alianca-de-namoro" ou "/lojas/guarulhos". */
  origem?: string;
  /** Nome do destino, ex.: nome do produto ou da unidade. */
  destino?: string | null;
  /** Parte da página: "cabecalho", "rodape" ou "conteudo". */
  posicao?: string;
  url?: string | null;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function registrarEvento(tipo: TipoEvento | string, detalhe: Detalhe = {}) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: tipo, ...detalhe });

  // No GA4, `link_url` é o nome que o próprio Google usa para clique de
  // saída, então o parâmetro já aparece nos relatórios sem cadastro. A página
  // de origem o GA4 já registra sozinho (`page_location`).
  window.gtag?.("event", tipo, {
    destino: detalhe.destino ?? undefined,
    posicao: detalhe.posicao,
    link_url: detalhe.url ?? undefined,
  });
}
