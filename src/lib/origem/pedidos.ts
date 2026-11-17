/**
 * Cada pedido com a chegada que o trouxe: as UTMs como vieram e a campanha, o
 * conjunto e o anúncio a que elas foram ligadas (`origem_resolvida`, 0112).
 *
 * É o que responde "qual anúncio vendeu este pedido" e "o que este anúncio
 * vendeu". Quem casa é o banco, do mais certo para o menos certo e nunca no
 * chute; aqui só se lê, se agrupa e se escreve em português.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type ComoLigou = "numero" | "nome" | "unico" | "anuncio" | null;

export type PedidoComOrigem = {
  pedido: number;
  feitoEm: string;
  dia: string;
  situacao: "pago" | "aguardando" | "cancelado";
  status: string | null;
  total: number;
  /** A etiqueta que a Tray guarda (só vem pela exportação). */
  etiqueta: string | null;
  /** O painel sabe quem é o visitante deste pedido. */
  ligado: boolean;
  canal: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  clique: string | null;
  entrada: string | null;
  aparelho: string | null;
  chegouEm: string | null;
  chegadas: number;
  plataforma: "meta" | "google" | null;
  campanhaId: string | null;
  conjuntoId: string | null;
  anuncioId: string | null;
  campanhaNome: string | null;
  conjuntoNome: string | null;
  anuncioNome: string | null;
  campanhaPor: ComoLigou;
  conjuntoPor: ComoLigou;
  anuncioPor: ComoLigou;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const como = (v: unknown): ComoLigou => (v === "numero" || v === "nome" || v === "unico" || v === "anuncio" ? v : null);

/** Uma linha de `pedidos_com_origem` ou o bloco `origem` de `origem_do_pedido`. `null` se não tiver pedido nem data. */
export function lerPedidoComOrigem(v: unknown): PedidoComOrigem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const pedido = Number(o.pedido);
  const feitoEm = texto(o.feito_em);
  if (!Number.isInteger(pedido) || pedido <= 0 || !feitoEm) return null;
  const situacao = o.situacao === "pago" || o.situacao === "cancelado" ? o.situacao : "aguardando";
  return {
    pedido,
    feitoEm,
    dia: texto(o.dia) ?? feitoEm.slice(0, 10),
    situacao,
    status: texto(o.status),
    total: Number(o.total) || 0,
    ...lerChegadaCasada(o),
  };
}

type Casada = Omit<PedidoComOrigem, "pedido" | "feitoEm" | "dia" | "situacao" | "status" | "total">;

/** A parte da origem, sem o pedido: serve também à gaveta, que já tem o pedido de outro lugar. */
export function lerChegadaCasada(o: Record<string, unknown>): Casada {
  const plataforma = o.plataforma === "meta" || o.plataforma === "google" ? o.plataforma : null;
  return {
    etiqueta: texto(o.etiqueta),
    ligado: o.ligado === true,
    canal: texto(o.canal),
    source: texto(o.source),
    medium: texto(o.medium),
    campaign: texto(o.campaign),
    content: texto(o.content),
    term: texto(o.term),
    clique: texto(o.clique),
    entrada: texto(o.entrada),
    aparelho: texto(o.aparelho),
    chegouEm: texto(o.chegou_em),
    chegadas: Number(o.chegadas) || 0,
    plataforma,
    campanhaId: texto(o.campanha_id),
    conjuntoId: texto(o.conjunto_id),
    anuncioId: texto(o.anuncio_id),
    campanhaNome: texto(o.campanha_nome),
    conjuntoNome: texto(o.conjunto_nome),
    anuncioNome: texto(o.anuncio_nome),
    campanhaPor: como(o.campanha_por),
    conjuntoPor: como(o.conjunto_por),
    anuncioPor: como(o.anuncio_por),
  };
}

export function lerPedidosComOrigem(v: unknown): PedidoComOrigem[] {
  return Array.isArray(v) ? v.map(lerPedidoComOrigem).filter((p): p is PedidoComOrigem => p !== null) : [];
}

/** A UTM veio com `+` no lugar de espaço em parte das visitas. Para LER, o espaço volta. */
export const utmLegivel = (v: string | null): string | null => (v ? v.replace(/\+/g, " ").replace(/\s+/g, " ").trim() || null : null);

const MIDIA_PAGA = /^(paid|paga?|cpc|cpm|cpv|ppc|ads?|anuncios?|display|pmax|shopping)([_-].*)?$/i;

/**
 * A chegada foi por ANÚNCIO? `utm_source=ig` sozinho não diz: o link da bio do
 * Instagram também chega como Instagram, com `fbclid` e tudo. É anúncio quando
 * casou com uma campanha, quando a mídia da UTM é paga ou quando o clique é do
 * Google Ads (`gclid` só existe em anúncio).
 */
