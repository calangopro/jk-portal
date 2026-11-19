/**
 * A origem do negócio da Kommo até o anúncio (cartão 48, migration 0170).
 *
 * O anúncio de clique para WhatsApp do Meta não passa pelo site, então a UTM
 * não existe. O que o Meta entrega à Kommo são os números do anúncio, do
 * conjunto e da campanha, e o espelho já guarda os três em coluna. Aqui mora:
 *
 *   - `anuncioDoNegocio`: a regra de ligação, a MESMA de
 *     `kommo_anuncio_dos_negocios` (0170). Pelo número, nunca por nome nem
 *     palpite: mudou uma, muda a outra;
 *   - `origemDoNegocio`: a palavra que filtra a tela de Origem;
 *   - a leitura das duas funções do banco e o custo por conversa e por venda.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type NivelDoItem = "campanha" | "conjunto" | "anuncio";

/** Os campos de rastreio do negócio, como estão em `kommo_negocios`. */
export type RastreioDoNegocio = {
  meta_ad_id?: string | null;
  ad_id?: string | null;
  meta_adset_id?: string | null;
  meta_campaign_id?: string | null;
  utm_id?: string | null;
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
};

/** Um item de `anuncios_itens`, com a campanha e o conjunto mais recentes. */
export type ItemDoCatalogo = {
  plataforma: string;
  nivel: NivelDoItem;
  id: string;
  campanha_id: string | null;
  conjunto_id: string | null;
};

export type Ligacao = {
  plataforma: string;
  campanhaId: string | null;
  conjuntoId: string | null;
  anuncioId: string | null;
  ligadoPor: NivelDoItem;
};

const digitos = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/\D/g, "");
  return s || null;
};
const numeroInteiro = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return /^\d{6,}$/.test(s) ? s : null;
};

/**
 * O item em que o negócio cai, ou `null`.
 *
 * Ordem: o anúncio (`meta_ad_id`, depois `ad_id`), o conjunto
 * (`meta_adset_id`) e a campanha (`meta_campaign_id`, `utm_id`, `utm_campaign`
 * só quando é número). Achou o anúncio, a campanha e o conjunto são os DELE.
 * Número que existe em duas plataformas no mesmo nível é ambíguo e não liga.
 */
export function anuncioDoNegocio(n: RastreioDoNegocio, catalogo: ItemDoCatalogo[]): Ligacao | null {
  const achar = (nivel: NivelDoItem, id: string | null) => {
    if (!id) return null;
    const achados = catalogo.filter((c) => c.nivel === nivel && c.id === id);
    return achados.length === 1 ? achados[0] : null;
  };
  const anuncio = achar("anuncio", digitos(n.meta_ad_id)) ?? achar("anuncio", digitos(n.ad_id));
  if (anuncio) {
    return { plataforma: anuncio.plataforma, campanhaId: anuncio.campanha_id, conjuntoId: anuncio.conjunto_id, anuncioId: anuncio.id, ligadoPor: "anuncio" };
  }
  const conjunto = achar("conjunto", digitos(n.meta_adset_id));
  if (conjunto) {
    return { plataforma: conjunto.plataforma, campanhaId: conjunto.campanha_id, conjuntoId: conjunto.id, anuncioId: null, ligadoPor: "conjunto" };
  }
  const campanha =
    achar("campanha", digitos(n.meta_campaign_id)) ?? achar("campanha", numeroInteiro(n.utm_id)) ?? achar("campanha", numeroInteiro(n.utm_campaign));
  if (campanha) {
    return { plataforma: campanha.plataforma, campanhaId: campanha.id, conjuntoId: null, anuncioId: null, ligadoPor: "campanha" };
  }
  return null;
}

export type OrigemDoNegocio = "anuncio" | "id_sem_casar" | "utm" | "codigo" | "sem_origem";

export const ORIGENS_DO_NEGOCIO: OrigemDoNegocio[] = ["anuncio", "id_sem_casar", "utm", "codigo", "sem_origem"];

export const NOME_DA_ORIGEM: Record<OrigemDoNegocio, string> = {
  anuncio: "Anúncio",
  id_sem_casar: "Anúncio não reconhecido",
  utm: "UTM",
  codigo: "Código do site",
  sem_origem: "Sem origem",
};

