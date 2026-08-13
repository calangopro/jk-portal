import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { normalizarTema, temaPadrao, type Tema } from "./tipos";

/**
 * Tag de cache do tema. Salvar a aparência no admin chama `revalidateTag` com
 * ela, e a mudança aparece na hora em vez de esperar o ISR de uma hora.
 */
export const TAG_TEMA = "tema";

/**
 * Lê o tema do banco.
 *
 * `revalidate: false` porque tema só muda por ação explícita de alguém no
 * admin, e é isso que permite chamar esta função no layout raiz sem tornar
 * todas as páginas dinâmicas: o valor vem do Data Cache e continua servindo
 * durante a geração estática.
 *
 * Usa o cliente sem cookie de propósito. `unstable_cache` não aceita função que
 * leia `cookies()`, e o tema é público de qualquer forma.
 */
export const lerTema = unstable_cache(
  async (): Promise<Tema> => {
    const supabase = createReadClient();
    if (!supabase) return temaPadrao();

    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tema")
        .maybeSingle();

      // Sem linha, ou com erro de leitura, o site abre no tema de fábrica. Uma
      // falha de configuração nunca pode deixar a página sem cor.
      if (error || !data) return temaPadrao();
      return normalizarTema(data.value);
    } catch {
      return temaPadrao();
    }
  },
  ["tema"],
  { tags: [TAG_TEMA], revalidate: false },
);
