import { createReadClient } from "@/lib/supabase/read";
import type { Content, Faq, Imagem } from "@/lib/content/types";
import { SAMPLE_GUIAS } from "./samples";
import { podeUsarExemplos, registrarFalha } from "./exemplos";
import { mapaDeAutores } from "./autores";

type Row = {
  id: string;
  type: Content["type"];
  title: string;
  slug: string;
  search_intent: string | null;
  status: Content["status"];
  author_name: string | null;
  reviewer_name: string | null;
  author_id: string | null;
  reviewer_id: string | null;
  canonical_url: string | null;
  excerpt: string | null;
  answer: string | null;
  body_md: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  faqs: Faq[] | null;
  cluster: string | null;
  published_at: string | null;
  updated_at: string | null;
};

function mapRow(r: Row): Content {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    slug: r.slug,
    cluster: r.cluster,
    searchIntent: r.search_intent,
    status: r.status,
    authorName: r.author_name,
    reviewerName: r.reviewer_name,
    canonicalUrl: r.canonical_url,
    excerpt: r.excerpt,
    answer: r.answer,
    bodyMd: r.body_md,
    bodyHtml: r.body_html,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    ogImageUrl: r.og_image_url,
    faqs: r.faqs,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Guias e artigos publicados.
 *
 * Banco vazio devolve lista vazia, e a página mostra estado vazio de verdade.
 * Erro é registrado e também devolve vazio, nunca conteúdo de exemplo em
 * produção. Exemplo é conveniência de desenvolvimento (ver ./exemplos.ts).
 */
export async function getPublishedGuias(): Promise<Content[]> {
  const supabase = createReadClient();
  if (!supabase) {
    registrarFalha("getPublishedGuias", "cliente do Supabase indisponível");
    return podeUsarExemplos() ? SAMPLE_GUIAS : [];
  }

  try {
    const { data, error } = await supabase
      .from("contents")
      .select("*")
      .in("type", ["guia", "artigo"])
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      registrarFalha("getPublishedGuias", error.message);
      return podeUsarExemplos() ? SAMPLE_GUIAS : [];
    }
    if (!data || data.length === 0) {
      return podeUsarExemplos() ? SAMPLE_GUIAS : [];
    }
    return (data as Row[]).map(mapRow);
  } catch (e) {
    registrarFalha("getPublishedGuias", e);
    return podeUsarExemplos() ? SAMPLE_GUIAS : [];
  }
}

/**
 * Um guia pelo slug. Não encontrado devolve null, o que vira 404.
 *
 * Isto também conserta um efeito ruim do fallback antigo: abrir a URL de um
 * rascunho mostrava conteúdo de exemplo, em vez de dizer que não existe.
 */
export async function getGuiaBySlug(slug: string): Promise<Content | null> {
  const exemplo = () =>
    podeUsarExemplos() ? (SAMPLE_GUIAS.find((g) => g.slug === slug) ?? null) : null;

  const supabase = createReadClient();
  if (!supabase) {
    registrarFalha("getGuiaBySlug", "cliente do Supabase indisponível");
    return exemplo();
  }

  try {
    const { data, error } = await supabase
      .from("contents")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      registrarFalha("getGuiaBySlug", error.message);
      return exemplo();
    }
    if (!data) return exemplo();
    return mapRow(data as Row);
  } catch (e) {
    registrarFalha("getGuiaBySlug", e);
    return exemplo();
  }
}

/**
 * Relacionados de verdade, tirados do grafo de links.
 *
 * Antes a coluna lateral mostrava os quatro guias mais recentes, que não têm
 * relação nenhuma com o que a pessoa está lendo. Aqui entram as páginas que
 * este conteúdo cita e as que citam ele, que é o que define assunto vizinho
 * tanto para quem lê quanto para o Google.
 */
export async function relacionadosPorGrafo(
  contentId: string,
  cluster?: string | null,
  limite = 4,
): Promise<Content[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const [saida, entrada] = await Promise.all([
      supabase.from("content_links").select("target_content_id").eq("source_content_id", contentId),
      supabase.from("content_links").select("source_content_id").eq("target_content_id", contentId),
    ]);

    const ids = [
      ...(saida.data ?? []).map((r: { target_content_id: string | null }) => r.target_content_id),
      ...(entrada.data ?? []).map((r: { source_content_id: string }) => r.source_content_id),
    ].filter((id): id is string => Boolean(id) && id !== contentId);

    const doGrafo = ids.length
      ? ((
          await supabase
            .from("contents")
            .select("*")
            .in("id", [...new Set(ids)])
            .eq("status", "published")
            .limit(limite)
        ).data ?? []).map((r) => mapRow(r as Row))
      : [];

    if (doGrafo.length >= limite || !cluster) return doGrafo;

    // Faltou vizinho no grafo. As páginas do mesmo cluster completam, porque
    // pertencer ao mesmo assunto já é uma relação declarada, mesmo que ninguém
    // tenha criado o link ainda.
    const jaTem = new Set([contentId, ...doGrafo.map((c) => c.id)]);
    const { data: doCluster } = await supabase
      .from("contents")
      .select("*")
      .eq("cluster", cluster)
      .eq("status", "published")
      .limit(limite + jaTem.size);

    const extras = (doCluster ?? [])
      .map((r) => mapRow(r as Row))
      .filter((c) => !jaTem.has(c.id));

    return [...doGrafo, ...extras].slice(0, limite);
  } catch (e) {
    registrarFalha("relacionadosPorGrafo", e);
    return [];
  }
}

