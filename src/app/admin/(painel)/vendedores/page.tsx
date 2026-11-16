import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerResumoPorFora } from "@/lib/vendas/por-fora";
import { lerRanking } from "@/lib/vendas/ranking";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeVendedores } from "./Tela";

export const metadata = { title: "Vendedores" };

/**
 * Desempenho de cada vendedor: quanto vendeu, ticket e quanto veio de pedido
 * recuperado.
 *
 * Entram duas coisas (0104): o que foi registrado em "Registrar venda" (por
 * fora da loja) e o pedido pago na loja que a pessoa marcou como dela no
 * histórico do pedido. A Tray não grava vendedor, então pedido pago sem
 * marcação não entra, e a tela diz quantos estão assim.
 */
export default async function VendedoresPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireArea("vendas");
  const chave = lerPeriodo((await searchParams).periodo);
  const { de, ate, anteriorDe, anteriorAte, comparacao } = intervaloDoPeriodo(chave, hojeEmSaoPaulo());
  const db = await createClient();
  const [atual, anterior, ranking] = await Promise.all([lerResumoPorFora(db, de, ate), lerResumoPorFora(db, anteriorDe, anteriorAte), lerRanking(db, de, ate)]);
  return <TelaDeVendedores atual={atual} anterior={anterior} ranking={ranking} chave={chave} de={de} ate={ate} comparacao={comparacao} />;
}
