import { requireArea } from "@/lib/auth/session";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { lerEtapa } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { moverPedido, moverVarios } from "./actions";
import { JANELAS, TelaDaFabrica } from "./Tela";

export const metadata = { title: "Fila da fábrica" };

/**
 * A fila da fábrica: os pedidos pagos, da produção ao envio.
 *
 * Quem tem a área `fabrica` (fábrica, gerente, GM, dono e administrador) vê e
 * move. A fila vem de uma função do banco que não devolve preço nem custo: a
 * fábrica não tem leitura do faturamento. O desenho mora em `Tela.tsx`.
 */
export default async function FabricaPage({ searchParams }: { searchParams: Promise<{ etapa?: string; dias?: string; busca?: string }> }) {
  await requireArea("fabrica");
  const sp = await searchParams;
  const dias = JANELAS.includes(Number(sp.dias)) ? Number(sp.dias) : JANELAS[0];
  const fila = await lerFilaDaFabrica(await createClient(), dias);
  // `?busca=<número>` é por onde chega quem clicou num pedido marcado no chat do time: só número, nunca texto digitado.
  const busca = sp.busca && /^[0-9]{1,12}$/.test(sp.busca) ? sp.busca : "";
  return <TelaDaFabrica fila={fila} etapa={lerEtapa(sp.etapa) ?? "a_produzir"} dias={dias} hoje={hojeEmSaoPaulo()} buscaInicial={busca} mover={moverPedido} moverVarios={moverVarios} />;
}
