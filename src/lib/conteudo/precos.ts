import { createReadClient } from "@/lib/supabase/read";
import { aplicarPrecos, type LinhaDeProduto } from "./precos-html";

/**
 * Preço fresco nos cards de produto, na hora de servir a página.
 *
 * A troca em si mora em `precos-html.ts`, que não importa nada e por isso dá
 * para rodar num teste. Aqui fica só a ida ao banco.
 */

/**
 * Devolve o HTML com os preços de agora. Em qualquer falha devolve o HTML como
 * estava: página com preço velho é ruim, página quebrada é pior.
 */
export async function comPrecosAtuais(html: string): Promise<string> {
  if (!html.includes("data-preco-de=")) return html;

  const ids = Array.from(
    new Set(
      Array.from(html.matchAll(/data-preco-de="([0-9a-fA-F-]{36})"/g)).map((m) => m[1]),
    ),
  );
  if (ids.length === 0) return html;

  const supabase = createReadClient();
  if (!supabase) return html;

  const { data, error } = await supabase
    .from("products")
    .select("id, price, promotional_price, status, availability_text")
    .in("id", ids);

  if (error || !data?.length) return html;

  return aplicarPrecos(html, data as LinhaDeProduto[]);
}
