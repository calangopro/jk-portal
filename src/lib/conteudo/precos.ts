import { createReadClient } from "@/lib/supabase/read";
import { hojeEmSaoPaulo, precoVigente } from "@/lib/tray/preco";
import { aplicarPrecos, type LinhaDeProduto } from "./precos-html";

/**
 * Preço fresco nos cards de produto, na hora de servir a página.
 *
 * A troca em si mora em `precos-html.ts`, que só importa tipo e por isso dá
 * para rodar num teste. Aqui ficam a ida ao banco e a decisão de qual preço
 * vale hoje, por `precoVigente`.
 */

type LinhaDoBanco = {
  id: string;
  price: number | null;
  promotional_price: number | null;
  start_promotion: string | null;
  end_promotion: string | null;
  status: string | null;
  availability_text: string | null;
};

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

  // As datas da promoção moram em `raw`. Sem elas, `precoVigente` não tem como
  // saber que a promoção acabou, e o card anuncia um desconto que a loja não dá.
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, price, promotional_price, status, availability_text, " +
        "start_promotion:raw->>start_promotion, end_promotion:raw->>end_promotion",
    )
    .in("id", ids);

  if (error || !data?.length) return html;

  const hoje = hojeEmSaoPaulo();
  const linhas: LinhaDeProduto[] = (data as unknown as LinhaDoBanco[]).map((l) => ({
    id: l.id,
    preco: precoVigente(l, hoje),
    status: l.status,
    availability_text: l.availability_text,
  }));

  return aplicarPrecos(html, linhas);
}