const cheio = (v: string | null | undefined) => (v ?? "").trim() !== "";

/**
 * A palavra que filtra a tela de Origem. Mesma ordem da 0170: ligado a um
 * item; com número de anúncio que não está em `anuncios_itens`; com UTM ou
 * clique de anúncio; sem nada. "Código do site" ainda não existe (ver
 * docs/kommo.md, fase 4): nenhum negócio cai nele.
 */
export function origemDoNegocio(n: RastreioDoNegocio, ligacao: Ligacao | null): OrigemDoNegocio {
  if (ligacao) return "anuncio";
  if (cheio(n.meta_ad_id) || cheio(n.ad_id) || cheio(n.meta_adset_id) || cheio(n.meta_campaign_id)) return "id_sem_casar";
  if (cheio(n.utm_source) || cheio(n.utm_campaign) || cheio(n.utm_medium) || cheio(n.gclid) || cheio(n.fbclid)) return "utm";
  return "sem_origem";
}

// ---------------------------------------------------------------------------
// Campanhas: conversas e vendas do WhatsApp por item
// ---------------------------------------------------------------------------

export type WhatsDoItem = {
  /** Negócios criados no período ligados ao item. */
  conversas: number;
  /** Negócios ganhos no período, fora os que já contam na loja pela UTM. */
  vendas: number;
  /** O valor desses negócios ganhos, como está na Kommo. */
  valor: number;
  /** Ganhos cujo pedido da loja já está ligado a anúncio pela UTM: contam lá, não aqui. */
  vendasNaLoja: number;
};

export type CoberturaDoWhats = {
  conversas: number;
  conversasComId: number;
  conversasLigadas: number;
  conversasLigadasAoAnuncio: number;
  vendas: number;
  vendasLigadas: number;
  valorLigado: number;
  vendasNaLoja: number;
};

