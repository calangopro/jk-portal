/**
 * Eventos da bio que não cabem em `registrarEvento`.
 *
 * `registrarEvento` (lib/analytics/eventos.ts) cuida dos cliques simples, pelo
 * `data-evento` no link. Aqui ficam os dois grupos que precisam de mais:
 *
 * 1. E-COMMERCE, só pelo gtag, nunca pelo `dataLayer`. `view_item_list` e
 *    `select_item` são os nomes que o GA4 reconhece e ligam a vitrine da bio
 *    ao `purchase` da loja pelo `item_id` (o id da Tray, o mesmo que a loja
 *    manda). Ficam fora do `dataLayer` porque o contêiner do GTM é o da loja,
 *    com tags de Google Ads e Pinterest que podem escutar nomes de e-commerce.
 *    Evento da bio disparando tag da loja é conversão contada em dobro.
 *
 * 2. CAPTURA, pelos dois canais, com os MESMOS nomes do tema da loja
 *    (`jk_captura_aberta`, `jk_captura_enviada`, `jk_grupo_clique`). A tag de
 *    Lead que for montada no GTM para a loja passa a valer para a bio sem
 *    nenhuma linha a mais. No GA4 o envio sai como `generate_lead`, o evento
 *    recomendado, que é o que dá para marcar como evento-chave e importar no
 *    Google Ads.
 *
 * Nunca vai nome, telefone ou e-mail para nenhum dos dois.
 */

export type ItemDaLista = {
  id: string;
  nome: string;
  categoria: string | null;
  atual: number;
  anterior: number | null;
};

type Lista = { id: string; nome: string };

// Como a loja escreve a marca no `item_brand` (conferido no `view_item`).
const MARCA = "JK ALIANÇAS";

function itemGa4(item: ItemDaLista, indice: number, lista: Lista) {
  return {
    item_id: item.id,
    item_name: item.nome,
    item_brand: MARCA,
    ...(item.categoria ? { item_category: item.categoria } : {}),
    price: item.atual,
    ...(item.anterior ? { discount: Math.round((item.anterior - item.atual) * 100) / 100 } : {}),
    index: indice,
    item_list_id: lista.id,
    item_list_name: lista.nome,
  };
}

export function medirListaVista(lista: Lista, itens: ItemDaLista[]) {
  if (typeof window === "undefined" || itens.length === 0) return;
  window.gtag?.("event", "view_item_list", {
    item_list_id: lista.id,
    item_list_name: lista.nome,
    items: itens.map((item, i) => itemGa4(item, i, lista)),
  });
}

export function medirItemEscolhido(lista: Lista, item: ItemDaLista, indice: number) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "select_item", {
    item_list_id: lista.id,
    item_list_name: lista.nome,
    items: [itemGa4(item, indice, lista)],
  });
}

type Captura = {
  campanha: string;
  momento?: string;
  comEmail?: boolean;
};

function empurrar(evento: string, dados: Record<string, unknown>) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: evento, ...dados });
  } catch {
    // Medição nunca derruba a página.
  }
}

export function medirCapturaAberta(c: Captura) {
  if (typeof window === "undefined") return;
  empurrar("jk_captura_aberta", { jk_origem: "bio", jk_campanha: c.campanha });
  window.gtag?.("event", "jk_captura_aberta", { lead_source: "bio", campanha: c.campanha });
}

export function medirCapturaEnviada(c: Captura) {
  if (typeof window === "undefined") return;
  empurrar("jk_captura_enviada", {
    jk_origem: "bio",
    jk_campanha: c.campanha,
    jk_momento: c.momento ?? "",
    jk_com_email: c.comEmail ? "sim" : "nao",
  });
  window.gtag?.("event", "generate_lead", {
    lead_source: "bio",
    campanha: c.campanha,
    momento: c.momento || undefined,
  });
}

export function medirGrupoClique(c: Captura) {
  if (typeof window === "undefined") return;
  empurrar("jk_grupo_clique", { jk_origem: "bio", jk_campanha: c.campanha });
  window.gtag?.("event", "jk_grupo_clique", { lead_source: "bio", campanha: c.campanha });
}
