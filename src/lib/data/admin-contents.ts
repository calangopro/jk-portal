import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Faq } from "@/lib/content/types";
import type { PaginaComparavel } from "@/lib/analyzer/canibalizacao";

/**
 * Acesso a conteúdo pela área administrativa. Usa a sessão da pessoa logada,
 * então a RLS do Supabase continua valendo (escrita só para equipe ativa).
 */

export type ContentRow = {
  id: string;
  type: string;
  title: string;
  slug: string;
  status: "draft" | "in_review" | "published" | "archived";
  excerpt: string | null;
  answer: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  target_query: string | null;
  search_intent: string | null;
  cluster: string | null;
  pillar_id: string | null;
  author_name: string | null;
  reviewer_name: string | null;
  author_id: string | null;
  reviewer_id: string | null;
  faqs: Faq[] | null;
  published_at: string | null;
  /** Hora marcada para entrar no ar. Nulo quando não há agendamento. */
  scheduled_at: string | null;
  /** Por que a última tentativa de publicar no horário não passou. */
  scheduled_error: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABEL: Record<ContentRow["status"], string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  published: "Publicado",
  archived: "Arquivado",
};

export async function listarConteudos(): Promise<ContentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as ContentRow[];
}

export async function obterConteudo(id: string): Promise<ContentRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ContentRow) ?? null;
}

/** Títulos publicados, usados para checar canibalização na análise com IA. */
export async function titulosPublicados(exceto?: string): Promise<string[]> {
  const supabase = await createClient();
  let q = supabase
    .from("contents")
    .select("title")
    .eq("status", "published")
    .limit(40);
  if (exceto) q = q.neq("id", exceto);
  const { data } = await q;
  return (data ?? []).map((r: { title: string }) => r.title);
}

/**
 * Todas as outras páginas, para a checagem de canibalização.
 * Vai inteira para o editor e a comparação roda no navegador, então o alerta
 * aparece enquanto a pessoa digita a consulta alvo, sem ida e volta ao servidor.
 */
export async function paginasComparaveis(exceto: string): Promise<PaginaComparavel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    // meta_title e meta_description entram para o analisador conseguir apontar
    // título e meta repetidos entre páginas, que é o micro-boilerplate descrito
    // na documentação de title link.
    .select("id, title, slug, target_query, status, meta_title, meta_description")
    .neq("id", exceto)
    .neq("status", "archived")
    .limit(300);
  return (data ?? []).map((r: {
    id: string; title: string; slug: string; target_query: string | null; status: string;
    meta_title: string | null; meta_description: string | null;
  }) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    targetQuery: r.target_query,
    status: r.status,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
  }));
}

/** Clusters já em uso, para reaproveitar o nome em vez de inventar variação. */
export async function clustersExistentes(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select("cluster")
    .not("cluster", "is", null)
    .neq("status", "archived");
  return [...new Set((data ?? []).map((r: { cluster: string }) => r.cluster))].sort();
}

export type Orfa = { id: string; title: string; slug: string };

/**
 * Páginas publicadas que ninguém cita.
 *
 * Página sem link de entrada recebe autoridade só da home e do sitemap, é a
 * última a ser rastreada e a primeira a sumir do índice. Achar isso a olho é
 * inviável a partir de umas vinte páginas, então vira relatório.
 */
export async function paginasOrfas(): Promise<Orfa[]> {
  const supabase = await createClient();

  const [{ data: publicadas }, { data: links }] = await Promise.all([
    supabase.from("contents").select("id, title, slug").eq("status", "published"),
    supabase
      .from("content_links")
      .select("source_content_id, target_content_id")
      .not("target_content_id", "is", null),
  ]);

  const idsPublicados = new Set((publicadas ?? []).map((c: Orfa) => c.id));

  // Só conta link cuja origem está no ar. A equipe enxerga também os links de
  // rascunho, e rascunho não passa autoridade nenhuma: contá-lo esconderia
  // justamente as páginas que precisam de link.
  const citadas = new Set(
    (links ?? [])
      .filter((l: { source_content_id: string }) => idsPublicados.has(l.source_content_id))
      .map((l: { target_content_id: string }) => l.target_content_id),
  );

  return (publicadas ?? []).filter((c: Orfa) => !citadas.has(c.id));
}

/**
 * Se alguma página PUBLICADA aponta para esta.
 *
 * Mesmo critério de `paginasOrfas`: link vindo de rascunho não conta, porque o
 * Google não vê rascunho, e a regra existe justamente para medir descoberta.
 */
export async function temLinkDeEntrada(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: origens } = await supabase
    .from("content_links")
    .select("source_content_id")
    .eq("target_content_id", id);

  const ids = [
    ...new Set(
      (origens ?? [])
        .map((r: { source_content_id: string | null }) => r.source_content_id)
        .filter((v): v is string => Boolean(v) && v !== id),
    ),
  ];
  if (ids.length === 0) return false;

  // Duas consultas em vez de um join por nome de chave estrangeira: o nome da
  // constraint é detalhe do banco, e usá-lo aqui quebraria silenciosamente numa
  // migration futura que a renomeasse.
  const { count } = await supabase
    .from("contents")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .eq("status", "published");

  return (count ?? 0) > 0;
}

/** Pessoas cadastradas, para o seletor de autor e revisor do editor. */
export type OpcaoDeAutor = { id: string; name: string; slug: string };

export async function opcoesDeAutor(): Promise<OpcaoDeAutor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("authors")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as OpcaoDeAutor[];
}

/** Gera slug a partir do título: minúsculas, sem acento, com hífen. */
export function gerarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Garante que o slug não colide com outro conteúdo. */
export async function slugDisponivel(slug: string, exceto?: string): Promise<string> {
  const supabase = await createClient();
  let base = slug || "sem-titulo";
  let tentativa = base;
  for (let i = 2; i < 50; i++) {
    let q = supabase.from("contents").select("id").eq("slug", tentativa).limit(1);
    if (exceto) q = q.neq("id", exceto);
    const { data } = await q;
    if (!data || data.length === 0) return tentativa;
    tentativa = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}