/**
 * Um conteúdo pelo id, em qualquer status. Só para o preview de rascunho, que
 * precisa mostrar o que ainda não está no ar. Nunca cai em dados de exemplo:
 * preview que inventa conteúdo não serve para conferir nada.
 */
export async function getConteudoPorId(id: string): Promise<Content | null> {
  // Cliente admin porque a RLS só devolve publicado ao cliente de leitura, e
  // rascunho é justamente o que o preview existe para mostrar. Quem autoriza
  // aqui é o token assinado da rota, conferido antes de chamar isto.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Row);
}

/**
 * Produtos ligados a um conteúdo, para emitir schema com dado real.
 * Retorna vazio quando não há vínculo ou quando o catálogo não foi
 * sincronizado, e nesse caso nenhum schema de produto é emitido.
 */
export async function produtosDoConteudo(contentId: string): Promise<
  {
    name: string;
    url: string | null;
    image: string | null;
    description: string | null;
    brand: string | null;
    price: number | null;
    disponivel: boolean;
  }[]
> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("content_products")
      .select("products(name, url, main_image_url, description, brand, status, is_active)")
      .eq("content_id", contentId)
      .limit(12);

    if (error || !data) return [];

    type Linha = {
      products: {
        name: string;
        url: string | null;
        main_image_url: string | null;
        description: string | null;
        brand: string | null;
        status: string | null;
        is_active: boolean;
      } | null;
    };

    return (data as unknown as Linha[])
      .map((l) => l.products)
      .filter((p): p is NonNullable<Linha["products"]> => !!p && p.is_active)
      .map((p) => ({
        name: p.name,
        url: p.url,
        image: p.main_image_url,
        description: p.description,
        brand: p.brand,
        // Preço fica na variação e é espelho da Tray. Sem certeza, não entra.
        price: null,
        disponivel: p.status === "available",
      }));
  } catch {
    return [];
  }
}

/**
 * Dimensões das imagens, vindas da tabela `media`.
 *
 * Serve para escrever `width` e `height` na tag mesmo em conteúdo antigo, que
 * foi salvo antes de o editor passar a gravar isso. Sem dimensão o navegador
 * não reserva espaço e a página pula quando a imagem carrega.
 *
 * Devolve array, e não `Map`, de propósito: o Data Cache do Next **não
 * serializa `Map`**, então uma leitura cacheada que devolvesse `Map` voltaria
 * vazia sem erro nenhum. Quem precisa de acesso por chave usa `mapaDeDimensoes`.
 */
export type DimensaoDeImagem = { url: string; width: number; height: number };

