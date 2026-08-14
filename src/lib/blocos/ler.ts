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
 * O que entra no cache é só o VALOR DO BANCO, nunca o layout de fábrica.
 *
 * Antes o padrão era montado aqui dentro e voltava junto no cache, com
 * `revalidate: false`. Como o banco não tem linha nenhuma de `pagina:home`, o
 * que ficava gravado no cache era uma cópia do layout de fábrica: mudar o
 * título da home no código não aparecia na tela, porque a entrada só morre com
 * `revalidateTag`, que só o admin dispara ao salvar. Deu horas de "não mudou
 * nada" com a mudança feita.
 *
 * Agora o cacheado é a resposta crua do Supabase, `null` incluído, e o padrão
 * é aplicado FORA. Texto que mora no código passa a valer na hora, e o cache
 * continua evitando a ida ao banco.
 *
 * O slug entra na chave de cache explicitamente. O `unstable_cache` até deriva
 * chave dos argumentos, mas depender disso é frágil: basta a serialização mudar
 * para duas páginas passarem a compartilhar a mesma entrada e uma servir o
 * layout da outra. Com `keyParts` explícito, o isolamento é garantido.
 */
const lerValorCacheado = unstable_cache(
  async (slug: string): Promise<unknown> => {
    const supabase = createReadClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", `pagina:${slug}`)
        .maybeSingle();

      if (error || !data) return null;
      return data.value;
    } catch {
      return null;
    }
  },
  // A versão faz parte da chave: o cache antigo guardava o layout INTEIRO, com
  // o texto de fábrica dentro, e uma entrada dessas nunca expira sozinha. Sem
  // trocar a chave, quem já tem `.next/cache` gravado continuaria vendo o
  // título velho mesmo com este arquivo corrigido.
  ["layout-de-pagina", "v2"],
  { tags: [TAG_LAYOUT], revalidate: false },
);

export async function lerLayout(slug: string): Promise<Layout> {
  const padrao = slug === "home" ? layoutPadraoDaHome() : { versao: 1, blocos: [] };
  // `normalizarLayout` já devolve o padrão quando o valor é nulo ou inválido.
  return normalizarLayout(await lerValorCacheado(slug), padrao);
}
