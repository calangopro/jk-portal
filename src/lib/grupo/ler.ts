import "server-only";
import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { normalizarGrupo, type ConfigDoGrupo } from "./tipos";

export const TAG_GRUPO = "grupo";

/**
 * A configuração gravada em `site_settings`, chave `pagina:grupo`.
 *
 * Mesma regra de `lerBio`: no cache entra só a resposta crua do banco, e o
 * padrão do código é aplicado fora, em `normalizarGrupo`.
 */
const lerValorCacheado = unstable_cache(
  async (): Promise<unknown> => {
    const supabase = createReadClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pagina:grupo")
        .maybeSingle();
      if (error || !data) return null;
      return data.value;
    } catch {
      return null;
    }
  },
  ["grupo-gravado", "v1"],
  { tags: [TAG_GRUPO], revalidate: false },
);

export async function lerGrupo(): Promise<ConfigDoGrupo> {
  return normalizarGrupo(await lerValorCacheado());
}
