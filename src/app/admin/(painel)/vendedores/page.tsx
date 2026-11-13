import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerResumoPorFora } from "@/lib/vendas/por-fora";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeVendedores } from "./Tela";

export const metadata = { title: "Vendedores" };

/**
 * Desempenho de cada vendedor nas vendas por fora da loja: quanto vendeu,
 * ticket e quanto veio de pedido recuperado.
 *
 * Só entra o que foi registrado em "Registrar venda". Pedido pago pelo site
 * não tem vendedor na Tray, então não aparece aqui: a tela diz isso para o
 * número não ser lido como "tudo o que a pessoa vendeu".
 */
export default async function VendedoresPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireArea("vendas");
  const chave = lerPeriodo((await searchParams).periodo);
  const { de, ate, anteriorDe, anteriorAte, comparacao } = intervaloDoPeriodo(chave, hojeEmSaoPaulo());
  const db = await createClient();
  const [atual, anterior] = await Promise.all([lerResumoPorFora(db, de, ate), lerResumoPorFora(db, anteriorDe, anteriorAte)]);
  return <TelaDeVendedores atual={atual} anterior={anterior} chave={chave} de={de} ate={ate} comparacao={comparacao} />;
}
