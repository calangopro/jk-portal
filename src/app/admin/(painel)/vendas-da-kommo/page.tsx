import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { intervaloDoPedido } from "@/lib/pedidos/do-site";
import { lerListaDaKommo } from "@/lib/kommo/vendas";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { TelaDasVendasDaKommo } from "./Tela";

export const metadata = { title: "Vendas da Kommo" };

/**
 * Vendas da Kommo (cartão 47, 0165): o que entrou sozinho no painel quando o
 * vendedor arrastou o negócio para "Venda ganha", e a fila de conferência do
 * que o painel não registrou sem gente olhar.
 *
 * Mesma área e mesma régua de valor de Pedidos do site (`lancar_venda`): o
 * vendedor vê a lista, mas o valor só da venda dele; resolver a fila é da
 * gerência e da diretoria. O desenho mora em `Tela.tsx`.
 */
export default async function VendasDaKommoPage() {
  await requireArea("lancar_venda");
  const hoje = hojeEmSaoPaulo();
  const { de, ate } = intervaloDoPedido("30d", hoje);
  const { data, error } = await (await createClient()).rpc("kommo_vendas_lista", { p_de: de, p_ate: ate });
  if (error) console.error("[vendas da kommo]", error.message);
  return <TelaDasVendasDaKommo inicial={error ? null : lerListaDaKommo(data)} hoje={hoje} />;
}
