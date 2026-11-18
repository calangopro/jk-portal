import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BALDE_DAS_SUGESTOES, lerRoadmap, type Roadmap, type Sugestao } from "./sugestoes";

/** Uma hora: o bastante para olhar o roadmap com calma, curto se o link vazar. */
const VALIDADE_DO_LINK_S = 3600;

export type SugestaoNaTela = Omit<Sugestao, "imagens"> & { imagens: { caminho: string; url: string }[] };
export type RoadmapNaTela = Omit<Roadmap, "itens"> & { itens: SugestaoNaTela[] };

/**
 * O roadmap como a pessoa pode ver (`sugestoes_lista`, 0140, que confere o
 * acesso por dentro) e os prints com link assinado. Só se assina o caminho que
 * a função devolveu, ou seja, o de uma sugestão que a pessoa pode ver. `null`
 * quando a leitura falhou.
 */
export async function lerRoadmapDaTela(db: SupabaseClient): Promise<RoadmapNaTela | null> {
  const { data, error } = await db.rpc("sugestoes_lista");
  if (error) {
    console.error("[sugestoes] sugestoes_lista:", error.message);
    return null;
  }
  const roadmap = lerRoadmap(data);
  if (!roadmap) return null;

  const caminhos = [...new Set(roadmap.itens.flatMap((s) => s.imagens))];
  const links = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinados, error: erroAoAssinar } = await createAdminClient()
      .storage.from(BALDE_DAS_SUGESTOES)
      .createSignedUrls(caminhos, VALIDADE_DO_LINK_S);
    if (erroAoAssinar) console.error("[sugestoes] links dos prints:", erroAoAssinar.message);
    for (const a of assinados ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
  }
  return {
    ...roadmap,
    itens: roadmap.itens.map((s) => ({
      ...s,
      imagens: s.imagens.flatMap((caminho) => (links.has(caminho) ? [{ caminho, url: links.get(caminho) as string }] : [])),
    })),
  };
}