export type WhatsDasCampanhas = {
  lidoEm: string | null;
  cobertura: CoberturaDoWhats;
  /** Por `nivel:id`, a mesma chave da venda da loja (`chaveDoItem`). */
  itens: Record<string, WhatsDoItem>;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const duasCasas = (n: number) => Math.round(n * 100) / 100;

/** A resposta de `kommo_whats_por_anuncio`. `null` (sem acesso ou falha) vira `null`. */
export function lerWhatsDasCampanhas(data: unknown): WhatsDasCampanhas | null {
  if (!data || typeof data !== "object") return null;
  const r = data as { lido_em?: string | null; cobertura?: Record<string, unknown>; por_item?: Record<string, unknown>[] };
  const c = r.cobertura ?? {};
  const itens: Record<string, WhatsDoItem> = {};
  for (const i of r.por_item ?? []) {
    itens[`${String(i.nivel)}:${String(i.id)}`] = {
      conversas: num(i.conversas),
      vendas: num(i.vendas),
      valor: duasCasas(num(i.valor)),
      vendasNaLoja: num(i.vendas_na_loja),
    };
  }
  return {
    lidoEm: r.lido_em ?? null,
    cobertura: {
      conversas: num(c.conversas),
      conversasComId: num(c.conversas_com_id),
      conversasLigadas: num(c.conversas_ligadas),
      conversasLigadasAoAnuncio: num(c.conversas_ligadas_ao_anuncio),
      vendas: num(c.vendas),
      vendasLigadas: num(c.vendas_ligadas),
      valorLigado: duasCasas(num(c.valor_ligado)),
      vendasNaLoja: num(c.vendas_na_loja),
    },
    itens,
  };
}

/** Gasto dividido pela quantidade. Sem gasto ou sem quantidade, não há custo. */
export function custoPor(gasto: number, quantidade: number): number | null {
  if (!(gasto > 0) || !(quantidade > 0)) return null;
  return duasCasas(gasto / quantidade);
}

// ---------------------------------------------------------------------------
// Origem: os negócios por origem
// ---------------------------------------------------------------------------

export type NegocioComOrigem = {
  id: number;
  criadoEm: string | null;
  funil: string | null;
  etapa: string | null;
  fase: string | null;
  ganho: boolean;
  valor: number;
  origem: OrigemDoNegocio;
  plataforma: string | null;
  ligadoPor: NivelDoItem | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  campanhaId: string | null;
  conjuntoId: string | null;
  anuncioId: string | null;
  idMeta: string | null;
  utm: string | null;
  link: string;
};

export type ContagemDaOrigem = { negocios: number; ganhos: number; valor: number };

export type NegociosPorOrigem = {
  lidoEm: string | null;
  porOrigem: Record<OrigemDoNegocio, ContagemDaOrigem>;
  lista: NegocioComOrigem[];
  total: number;
};

const texto = (v: unknown) => (v == null || v === "" ? null : String(v));
const ehOrigem = (v: unknown): v is OrigemDoNegocio => ORIGENS_DO_NEGOCIO.includes(v as OrigemDoNegocio);
const ehNivel = (v: unknown): v is NivelDoItem => v === "campanha" || v === "conjunto" || v === "anuncio";

/** A resposta de `kommo_negocios_por_origem`. */
export function lerNegociosPorOrigem(data: unknown): NegociosPorOrigem | null {
  if (!data || typeof data !== "object") return null;
  const r = data as { lido_em?: string | null; por_origem?: Record<string, Record<string, unknown>>; lista?: Record<string, unknown>[] };
  const porOrigem = Object.fromEntries(
    ORIGENS_DO_NEGOCIO.map((o) => {
      const c = r.por_origem?.[o];
      return [o, { negocios: num(c?.negocios), ganhos: num(c?.ganhos), valor: duasCasas(num(c?.valor)) }];
    }),
  ) as Record<OrigemDoNegocio, ContagemDaOrigem>;
  const lista = (r.lista ?? []).map((n): NegocioComOrigem => {
    const utm = [texto(n.utm_source), texto(n.utm_medium), texto(n.utm_campaign)].filter(Boolean).join(" / ");
    return {
      id: num(n.id),
      criadoEm: texto(n.criado_em),
      funil: texto(n.funil),
      etapa: texto(n.etapa),
      fase: texto(n.fase),
      ganho: n.ganho === true,
      valor: duasCasas(num(n.valor)),
      origem: ehOrigem(n.origem) ? n.origem : "sem_origem",
      plataforma: texto(n.plataforma),
      ligadoPor: ehNivel(n.ligado_por) ? n.ligado_por : null,
      campanha: texto(n.campanha),
      conjunto: texto(n.conjunto),
      anuncio: texto(n.anuncio),
      campanhaId: texto(n.campanha_id),
      conjuntoId: texto(n.conjunto_id),
      anuncioId: texto(n.anuncio_id),
      idMeta: texto(n.id_meta),
      utm: utm || null,
      link: texto(n.link) ?? "",
    };
  });
  return {
    lidoEm: r.lido_em ?? null,
    porOrigem,
    lista,
    total: ORIGENS_DO_NEGOCIO.reduce((s, o) => s + porOrigem[o].negocios, 0),
  };
}

/** Como o negócio foi ligado, em frase, para a lista. */
export function comoLigouONegocio(n: Pick<NegocioComOrigem, "origem" | "ligadoPor" | "idMeta" | "utm">): string {
  switch (n.origem) {
    case "anuncio":
      return n.ligadoPor === "anuncio"
        ? "Ligado ao anúncio exato pelo número que o Meta mandou à Kommo."
        : n.ligadoPor === "conjunto"
          ? "Ligado ao conjunto pelo número: o do anúncio não está entre os lidos do Meta."
          : "Ligado só à campanha pelo número.";
    case "id_sem_casar":
      return `Chegou com ${n.idMeta ? `o número ${n.idMeta}` : "número de anúncio"}, que não está entre as campanhas, conjuntos e anúncios lidos.`;
    case "utm":
      return `Chegou com UTM (${n.utm ?? "clique de anúncio"}), sem número de anúncio que case.`;
    case "codigo":
      return "Ligado ao visitante do site pelo código da mensagem.";
    default:
      return "Sem número de anúncio, UTM nem código.";
  }
}
