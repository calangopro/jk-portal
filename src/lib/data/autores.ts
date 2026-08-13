import { createReadClient } from "@/lib/supabase/read";
import type { Autor, Content, Imagem } from "@/lib/content/types";
import { registrarFalha } from "./exemplos";

/**
 * Leitura dos autores.
 *
 * Alimenta três coisas: a assinatura visível no guia, a página /autor/[slug] e
 * o `author.url` do JSON-LD de Article. As três precisam concordar, então todas
 * saem daqui.
 */

type LinhaAutor = {
  id: string;
  slug: string;
  name: string;
  job_title: string | null;
  credentials: string | null;
  bio: string | null;
  same_as: string[] | null;
  is_active: boolean;
  foto: {
    id: string;
    url: string | null;
    alt: string | null;
    width: number | null;
    height: number | null;
    placeholder: string | null;
    deactivated_at: string | null;
  } | null;
};

const CAMPOS =
  "id, slug, name, job_title, credentials, bio, same_as, is_active, " +
  "foto:photo_media_id (id, url, alt, width, height, placeholder, deactivated_at)";

function mapAutor(r: LinhaAutor): Autor {
  const f = r.foto;
  // Foto sem dimensão não entra: metade de uma imagem é pior que nenhuma, e
  // sem width/height o retrato causa salto de layout.
  const foto: Imagem | null =
    f && f.url && f.width && f.height && !f.deactivated_at
      ? {
          id: f.id,
          url: f.url,
          alt: f.alt ?? `Retrato de ${r.name}`,
          width: f.width,
          height: f.height,
          placeholder: f.placeholder,
        }
      : null;

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    jobTitle: r.job_title,
    credentials: r.credentials,
    bio: r.bio,
    foto,
    sameAs: (r.same_as ?? []).filter(Boolean),
    isActive: r.is_active,
  };
}

/** Autores ativos, para listagem e para o sitemap. */
export async function autoresAtivos(): Promise<Autor[]> {
  const supabase = createReadClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("authors")
      .select(CAMPOS)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) {
      registrarFalha("autoresAtivos", error.message);
      return [];
    }
    return ((data ?? []) as unknown as LinhaAutor[]).map(mapAutor);
  } catch (e) {
    registrarFalha("autoresAtivos", e);
    return [];
  }
}

export async function autorPorSlug(slug: string): Promise<Autor | null> {
  const supabase = createReadClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("authors")
      .select(CAMPOS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return mapAutor(data as unknown as LinhaAutor);
  } catch (e) {
    registrarFalha("autorPorSlug", e);
    return null;
  }
}

/**
 * Autor e revisor de vários conteúdos de uma vez.
 *
 * Em lote para a listagem de guias não disparar duas consultas por card.
 *
 * Devolve array porque o Data Cache do Next não serializa `Map`. O acesso por
 * chave fica em `mapaDeAutores`.
 */
export async function autoresDosConteudos(ids: string[]): Promise<Autor[]> {
  const limpos = [...new Set(ids.filter(Boolean))];
  if (!limpos.length) return [];

  const supabase = createReadClient();
  if (!supabase) return [];

  const pessoas: Autor[] = [];
  try {
    const { data, error } = await supabase
      .from("authors")
      .select(CAMPOS)
      .in("id", limpos);
    if (error) {
      registrarFalha("autoresDosConteudos", error.message);
      return pessoas;
    }
    for (const linha of (data ?? []) as unknown as LinhaAutor[]) {
      pessoas.push(mapAutor(linha));
    }
  } catch (e) {
    registrarFalha("autoresDosConteudos", e);
  }
  return pessoas;
}

/** Autores indexados por id. */
export async function mapaDeAutores(ids: string[]): Promise<Map<string, Autor>> {
  const pessoas = await autoresDosConteudos(ids);
  return new Map(pessoas.map((a) => [a.id, a]));
}

/** Guias publicados que uma pessoa assina, para a página dela. */
export async function conteudosDoAutor(
  autorId: string,
  limite = 30,
): Promise<Pick<Content, "id" | "title" | "slug" | "excerpt" | "publishedAt">[]> {
  const supabase = createReadClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("contents")
      .select("id, title, slug, excerpt, published_at")
      .eq("author_id", autorId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limite);
    if (error) {
      registrarFalha("conteudosDoAutor", error.message);
      return [];
    }
    return (data ?? []).map(
      (r: {
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        published_at: string | null;
      }) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        publishedAt: r.published_at,
      }),
    );
  } catch (e) {
    registrarFalha("conteudosDoAutor", e);
    return [];
  }
}
