import { requireArea } from "@/lib/auth/session";
import { lerPedidosComOrigemDoPeriodo } from "@/lib/origem/dados";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeOrigem } from "./Tela";

export const metadata = { title: "Origem dos pedidos" };

/**
 * De qual anúncio veio cada pedido, com as UTMs como chegaram.
 *
 * A chegada é anotada pela própria loja (o coletor, 0064) e ligada ao pedido
 * pela sessão da Tray. A 0112 liga a UTM à campanha, ao conjunto e ao anúncio:
 * pelo número quando ele vem, e pelo NOME dentro da campanha, que é como os
 * anúncios do Meta mandam o conjunto e o anúncio.
 */
export default async function OrigemPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireArea("trafego");
  const sp = await searchParams;
  // Trinta dias é o padrão: a chegada só existe desde 13/11/2026, e em sete dias há pouco pedido para ler.
  const chave = lerPeriodo(sp.periodo ?? "30d");
  const { de, ate } = intervaloDoPeriodo(chave, hojeEmSaoPaulo());
  const pedidos = await lerPedidosComOrigemDoPeriodo(await createClient(), de, ate);
  return <TelaDeOrigem pedidos={pedidos} de={de} ate={ate} chave={chave} />;
}
