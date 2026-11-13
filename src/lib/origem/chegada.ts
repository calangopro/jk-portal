/**
 * De onde a pessoa chegou, lido do endereço da página, do site anterior e do
 * navegador. É a peça que classifica cada chegada que o coletor anota.
 *
 * POR QUE EXISTE. A Tray só guarda a "UTM Source" do pedido, e só na
 * exportação: a API não traz origem nenhuma, e campanha e anúncio ela nunca
 * guardou. Aqui a loja passa a anotar a chegada inteira (as cinco UTMs, o
 * identificador do clique, o site de onde veio), e o pedido é ligado a ela
 * depois, pela sessão da Tray.
 *
 * OS CÓDIGOS DO ANÚNCIO NÃO DEPENDEM DE CONVENÇÃO. Em vez de exigir que o
 * código da campanha venha em `utm_campaign` e o do anúncio em `utm_content`,
 * `ids` junta TODO número comprido que aparecer nas etiquetas. Na leitura, o
 * banco procura esses números em `anuncios_itens` e descobre sozinho qual é
 * campanha, conjunto ou anúncio. Serve para "{{ad.id}}", para "nome|123" e
 * para o `gad_campaignid` que o Google põe por conta própria.
 *
 * Arquivo puro, para o teste rodar sem rede. `canalDaEtiqueta` vem de fora
 * (é `canalDaOrigem`, de `vendas/origem.ts`) pelo mesmo motivo de
 * `pedidoDaApi`: arquivo puro só importa TIPO do vizinho.
 */
import type { Canal } from "../vendas/origem.ts";

export type CanalDeChegada = Exclude<Canal, "sem_etiqueta"> | "google_organico" | "busca" | "youtube" | "indicacao" | "direto";

export const NOME_DA_CHEGADA: Record<CanalDeChegada, string> = {
  google_ads: "Google Ads",
  meta: "Instagram e Facebook",
  google_organico: "Busca do Google",
  busca: "Outros buscadores",
  bio: "Link da bio",
  whatsapp: "WhatsApp",
  ia: "Respostas de IA",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  youtube: "YouTube",
  email: "E-mail",
  indicacao: "Outros sites",
  outro: "Outras etiquetas",
  direto: "Acesso direto",
};

export type Chegada = {
  canal: CanalDeChegada;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  /** Números compridos achados nas etiquetas: candidatos a código de campanha, conjunto ou anúncio. */
  ids: string[];
  /** Qual identificador de clique veio (`gclid`, `fbclid`...) e o valor dele. */
  clique: string | null;
  clique_id: string | null;
  /** O site de onde a pessoa veio, só o domínio. `null` quando veio de dentro de casa. */
  referencia: string | null;
  /** O caminho da página de entrada, sem os parâmetros. */
  entrada: string;
  aparelho: "celular" | "tablet" | "computador";
  /**
   * `true` quando a chegada traz etiqueta ou vem de outro site: vale anotar
   * mesmo no meio da navegação. `false` (acesso direto, ou só o aplicativo
   * reconhecido pelo navegador) só é anotada na primeira página da visita.
   */
  nova: boolean;
};

const CLIQUES = ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid", "epik"] as const;
const ETIQUETAS_COM_CODIGO = ["utm_campaign", "utm_content", "utm_term", "utm_medium", "utm_id", "utm_source"];
const CODIGOS_DIRETOS = ["gad_campaignid", "campaign_id", "campaignid", "adset_id", "adsetid", "adgroupid", "ad_id", "adid", "creative", "hsa_cam", "hsa_grp", "hsa_ad"];

/** Sites de pagamento, banco e login: a volta deles para a loja não é uma chegada nova. */
const DE_PASSAGEM =
  /(^|\.)(mercadopago|mercadolivre|mercadolibre|pagseguro|pagbank|paypal|pagar\.me|cielo|getnet|stone|yapay|vindi|appmax|picpay|nubank|itau|bradesco|santander|caixa|bb\.com|tray\.com|traycheckout|commercesuite\.com|accounts\.google|appleid\.apple|clearsale|3dsecure|redecard|userede)(\.|$)/;

const ROBO = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|facebookexternalhit|whatsapp\/|curl|wget|python|node-fetch|axios|okhttp|go-http|scrapy|prerender|phantom|selenium|playwright/i;

/** Robô, verificador de link ou pedido sem navegador nenhum. */
export function ehRobo(agente: string | null | undefined): boolean {
  const a = (agente ?? "").trim();
  return a.length < 20 || ROBO.test(a);
}

function limpar(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  // Etiqueta que saiu sem trocar a variável ("{{ad.id}}") ou veio como "undefined" não diz nada.
  if (!s || s === "undefined" || s === "null" || /^\{\{?.*\}?\}$/.test(s)) return null;
  return s.slice(0, max);
}

