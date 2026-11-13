/**
 * Lê a resposta das APIs no nível de campanha, conjunto e anúncio, e devolve
 * as linhas de `anuncios_itens` (0061). Arquivo puro, para o teste rodar sem
 * rede e sem banco.
 *
 * META. Uma chamada só, no nível de anúncio: campanha e conjunto saem da soma,
 * porque no Meta gasto, impressão, clique e ação somam certo de baixo para
 * cima. O funil vem em `actions`, uma lista de tipos em que a MESMA compra
 * aparece com três nomes (`purchase`, `omni_purchase` e a do pixel). Somar os
 * três triplicaria a venda: vale o primeiro nome que existir, na ordem abaixo.
 *
 * GOOGLE. Uma consulta por nível, porque lá a soma não fecha: Performance Max
 * gasta na campanha sem ter anúncio comum por baixo. O grupo de recursos do
 * Performance Max entra como "conjunto".
 */

export type Nivel = "campanha" | "conjunto" | "anuncio";

export type LinhaDeItem = {
  dia: string;
  plataforma: "meta" | "google";
  nivel: Nivel;
  item_id: string;
  nome: string;
  campanha_id: string | null;
  conjunto_id: string | null;
  tipo: string | null;
  ativo: boolean | null;
  gasto: number;
  impressoes: number;
  cliques: number;
  cliques_todos: number | null;
  visitas: number | null;
  carrinhos: number | null;
  checkouts: number | null;
  compras: number | null;
  valor: number | null;
  conversas: number | null;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const centavos = (n: number) => Math.round(n * 100) / 100;
const numero = (v: unknown): number => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? 0 : n;
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

type Acao = { action_type?: string; value?: string | number };

/** A mesma ação com vários nomes: vale o primeiro que existir. */
const ACOES = {
  visitas: ["landing_page_view", "omni_landing_page_view"],
  carrinhos: ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"],
  checkouts: ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
  compras: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
  conversas: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"],
} as const;

function acao(lista: Acao[] | undefined, nomes: readonly string[]): number {
  for (const nome of nomes) {
    const a = (lista ?? []).find((x) => x.action_type === nome);
    if (a) return numero(a.value);
  }
  return 0;
}

/** Objetivo da campanha do Meta, na palavra que a tela usa. */
export function tipoDoMeta(objetivo: unknown): string {
  const o = String(objetivo ?? "").toUpperCase();
  if (/SALES|CONVERSIONS|CATALOG/.test(o)) return "vendas";
  if (/MESSAGES/.test(o)) return "mensagens";
  if (/TRAFFIC|LINK_CLICKS/.test(o)) return "trafego";
  if (/ENGAGEMENT|PAGE_LIKES|VIDEO_VIEWS/.test(o)) return "engajamento";
  if (/LEAD/.test(o)) return "cadastros";
  if (/AWARENESS|REACH/.test(o)) return "alcance";
  return "outro";
}

function somar(a: LinhaDeItem, b: LinhaDeItem): void {
  a.gasto = centavos(a.gasto + b.gasto);
  a.impressoes += b.impressoes;
  a.cliques += b.cliques;
  a.cliques_todos = (a.cliques_todos ?? 0) + (b.cliques_todos ?? 0);
  a.visitas = (a.visitas ?? 0) + (b.visitas ?? 0);
  a.carrinhos = (a.carrinhos ?? 0) + (b.carrinhos ?? 0);
  a.checkouts = (a.checkouts ?? 0) + (b.checkouts ?? 0);
  a.compras = centavos((a.compras ?? 0) + (b.compras ?? 0));
  a.valor = centavos((a.valor ?? 0) + (b.valor ?? 0));
  a.conversas = (a.conversas ?? 0) + (b.conversas ?? 0);
  if (b.ativo === true) a.ativo = true;
  else if (a.ativo === null && b.ativo === false) a.ativo = false;
}

/**
 * Insights do Meta no nível de anúncio, com `time_increment=1`.
 * `situacao` é o `effective_status` de cada anúncio, quando foi possível ler:
 * só "ACTIVE" está veiculando (ele já desconta campanha e conjunto pausados).
 */
export function lerItensDoMeta(linhas: unknown[], situacao: Map<string, string> | null): LinhaDeItem[] {
  const porChave = new Map<string, LinhaDeItem>();
  const juntar = (l: LinhaDeItem) => {
    const chave = `${l.dia}|${l.nivel}|${l.item_id}`;
    const atual = porChave.get(chave);
    if (atual) somar(atual, l);
    else porChave.set(chave, { ...l });
  };

  for (const bruta of linhas) {
    const l = (bruta ?? {}) as Record<string, unknown>;
    const dia = String(l.date_start ?? "");
    const anuncio = String(l.ad_id ?? "");
    const conjunto = String(l.adset_id ?? "");
    const campanha = String(l.campaign_id ?? "");
    if (!DIA.test(dia) || !anuncio || !campanha) continue;
    // Linha sem impressão e sem gasto não diz nada e só incha a tabela.
    if (numero(l.impressions) === 0 && numero(l.spend) === 0) continue;

    const acoes = l.actions as Acao[] | undefined;
    const estado = situacao ? situacao.get(anuncio) : undefined;
    const base: LinhaDeItem = {
      dia,
      plataforma: "meta",
      nivel: "anuncio",
      item_id: anuncio,
      nome: String(l.ad_name ?? "").slice(0, 300),
      campanha_id: campanha,
      conjunto_id: conjunto || null,
      tipo: tipoDoMeta(l.objective),
      ativo: situacao ? estado === "ACTIVE" : null,
      gasto: centavos(numero(l.spend)),
      impressoes: Math.round(numero(l.impressions)),
      cliques: Math.round(numero(l.inline_link_clicks)),
      cliques_todos: Math.round(numero(l.clicks)),
      visitas: Math.round(acao(acoes, ACOES.visitas)),
      carrinhos: Math.round(acao(acoes, ACOES.carrinhos)),
      checkouts: Math.round(acao(acoes, ACOES.checkouts)),
      compras: acao(acoes, ACOES.compras),
      valor: centavos(acao(l.action_values as Acao[] | undefined, ACOES.compras)),
      conversas: Math.round(acao(acoes, ACOES.conversas)),
    };
    juntar(base);
    if (conjunto) {
      juntar({ ...base, nivel: "conjunto", item_id: conjunto, nome: String(l.adset_name ?? "").slice(0, 300), conjunto_id: null });
    }
    juntar({ ...base, nivel: "campanha", item_id: campanha, nome: String(l.campaign_name ?? "").slice(0, 300), campanha_id: null, conjunto_id: null });
  }
  return [...porChave.values()];
}

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------

/** Tipo de canal da campanha do Google, na palavra que a tela usa. */
export function tipoDoGoogle(canal: unknown): string {
  const c = String(canal ?? "").toUpperCase();
  if (c === "SEARCH") return "pesquisa";
  if (c === "SHOPPING") return "shopping";
  if (c === "PERFORMANCE_MAX") return "pmax";
  if (c === "DISPLAY") return "display";
  if (c === "VIDEO") return "video";
  if (c === "DEMAND_GEN" || c === "DISCOVERY") return "demand_gen";
  return "outro";
}

type Resultado = Record<string, Record<string, unknown> | undefined>;

function resultados(lotes: unknown): Resultado[] {
  const saida: Resultado[] = [];
  for (const lote of Array.isArray(lotes) ? lotes : [lotes]) {
    for (const r of ((lote ?? {}) as { results?: Resultado[] }).results ?? []) saida.push(r ?? {});
  }
  return saida;
}

function metricas(r: Resultado) {
  const m = r.metrics ?? {};
  return {
    gasto: centavos(numero(m.costMicros) / 1_000_000),
    impressoes: Math.round(numero(m.impressions)),
    cliques: Math.round(numero(m.clicks)),
    compras: centavos(numero(m.conversions)),
    valor: centavos(numero(m.conversionsValue)),
  };
}

const ligado = (...estados: unknown[]) => estados.every((e) => e === undefined || e === "ENABLED");

/** O nome do anúncio do Google costuma vir vazio: cai no primeiro título, depois no tipo. */
function nomeDoAnuncio(ad: Record<string, unknown>): string {
  const nome = String(ad.name ?? "").trim();
  if (nome) return nome;
  const titulos = ((ad.responsiveSearchAd as { headlines?: { text?: string }[] } | undefined)?.headlines ?? [])
    .map((h) => String(h.text ?? "").trim())
    .filter(Boolean);
  if (titulos.length) return titulos.slice(0, 2).join(" | ");
  const tipo = String(ad.type ?? "");
  if (/SHOPPING/.test(tipo)) return "Anúncio de produto do Shopping";
  return tipo ? `Anúncio ${tipo.toLowerCase().replace(/_/g, " ")}` : "Anúncio sem nome";
}

/**
 * Junta as quatro consultas do Google. `tipos` sai das campanhas e desce para
 * conjuntos e anúncios, que não trazem o tipo de canal. Linha sem impressão e
 * sem gasto é descartada.
 */
export function lerItensDoGoogle(lotes: { campanhas?: unknown; grupos?: unknown; recursos?: unknown; anuncios?: unknown }): LinhaDeItem[] {
  const linhas: LinhaDeItem[] = [];
  const tipos = new Map<string, string>();
  const vazia = (m: ReturnType<typeof metricas>) => m.impressoes === 0 && m.gasto === 0;

  for (const r of resultados(lotes.campanhas)) {
    const c = r.campaign ?? {};
    const id = String(c.id ?? "");
    const dia = String(r.segments?.date ?? "");
    if (!id) continue;
    tipos.set(id, tipoDoGoogle(c.advertisingChannelType));
    const m = metricas(r);
    if (!DIA.test(dia) || vazia(m)) continue;
    linhas.push({
      dia, plataforma: "google", nivel: "campanha", item_id: id, nome: String(c.name ?? "").slice(0, 300),
      campanha_id: null, conjunto_id: null, tipo: tipos.get(id) ?? null, ativo: ligado(c.status),
      ...m, cliques_todos: null, visitas: null, carrinhos: null, checkouts: null, conversas: null,
    });
  }

  const conjunto = (r: Resultado, item: Record<string, unknown>) => {
    const id = String(item.id ?? "");
    const campanha = String(r.campaign?.id ?? "");
    const dia = String(r.segments?.date ?? "");
    const m = metricas(r);
    if (!id || !DIA.test(dia) || vazia(m)) return;
    linhas.push({
      dia, plataforma: "google", nivel: "conjunto", item_id: id, nome: String(item.name ?? "").slice(0, 300),
      campanha_id: campanha || null, conjunto_id: null, tipo: tipos.get(campanha) ?? null,
      ativo: ligado(item.status, r.campaign?.status),
      ...m, cliques_todos: null, visitas: null, carrinhos: null, checkouts: null, conversas: null,
    });
  };
  for (const r of resultados(lotes.grupos)) conjunto(r, r.adGroup ?? {});
  for (const r of resultados(lotes.recursos)) conjunto(r, r.assetGroup ?? {});

  for (const r of resultados(lotes.anuncios)) {
    const ad = ((r.adGroupAd ?? {}).ad ?? {}) as Record<string, unknown>;
    const id = String(ad.id ?? "");
    const campanha = String(r.campaign?.id ?? "");
    const dia = String(r.segments?.date ?? "");
    const m = metricas(r);
    if (!id || !DIA.test(dia) || vazia(m)) continue;
    linhas.push({
      dia, plataforma: "google", nivel: "anuncio", item_id: id, nome: nomeDoAnuncio(ad).slice(0, 300),
      campanha_id: campanha || null, conjunto_id: String(r.adGroup?.id ?? "") || null, tipo: tipos.get(campanha) ?? null,
      ativo: ligado((r.adGroupAd ?? {}).status, r.adGroup?.status, r.campaign?.status),
      ...m, cliques_todos: null, visitas: null, carrinhos: null, checkouts: null, conversas: null,
    });
  }

  // O mesmo item pode vir repetido no mesmo dia (anúncio em mais de uma rede): soma.
  const porChave = new Map<string, LinhaDeItem>();
  for (const l of linhas) {
    const chave = `${l.dia}|${l.nivel}|${l.item_id}`;
    const atual = porChave.get(chave);
    if (!atual) porChave.set(chave, { ...l });
    else {
      atual.gasto = centavos(atual.gasto + l.gasto);
      atual.impressoes += l.impressoes;
      atual.cliques += l.cliques;
      atual.compras = centavos((atual.compras ?? 0) + (l.compras ?? 0));
      atual.valor = centavos((atual.valor ?? 0) + (l.valor ?? 0));
    }
  }
  return [...porChave.values()];
}
