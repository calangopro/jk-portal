import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { layoutPadraoDaHome, normalizarLayout, type Layout } from "./tipos";

export const TAG_LAYOUT = "layout";

/**
 * Layout de uma página, vindo de `site_settings` na chave `pagina:<slug>`.
 *
 * Fica em `site_settings` de propósito nesta etapa: é o mesmo JSON que a tabela
 * `pages` vai guardar quando o construtor visual chegar, então migrar depois é
 * copiar o valor de uma coluna para outra, sem tocar em nenhum componente.
 */
/**
 * O slug entra na chave de cache explicitamente.
 *
 * O `unstable_cache` até deriva chave dos argumentos, mas depender disso é
 * frágil: basta a serialização mudar para duas páginas passarem a compartilhar
 * a mesma entrada e uma servir o layout da outra. Com `keyParts` explícito, o
 * isolamento é garantido.
 */
const lerLayoutCacheado = unstable_cache(
  async (slug: string): Promise<Layout> => {
    const padrao = slug === "home" ? layoutPadraoDaHome() : { versao: 1, blocos: [] };

    const supabase = createReadClient();
    if (!supabase) return padrao;

    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", `pagina:${slug}`)
        .maybeSingle();

      if (error || !data) return padrao;
      return normalizarLayout(data.value, padrao);
    } catch {
      return padrao;
    }
  },
  ["layout-de-pagina"],
  { tags: [TAG_LAYOUT], revalidate: false },
);

export function lerLayout(slug: string): Promise<Layout> {
  return lerLayoutCacheado(slug);
}