export function ehAnuncio(p: Pick<Casada, "campanhaId" | "medium" | "clique" | "canal">): boolean {
  if (p.campanhaId) return true;
  if (p.medium && MIDIA_PAGA.test(p.medium.trim())) return true;
  return p.canal === "google_ads" && /^(gclid|gbraid|wbraid)$/i.test(p.clique ?? "");
}

const COM_A_MARCA_DA_BIO = /_bio$/i;

/**
 * A chegada passou pelo link da bio? A MESMA regra de `chegouPelaBio`
 * (`chegada.ts`): a página da bio como entrada, a marca que o Instagram põe em
 * todo link do perfil (`utm_content=link_in_bio`) ou a mídia terminada em
 * `_bio`, que é como o site grava a chegada pela bio de quem veio de anúncio.
 */
export function pelaBio(p: Pick<Casada, "medium" | "content" | "entrada">): boolean {
  return (
    COM_A_MARCA_DA_BIO.test((p.medium ?? "").trim()) ||
    (p.content ?? "").trim().toLowerCase() === "link_in_bio" ||
    /^\/(guias\/)?bio(\/|$)/i.test(p.entrada ?? "")
  );
}

/** O link da bio separado em dois: de quem veio de anúncio e de quem não veio. */
export type TipoDeChegada = "anuncio_pela_bio" | "anuncio" | "bio" | "outra";

export const NOME_DO_TIPO: Record<TipoDeChegada, string> = {
  anuncio_pela_bio: "Anúncio, pelo link da bio",
  anuncio: "Anúncio",
  bio: "Link da bio, sem anúncio antes",
  outra: "Não é anúncio",
};

/** `null` quando não há chegada, ou quando ela é acesso direto: aí não há o que classificar. */
export function tipoDaChegada(p: Pick<Casada, "campanhaId" | "medium" | "clique" | "canal" | "content" | "entrada">): TipoDeChegada | null {
  if (!p.canal || p.canal === "direto") return null;
  const bio = pelaBio(p);
  if (ehAnuncio(p)) return bio ? "anuncio_pela_bio" : "anuncio";
  return bio ? "bio" : "outra";
}

/**
 * As chegadas pelo link da bio no período, e quantas são de quem clicou num
 * anúncio nos sete dias antes (`chegadas_pela_bio`, 0114). São CHEGADAS, não
 * pedidos: é o que responde "a bio está trazendo gente de anúncio ou gente que
 * já seguia a loja" antes de existir venda para contar.
 */
export type ChegadasPelaBio = {
  chegadas: number;
  visitantes: number;
  deAnuncio: number;
  visitantesDeAnuncio: number;
  semAnuncio: number;
  /** Os anúncios de onde essas pessoas vieram, pelo nome da campanha na UTM. Vazio quando a UTM não trouxe campanha. */
  porCampanha: { campanha: string; chegadas: number; visitantes: number }[];
};

export function lerChegadasPelaBio(v: unknown): ChegadasPelaBio | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => Math.max(0, Math.round(Number(x) || 0));
  const chegadas = n(o.chegadas);
  const deAnuncio = Math.min(n(o.de_anuncio), chegadas);
  return {
    chegadas,
    visitantes: n(o.visitantes),
    deAnuncio,
    visitantesDeAnuncio: n(o.visitantes_de_anuncio),
    semAnuncio: chegadas - deAnuncio,
    porCampanha: (Array.isArray(o.por_campanha) ? o.por_campanha : [])
      .map((c) => {
        const l = (c ?? {}) as Record<string, unknown>;
        return { campanha: utmLegivel(texto(l.campanha)) ?? "", chegadas: n(l.chegadas), visitantes: n(l.visitantes) };
      })
      .filter((c) => c.chegadas > 0),
  };
}

/** Os pedidos pagos que chegaram pelo link da bio, nos dois tipos. */
export function pagosPelaBio(pedidos: PedidoComOrigem[]): { deAnuncio: number; semAnuncio: number } {
  let deAnuncio = 0;
  let semAnuncio = 0;
  for (const p of pedidos) {
    if (p.situacao !== "pago") continue;
    const tipo = tipoDaChegada(p);
    if (tipo === "anuncio_pela_bio") deAnuncio += 1;
    else if (tipo === "bio") semAnuncio += 1;
  }
  return { deAnuncio, semAnuncio };
}

export type NivelLigado = "anuncio" | "conjunto" | "campanha" | null;

/** Até onde a UTM foi ligada. */
export const nivelLigado = (p: Pick<Casada, "campanhaId" | "conjuntoId" | "anuncioId">): NivelLigado =>
  p.anuncioId ? "anuncio" : p.conjuntoId ? "conjunto" : p.campanhaId ? "campanha" : null;

