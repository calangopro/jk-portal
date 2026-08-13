"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { normalizarTema } from "@/lib/tema/tipos";
import { mensagemDeReprovacao, reprovados } from "@/lib/tema/contraste";
import { TAG_TEMA } from "@/lib/tema/ler";

export type ResultadoAparencia = { ok: true } | { ok: false; erro: string };

/**
 * Grava a aparência do site.
 *
 * A checagem de contraste roda AQUI, e não só no formulário. Trava que existe
 * apenas no navegador é enfeite: basta uma aba antiga, um erro de JavaScript ou
 * uma chamada direta para passar por cima. O formulário avisa cedo, este
 * ponto é o que decide.
 */
export async function salvarAparencia(bruto: unknown): Promise<ResultadoAparencia> {
  const perfil = await requireAdmin();

  // `normalizarTema` descarta chave desconhecida e recusa valor fora do
  // formato, então o que chega ao banco já está limpo.
  const tema = normalizarTema(bruto);

  const ruins = reprovados(tema.cores);
  if (ruins.length > 0) return { ok: false, erro: mensagemDeReprovacao(ruins) };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: "tema",
      value: tema as unknown as Record<string, unknown>,
      updated_by: perfil.id,
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, erro: error.message };

  // A tag derruba o dado cacheado; o caminho derruba o HTML já renderizado.
  // Os dois são necessários: só a tag deixaria o Next servir a página antiga
  // enquanto o ISR de uma hora não expirasse.
  revalidateTag(TAG_TEMA);
  revalidatePath("/", "layout");

  return { ok: true };
}
