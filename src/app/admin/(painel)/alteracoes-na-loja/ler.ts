import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITE, type Linha } from "./Tela";

/**
 * As alterações mais recentes, com o nome de quem fez. Mora fora do `page.tsx`
 * porque arquivo de página do Next só aceita exportar a página.
 */
export async function lerAlteracoes(db: SupabaseClient): Promise<{ linhas: Linha[]; nomes: Record<string, string>; erro: boolean }> {
  const { data, error } = await db
    .from("loja_alteracoes")
    .select("id, feita_em, feita_por, loja, recurso, recurso_id, rotulo, antes, depois, resultado, erro")
    .order("feita_em", { ascending: false })
    .limit(LIMITE);
  const linhas = (data ?? []) as Linha[];

  // O nome de quem fez vem numa segunda consulta: uma só, para todas as linhas.
  const pessoas = Array.from(new Set(linhas.map((l) => l.feita_por).filter(Boolean))) as string[];
  const nomes: Record<string, string> = {};
  if (pessoas.length) {
    const { data: perfis } = await db.from("profiles").select("id, full_name, email").in("id", pessoas);
    for (const p of perfis ?? []) nomes[p.id as string] = (p.full_name as string | null) || (p.email as string | null) || "Alguém da equipe";
  }
  return { linhas, nomes, erro: Boolean(error) };
}