const POR: Record<Exclude<ComoLigou, null>, string> = {
  numero: "pelo número que veio na UTM",
  nome: "pelo nome que veio na UTM",
  unico: "porque é o único",
  anuncio: "pelo anúncio achado",
};

/**
 * Em uma frase, o que foi ligado e por quê, e o que ficou sem ligar. É o que a
 * pessoa lê para confiar (ou desconfiar) da ligação.
 */
export function comoLigou(p: Casada): string {
  if (!p.ligado) return "O painel não sabe quem é o visitante deste pedido, então não há chegada para ligar.";
  if (!p.canal) return "O visitante é conhecido, mas não há chegada dele nos trinta dias antes do pedido.";
  if (p.canal === "direto") return "Todas as chegadas deste visitante foram diretas, sem UTM nem site de origem.";
  const bio = pelaBio(p);
  if (!ehAnuncio(p)) {
    return bio
      ? "Chegou pelo link da bio, e este visitante não tinha clicado em anúncio nos sete dias antes."
      : "A chegada não é de anúncio (mídia orgânica ou outro site).";
  }
  // Pela bio há dois caminhos: o anúncio que leva direto para lá, e quem clicou num anúncio e voltou pelo link do perfil.
  const passagem = !bio
    ? ""
    : COM_A_MARCA_DA_BIO.test((p.medium ?? "").trim())
      ? "Clicou num anúncio e depois chegou pelo link da bio: as UTMs são as do anúncio, com _bio no fim da mídia. "
      : "O anúncio levou direto para a bio. ";
  const nivel = nivelLigado(p);
  if (!nivel) return `${passagem}A chegada é de anúncio, mas a UTM não bate com nenhuma campanha lida das plataformas.`;
  const partes = [`Campanha ${POR[p.campanhaPor ?? "numero"]}`];
  if (p.conjuntoId) partes.push(`conjunto ${POR[p.conjuntoPor ?? "nome"]}`);
  if (p.anuncioId) partes.push(`anúncio ${POR[p.anuncioPor ?? "nome"]}`);
  const frase = `${passagem}${partes.join(", ")}.`;
  if (nivel === "anuncio") return frase;
  if (p.plataforma === "google") return `${frase} O Google não manda o anúncio no endereço, só a campanha.`;
  const falta = nivel === "campanha" ? "o conjunto e o anúncio" : "o anúncio";
  return `${frase} Faltou ${falta}: o texto da UTM não é o nome de nenhum ${nivel === "campanha" ? "conjunto" : "anúncio"} ${nivel === "campanha" ? "desta campanha" : "deste conjunto"}.`;
}

export type Agrupamento = "anuncio" | "conjunto" | "campanha" | "utm" | "canal";

export type Grupo = {
  chave: string;
  titulo: string;
  /** Onde o item está (a campanha, o conjunto) ou o resto da UTM. */
  apoio: string | null;
  plataforma: "meta" | "google" | null;
  /** O item da plataforma, quando o grupo é um. Serve para abrir na tela de campanhas. */
  itemId: string | null;
  criados: number;
  pagos: number;
  valor: number;
  pedidos: number[];
};

const SEM = "\u0000sem";

function chaveETitulo(p: PedidoComOrigem, por: Agrupamento): Pick<Grupo, "chave" | "titulo" | "apoio" | "plataforma" | "itemId"> {
  const fora = (titulo: string) => ({ chave: `${SEM}:${titulo}`, titulo, apoio: null, plataforma: null, itemId: null });
  if (por === "canal") return { chave: p.canal ?? SEM, titulo: p.canal ?? "", apoio: null, plataforma: null, itemId: null };
  if (por === "utm") {
    if (!p.source && !p.medium && !p.campaign && !p.content && !p.term) return fora(p.canal ? "Chegada sem UTM" : "Sem chegada anotada");
    const base = [utmLegivel(p.source), utmLegivel(p.medium)].filter(Boolean).join(" / ") || "sem origem";
    return {
      chave: [p.source, p.medium, utmLegivel(p.campaign), utmLegivel(p.term), utmLegivel(p.content)].map((x) => (x ?? "").toLowerCase()).join("|"),
      titulo: utmLegivel(p.content) ?? utmLegivel(p.campaign) ?? base,
      apoio: [base, utmLegivel(p.campaign), utmLegivel(p.term)].filter(Boolean).join(", "),
      plataforma: null,
      itemId: null,
    };
  }
  if (!ehAnuncio(p)) return fora(!p.canal ? "Sem chegada anotada" : "Não veio de anúncio");
  if (!p.campanhaId) return fora("Anúncio que a UTM não identifica");
  if (por === "campanha") return { chave: p.campanhaId, titulo: p.campanhaNome ?? p.campanhaId, apoio: null, plataforma: p.plataforma, itemId: p.campanhaId };
  if (por === "conjunto") {
    if (!p.conjuntoId) return { chave: `${SEM}:c:${p.campanhaId}`, titulo: "Conjunto não identificado", apoio: p.campanhaNome, plataforma: p.plataforma, itemId: null };
    return { chave: p.conjuntoId, titulo: p.conjuntoNome ?? p.conjuntoId, apoio: p.campanhaNome, plataforma: p.plataforma, itemId: p.conjuntoId };
  }
  if (!p.anuncioId) {
    return { chave: `${SEM}:a:${p.conjuntoId ?? p.campanhaId}`, titulo: "Anúncio não identificado", apoio: [p.campanhaNome, p.conjuntoNome].filter(Boolean).join(", ") || null, plataforma: p.plataforma, itemId: null };
  }
  return { chave: p.anuncioId, titulo: p.anuncioNome ?? p.anuncioId, apoio: [p.campanhaNome, p.conjuntoNome].filter(Boolean).join(", ") || null, plataforma: p.plataforma, itemId: p.anuncioId };
}