function host(endereco: string | null | undefined): string | null {
  if (!endereco) return null;
  try {
    return new URL(endereco).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function aparelhoDe(agente: string): Chegada["aparelho"] {
  if (/ipad|tablet|(android(?!.*mobi))/i.test(agente)) return "tablet";
  return /mobi|iphone|android/i.test(agente) ? "celular" : "computador";
}

function canalDoSite(h: string): CanalDeChegada {
  if (/(^|\.)google\./.test(h)) return "google_organico";
  if (/(^|\.)(bing|yahoo|duckduckgo|ecosia|brave|yandex|startpage)\./.test(h)) return "busca";
  if (/(^|\.)(instagram|facebook|fb|threads|messenger)\.(com|net|me)$/.test(h)) return "meta";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
  if (/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/.test(h)) return "pinterest";
  if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return "whatsapp";
  if (/(chatgpt|openai|perplexity|gemini|copilot|claude)\./.test(h)) return "ia";
  if (/(^|\.)(mail\.google|outlook\.live|outlook\.office|mail\.yahoo|webmail)\./.test(h) || /^(e?mail|webmail)\./.test(h)) return "email";
  return "indicacao";
}

/** Navegador de dentro de aplicativo: o Instagram e o TikTok abrem o link sem dizer de onde veio. */
function canalDoAplicativo(agente: string): CanalDeChegada | null {
  if (/instagram|fban|fbav|fb_iab|barcelona/i.test(agente)) return "meta";
  if (/tiktok|musical_ly|bytedancewebview/i.test(agente)) return "tiktok";
  if (/pinterest/i.test(agente)) return "pinterest";
  return null;
}

/**
 * Lê a chegada. `null` quando o endereço não é um endereço.
 *
 * `daCasa` diz se um domínio é nosso (loja e portal): vir de uma página nossa
 * não é chegar.
 */
export function lerChegada(e: {
  url: string;
  referencia?: string | null;
  agente?: string | null;
  daCasa: (host: string) => boolean;
  canalDaEtiqueta: (utm: string) => Canal;
}): Chegada | null {
  let u: URL;
  try {
    u = new URL(e.url);
  } catch {
    return null;
  }
  const q = u.searchParams;
  const agente = e.agente ?? "";

  // `o=canal` é a etiqueta curta que a bio aceita no lugar de `utm_source`.
  const source = limpar(q.get("utm_source"), 120) ?? limpar(q.get("o"), 120);
  const medium = limpar(q.get("utm_medium"), 120);
  const campaign = limpar(q.get("utm_campaign"), 200);
  const content = limpar(q.get("utm_content"), 200);
  const term = limpar(q.get("utm_term"), 200);

  const tipoDoClique = CLIQUES.find((c) => limpar(q.get(c), 400)) ?? null;
  const clique_id = tipoDoClique ? limpar(q.get(tipoDoClique), 400) : null;

  const ids: string[] = [];
  const junta = (texto: string | null) => {
    for (const n of (texto ?? "").match(/\d{9,20}/g) ?? []) if (!ids.includes(n) && ids.length < 8) ids.push(n);
  };
  for (const k of CODIGOS_DIRETOS) junta(limpar(q.get(k), 60));
  for (const k of ETIQUETAS_COM_CODIGO) junta(limpar(q.get(k), 200));

  const deFora = host(e.referencia);
  const referencia = deFora && !e.daCasa(deFora) && !DE_PASSAGEM.test(deFora) ? deFora.slice(0, 120) : null;

  let canal: CanalDeChegada = "direto";
  let nova = true;
  const pagoDoGoogle = Boolean(limpar(q.get("gclid"), 9) || limpar(q.get("gbraid"), 9) || limpar(q.get("wbraid"), 9) || limpar(q.get("gad_source"), 9));
  if (pagoDoGoogle) {
    canal = "google_ads";
  } else if (source) {
    const c = e.canalDaEtiqueta(source);
    if (c === "google_ads" && /organic/i.test(medium ?? "")) canal = "google_organico";
    else if (c === "outro" && /e-?mail|newsletter/i.test(medium ?? "")) canal = "email";
    else canal = c === "sem_etiqueta" ? "outro" : c;
  } else if (tipoDoClique === "fbclid") {
    canal = "meta";
  } else if (tipoDoClique === "ttclid") {
    canal = "tiktok";
  } else if (tipoDoClique === "msclkid") {
    canal = "busca";
  } else if (tipoDoClique === "epik") {
    canal = "pinterest";
  } else if (campaign || medium || content || ids.length > 0) {
    canal = "outro";
  } else if (referencia) {
    canal = canalDoSite(referencia);
  } else {
    canal = canalDoAplicativo(agente) ?? "direto";
    nova = false;
  }

  return {
    canal,
    source,
    medium,
    campaign,
    content,
    term,
    ids,
    clique: tipoDoClique,
    clique_id,
    referencia,
    entrada: u.pathname.slice(0, 300) || "/",
    aparelho: aparelhoDe(agente),
    nova,
  };
}

/**
 * A chegada repete a anterior? Recarregar a página do anúncio, ou abrir a
 * mesma campanha em duas abas, não são duas chegadas.
 */
export function repeteAAnterior(
  nova: Pick<Chegada, "canal" | "campaign" | "content" | "clique_id" | "nova">,
  anterior: { canal: string; campaign: string | null; content: string | null; clique_id: string | null; haMinutos: number } | null,
): boolean {
  if (!anterior || anterior.haMinutos > 30) return false;
  // Acesso direto logo depois de qualquer chegada é a mesma visita continuando.
  if (!nova.nova) return true;
  return anterior.canal === nova.canal && anterior.campaign === nova.campaign && anterior.content === nova.content && anterior.clique_id === nova.clique_id;
}

/** O identificador de sessão da Tray, como a loja põe em `data-session`. `null` para qualquer outra coisa. */
export function sessaoValida(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^[a-z0-9]{20,40}$/i.test(s) ? s : null;
}

/** O número do pedido que a página de confirmação informou. `null` para qualquer outra coisa. */
export function pedidoValido(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,10}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 2_000_000_000 ? n : null;
}
