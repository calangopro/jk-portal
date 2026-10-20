import "server-only";
import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { normalizarQrcode, type ConfigDoQrcode } from "./tipos";

export const TAG_QRCODE = "qrcode";

/**
 * A configuração gravada em `site_settings`, chave `pagina:qrcode`.
 *
 * Mesma regra de `lerGrupo`: no cache entra só a resposta crua do banco, e o
 * padrão do código é aplicado fora, em `normalizarQrcode`. Quem derruba o cache
 * é o salvar do painel, com `revalidateTag(TAG_QRCODE)`.
 */
const lerValorCacheado = unstable_cache(
  async (): Promise<unknown> => {
    const supabase = createReadClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pagina:qrcode")
        .maybeSingle();
      if (error || !data) return null;
      return data.value;
    } catch {
      return null;
    }
  },
  ["qrcode-gravado", "v1"],
  { tags: [TAG_QRCODE], revalidate: false },
);

export async function lerQrcode(): Promise<ConfigDoQrcode> {
  return normalizarQrcode(await lerValorCacheado());
}
