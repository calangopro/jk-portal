import "server-only";
import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { normalizarBio, type Bio } from "./tipos";

export const TAG_BIO = "bio";

/**
 * A bio gravada em `site_settings`, na chave `pagina:bio`.
 *
 * Mesma regra de `lerLayout` (lib/blocos/ler.ts), que já custou horas de "não
 * mudou nada": o que entra no cache é só a resposta CRUA do banco, `null`
 * incluído. A bio de fábrica é aplicada fora, em `normalizarBio`, então texto
 * que mora no código passa a valer na hora.
 */
const lerValorCacheado = unstable_cache(
  async (): Promise<unknown> => {
    const supabase = createReadClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pagina:bio")
        .maybeSingle();
      if (error || !data) return null;
      return data.value;
    } catch {
      return null;
    }
  },
  ["bio-gravada", "v1"],
  { tags: [TAG_BIO], revalidate: false },
);

export async function lerBio(): Promise<Bio> {
  return normalizarBio(await lerValorCacheado());
}
