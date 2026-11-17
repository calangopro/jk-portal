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

/**
 * Os catálogos de produto que a Tray manda para fora. O link de cada produto
 * sai com `parceiro=<código>` (`/loja/produto.php?...&parceiro=1516`), e esse
 * código é a única marca quando o link não leva etiqueta nem clique pago.
 * Sem esta regra, quem vinha do catálogo do Instagram caía em "Acesso direto".
 * O Google Shopping sem `gclid` é a listagem gratuita; com `gclid`, já entrou
 * como Google Ads antes de chegar aqui.
 */
const CATALOGOS_DA_TRAY: Record<string, { canal: CanalDeChegada; nome: string }> = {
  "1516": { canal: "meta", nome: "catalogo_meta" },
  "1517": { canal: "google_organico", nome: "google_shopping" },
};

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
  const catalogo = CATALOGOS_DA_TRAY[limpar(q.get("parceiro"), 12) ?? ""];
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
  } else if (catalogo) {
    canal = catalogo.canal;
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
    // Sem etiqueta, o catálogo da Tray é a única pista de onde o link saiu: fica anotado como origem.
    source: source ?? (catalogo && canal === catalogo.canal ? catalogo.nome : null),
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

// ------------------------------------------------- o link da bio e o anúncio

/**
 * Mídia paga na UTM. É a MESMA regra de `ehAnuncio` (`pedidos.ts`) e do
 * `order by` de `origem_resolvida` (0113): mudou uma, mudam as três.
 */
export const MIDIA_PAGA = /^(paid|paga?|cpc|cpm|cpv|ppc|ads?|anuncios?|display|pmax|shopping)([_-].*)?$/i;

/**
 * O cookie com o último anúncio em que o visitante clicou, resumido
 * (`anuncioParaCookie`). Quem grava é a resposta de `/api/origem`; quem lê é o
 * script da página da bio (`OrigemDaBio`), que monta o texto dele a partir
 * destas mesmas constantes.
 */
export const COOKIE_DO_ANUNCIO = "jk_ad";

/** O que entra no FIM da mídia quando a chegada pela bio herda as UTMs de um anúncio: `paid` vira `paid_bio`. */
export const MARCA_DA_BIO = "_bio";
/** Por quantos dias depois do clique no anúncio a chegada pela bio ainda é dele. A mesma janela da precedência (0113). */
export const DIAS_DO_ANUNCIO = 7;

const temAMarca = (medium: string | null | undefined) => (medium ?? "").trim().toLowerCase().endsWith(MARCA_DA_BIO);

/**
 * A chegada foi pelo link da bio? Vale a página da bio como entrada, e vale a
 * marca que o próprio Instagram põe em todo link do perfil
 * (`utm_content=link_in_bio`), que às vezes aponta direto para um produto.
 */
export function chegouPelaBio(c: Pick<Chegada, "entrada" | "content" | "medium">): boolean {
  return /^\/(guias\/)?bio(\/|$)/i.test(c.entrada) || (c.content ?? "").trim().toLowerCase() === "link_in_bio" || temAMarca(c.medium);
}

/**
 * Clique em ANÚNCIO de verdade: mídia paga na UTM ou clique do Google Ads.
 *
 * `fbclid` não conta, porque o link da bio do Instagram também traz. E a
 * chegada pela bio que HERDOU as UTMs de um anúncio (mídia terminada em
 * `_bio`) também não: ela é o eco de um clique, não um clique novo. Sem essa
 * exceção, quem voltasse pela bio a cada cinco dias seria do anúncio para
 * sempre.
 */
export function ehCliqueDeAnuncio(c: { canal: string | null; medium: string | null; clique: string | null }): boolean {
  if (temAMarca(c.medium)) return false;
  return MIDIA_PAGA.test((c.medium ?? "").trim()) || c.canal === "google_ads" || /^(gclid|gbraid|wbraid)$/i.test(c.clique ?? "");
}

/** O clique no anúncio como está guardado em `origem_toques`: o canal vem do banco como texto. */
export type AnuncioDeAntes = {
  canal: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  ids: string[] | null;
};

const ehCanal = (c: string | null): c is CanalDeChegada => c !== null && Object.prototype.hasOwnProperty.call(NOME_DA_CHEGADA, c);

/**
 * O clique em anúncio mais recente entre as chegadas do visitante, dentro da
 * janela. `haDias` é há quantos dias a chegada aconteceu.
 */
export function anuncioDeAntes<T extends AnuncioDeAntes & { clique: string | null; haDias: number }>(chegadas: T[]): T | null {
  let achado: T | null = null;
  for (const c of chegadas) {
    if (c.haDias < 0 || c.haDias > DIAS_DO_ANUNCIO || !ehCliqueDeAnuncio(c)) continue;
    if (!achado || c.haDias < achado.haDias) achado = c;
  }
  return achado;
}

/**
 * A chegada pelo link da bio de quem clicou num anúncio até sete dias antes.
 *
 * O Instagram etiqueta TODO clique no link do perfil do mesmo jeito
 * (`ig / social / link_in_bio`), venha a pessoa de um anúncio ou não: pelo
 * endereço não dá para saber. Quem sabe é o site, que reconhece o visitante.
 * Então a chegada fica com as UTMs do ANÚNCIO (campanha, conjunto e anúncio
 * intactos, que é o que liga ao item certo) e a mídia ganha `_bio` no fim. O
 * clique, a página de entrada e o aparelho continuam sendo os desta chegada.
 */
export function comOAnuncioDeAntes(bio: Chegada, anuncio: AnuncioDeAntes): Chegada {
  const midia = (anuncio.medium ?? "").trim() || "cpc";
  return {
    ...bio,
    canal: ehCanal(anuncio.canal) ? anuncio.canal : bio.canal,
    source: anuncio.source ?? (anuncio.canal === "google_ads" ? "google" : bio.source),
    medium: `${midia}${MARCA_DA_BIO}`.slice(0, 120),
    campaign: anuncio.campaign,
    content: anuncio.content,
    term: anuncio.term,
    ids: Array.isArray(anuncio.ids) ? anuncio.ids.filter((n) => typeof n === "string").slice(0, 8) : [],
    nova: true,
  };
}

/**
 * O anúncio, resumido para caber num cookie que a página da bio consegue ler.
 * É só para a bio contar ao GA4 a mesma coisa que o painel grava: quem decide o
 * que vai para o banco é o servidor, olhando o histórico do visitante, e nunca
 * este cookie (que qualquer um edita no próprio navegador).
 */
export function anuncioParaCookie(c: AnuncioDeAntes): string {
  const p = new URLSearchParams();
  const por = (k: string, v: string | null | undefined) => {
    const t = (v ?? "").trim().slice(0, 110);
    if (t) p.set(k, t);
  };
  por("s", c.source ?? (c.canal === "google_ads" ? "google" : null));
  por("m", (c.medium ?? "").trim() || "cpc");
  por("c", c.campaign);
  por("n", c.content);
  por("t", c.term);
  por("i", (c.ids ?? [])[0]);
  return p.toString();
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