/** URLs absolutas das imagens de um HTML, sem repetição. */
export function urlsDeImagem(html: string): string[] {
  if (!html) return [];
  const urls = [...html.matchAll(/<img\b[^>]*src\s*=\s*"([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((u) => u.startsWith("http"));
  return [...new Set(urls)];
}

export async function dimensoesDasImagens(
  urls: string[],
): Promise<DimensaoDeImagem[]> {
  if (urls.length === 0) return [];

  const supabase = createReadClient();
  if (!supabase) return [];

  const achadas: DimensaoDeImagem[] = [];
  try {
    const { data } = await supabase
      .from("media")
      .select("url, width, height")
      .in("url", [...new Set(urls)]);

    for (const m of (data ?? []) as { url: string; width: number | null; height: number | null }[]) {
      if (m.url && m.width && m.height) {
        achadas.push({ url: m.url, width: m.width, height: m.height });
      }
    }
  } catch {
    // Sem as medidas a página continua funcionando, só sem reservar o espaço.
  }

  return achadas;
}

/** Dimensões das imagens de um HTML, indexadas por URL. */
export async function mapaDeDimensoes(
  html: string,
): Promise<Map<string, { width: number; height: number }>> {
  const lista = await dimensoesDasImagens(urlsDeImagem(html));
  return new Map(lista.map((d) => [d.url, { width: d.width, height: d.height }]));
}

/** Capa de um conteúdo, junto do id de quem ela ilustra. */
export type CapaDeConteudo = { contentId: string; imagem: Imagem };

/**
 * Capas dos conteúdos, em uma consulta só.
 *
 * A infraestrutura já existia parada desde a migration 0004: `content_media`
 * com `role = 'hero'` mais os campos de SEO da tabela `media`. Faltava alguém
 * ler. Recebe vários ids de uma vez para a listagem de guias não disparar uma
 * consulta por card.
 *
 * Devolve array pelo mesmo motivo de `dimensoesDasImagens`: `Map` não
 * atravessa o Data Cache. O acesso por chave fica em `mapaDeCapas`.
 */
export async function capasDosConteudos(
  contentIds: string[],
): Promise<CapaDeConteudo[]> {
  const ids = [...new Set(contentIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = createReadClient();
  if (!supabase) return [];

  const capas: CapaDeConteudo[] = [];
  const jaTem = new Set<string>();

  type Vinculo = {
    content_id: string;
    alt_override: string | null;
    caption_override: string | null;
    media: {
      id: string;
      url: string | null;
      alt: string | null;
      caption: string | null;
      credit: string | null;
      width: number | null;
      height: number | null;
      placeholder: string | null;
      focal_x: number | null;
      focal_y: number | null;
      deactivated_at: string | null;
    } | null;
  };

  try {
    const { data, error } = await supabase
      .from("content_media")
      .select(
        "content_id, alt_override, caption_override, media:media_id (id, url, alt, caption, credit, width, height, placeholder, focal_x, focal_y, deactivated_at)",
      )
      .eq("role", "hero")
      .in("content_id", ids)
      .order("position", { ascending: true });

    if (error) {
      registrarFalha("capasDosConteudos", error.message);
      return capas;
    }

    for (const v of (data ?? []) as unknown as Vinculo[]) {
      const m = v.media;
      // Sem URL, sem dimensão ou desativada, a capa não entra: metade de uma
      // imagem na tela é pior que nenhuma.
      if (!m || !m.url || !m.width || !m.height || m.deactivated_at) continue;
      if (jaTem.has(v.content_id)) continue;
      jaTem.add(v.content_id);

      capas.push({
        contentId: v.content_id,
        imagem: {
          id: m.id,
          url: m.url,
          alt: v.alt_override ?? m.alt ?? "",
          width: m.width,
          height: m.height,
          caption: v.caption_override ?? m.caption,
          credit: m.credit,
          placeholder: m.placeholder,
          focalX: m.focal_x,
          focalY: m.focal_y,
        },
      });
    }
  } catch (e) {
    registrarFalha("capasDosConteudos", e);
  }

  return capas;
}

/** Capas indexadas por id do conteúdo. */
export async function mapaDeCapas(contentIds: string[]): Promise<Map<string, Imagem>> {
  const lista = await capasDosConteudos(contentIds);
  return new Map(lista.map((c) => [c.contentId, c.imagem]));
}

/** Capa de um conteúdo só. Atalho para `capasDosConteudos`. */
export async function capaDoConteudo(contentId: string): Promise<Imagem | null> {
  const [capa] = await capasDosConteudos([contentId]);
  return capa?.imagem ?? null;
}

/**
 * Preenche `autor` e `revisor` a partir das FKs.
 *
 * Fica separado de `mapRow` porque exige uma segunda consulta, e nem toda tela
 * precisa da pessoa (a lista do admin, por exemplo, não precisa). Uma consulta
 * só para a lista inteira, nunca uma por item.
 */
export async function comAutores(conteudos: Content[]): Promise<Content[]> {
  if (conteudos.length === 0) return conteudos;

  const supabase = createReadClient();
  if (!supabase) return conteudos;

  try {
    const { data } = await supabase
      .from("contents")
      .select("id, author_id, reviewer_id")
      .in("id", conteudos.map((c) => c.id));

    const fks = new Map(
      ((data ?? []) as { id: string; author_id: string | null; reviewer_id: string | null }[])
        .map((r) => [r.id, r]),
    );

    const idsDePessoa = [
      ...new Set(
        [...fks.values()].flatMap((r) => [r.author_id, r.reviewer_id]).filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    if (!idsDePessoa.length) return conteudos;

    const pessoas = await mapaDeAutores(idsDePessoa);

    return conteudos.map((c) => {
      const fk = fks.get(c.id);
      if (!fk) return c;
      return {
        ...c,
        autor: fk.author_id ? (pessoas.get(fk.author_id) ?? null) : null,
        revisor: fk.reviewer_id ? (pessoas.get(fk.reviewer_id) ?? null) : null,
      };
    });
  } catch (e) {
    registrarFalha("comAutores", e);
    return conteudos;
  }
}

/** Preenche `capa` numa lista de conteúdos, sem uma consulta por item. */
export async function comCapas(conteudos: Content[]): Promise<Content[]> {
  if (conteudos.length === 0) return conteudos;
  const capas = await mapaDeCapas(conteudos.map((c) => c.id));
  if (capas.size === 0) return conteudos;
  return conteudos.map((c) => ({ ...c, capa: capas.get(c.id) ?? null }));
}
