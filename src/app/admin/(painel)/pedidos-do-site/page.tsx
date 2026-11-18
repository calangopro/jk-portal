import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { intervaloDoPedido, lerPedidosDoSite } from "@/lib/pedidos/do-site";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { TelaDosPedidos } from "./Tela";

export const metadata = { title: "Pedidos do site" };

/**
 * Pedidos do site: o vendedor acha o pedido pago que ele fechou e marca como
 * dele (0105). Pedido do dono em 17/11: "meu vendedor não consegue achar as
 * vendas que ele fez no site pra colocar que é dele".
 *
 * Abre para quem tem `lancar_venda`. A primeira leitura (pedidos pagos dos
 * últimos 30 dias sem vendedor) sai daqui; a busca e os filtros falam com o
 * banco direto do navegador. O desenho mora em `Tela.tsx`.
 */
export default async function PedidosDoSitePage() {
  await requireArea("lancar_venda");
  const hoje = hojeEmSaoPaulo();
  const { de, ate } = intervaloDoPedido("30d", hoje);
  const { data, error } = await (await createClient()).rpc("pedidos_do_site", { p_busca: null, p_filtro: "sem_vendedor", p_de: de, p_ate: ate });
  if (error) console.error("[pedidos do site]", error.message);
  return <TelaDosPedidos inicial={error ? null : lerPedidosDoSite(data)} hoje={hoje} />;
}
