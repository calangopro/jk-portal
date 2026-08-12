import { createReadClient } from "@/lib/supabase/read";

export type Comentario = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId: string | null;
};

/** Comentários aprovados de um conteúdo publicado, em ordem de chegada. */
export async function comentariosAprovados(contentId: string): Promise<Comentario[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id, author_name, body, created_at, parent_id")
      .eq("content_id", contentId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error || !data) return [];

    return data.map((c: {
      id: string; author_name: string; body: string; created_at: string; parent_id: string | null;
    }) => ({
      id: c.id,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at,
      parentId: c.parent_id,
    }));
  } catch {
    return [];
  }
}