/**
 * Junta os pedidos por anúncio, conjunto, campanha, UTM crua ou canal. Do que
 * mais vendeu PAGO para o que menos; o que não é de anúncio (ou não foi
 * identificado) vai para o fim, porque a pergunta da tela é sobre anúncio.
 */
export function agrupar(pedidos: PedidoComOrigem[], por: Agrupamento): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const p of pedidos) {
    const k = chaveETitulo(p, por);
    const g = grupos.get(k.chave) ?? { ...k, criados: 0, pagos: 0, valor: 0, pedidos: [] };
    g.criados += 1;
    if (p.situacao === "pago") {
      g.pagos += 1;
      g.valor = Math.round((g.valor + p.total) * 100) / 100;
    }
    g.pedidos.push(p.pedido);
    grupos.set(k.chave, g);
  }
  const fora = (g: Grupo) => (g.chave.startsWith(SEM) || g.chave === SEM ? 1 : 0);
  return [...grupos.values()].sort((a, b) => fora(a) - fora(b) || b.valor - a.valor || b.pagos - a.pagos || b.criados - a.criados);
}

export type CoberturaDaLista = {
  pedidos: number;
  pagos: number;
  /** Pagos em que o painel sabe a chegada. */
  pagosComChegada: number;
  pagosDeAnuncio: number;
  pagosComCampanha: number;
  pagosComAnuncioExato: number;
  valorPago: number;
  valorDeAnuncio: number;
  valorComAnuncioExato: number;
};

export function coberturaDaLista(pedidos: PedidoComOrigem[]): CoberturaDaLista {
  const c: CoberturaDaLista = { pedidos: pedidos.length, pagos: 0, pagosComChegada: 0, pagosDeAnuncio: 0, pagosComCampanha: 0, pagosComAnuncioExato: 0, valorPago: 0, valorDeAnuncio: 0, valorComAnuncioExato: 0 };
  for (const p of pedidos) {
    if (p.situacao !== "pago") continue;
    c.pagos += 1;
    c.valorPago += p.total;
    if (p.canal) c.pagosComChegada += 1;
    if (ehAnuncio(p)) {
      c.pagosDeAnuncio += 1;
      c.valorDeAnuncio += p.total;
    }
    if (p.campanhaId) c.pagosComCampanha += 1;
    if (p.anuncioId) {
      c.pagosComAnuncioExato += 1;
      c.valorComAnuncioExato += p.total;
    }
  }
  const centavos = (n: number) => Math.round(n * 100) / 100;
  return { ...c, valorPago: centavos(c.valorPago), valorDeAnuncio: centavos(c.valorDeAnuncio), valorComAnuncioExato: centavos(c.valorComAnuncioExato) };
}

/** A busca da tela: número do pedido, qualquer pedaço de UTM, os nomes casados e o número do item, sem acento. */
export function filtrar(pedidos: PedidoComOrigem[], busca: string): PedidoComOrigem[] {
  const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const palavras = limpo(busca).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return pedidos;
  return pedidos.filter((p) => {
    const onde = limpo(
      // Os números dos itens entram na busca: é por eles que a tabela de campanhas manda para cá.
      [p.pedido, p.canal, p.etiqueta, p.source, p.medium, utmLegivel(p.campaign), utmLegivel(p.term), utmLegivel(p.content), p.campanhaNome, p.conjuntoNome, p.anuncioNome, p.entrada, p.status, p.campanhaId, p.conjuntoId, p.anuncioId]
        .filter(Boolean)
        .join(" "),
    );
    return palavras.every((w) => onde.includes(w));
  });
}
