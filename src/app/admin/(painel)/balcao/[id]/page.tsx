import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerPedidoDoBalcao } from "@/lib/balcao/dados";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { PedidoDoBalcaoNaTela } from "./Pedido";

export const metadata = { title: "Pedido da loja" };

/** Um pedido do balcão (cartão 71): o que foi pedido, o dinheiro, a fábrica e a entrega. O desenho mora em `Pedido.tsx`. */
export default async function PedidoDoBalcaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string; aviso?: string }> }) {
  await requireArea("balcao");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await lerPedidoDoBalcao(await createClient(), id);
  if (!p) notFound();
  const sp = await searchParams;
  return <PedidoDoBalcaoNaTela inicial={p} hoje={hojeEmSaoPaulo()} salvo={sp.salvo === "fabrica" ? "fabrica" : sp.salvo ? "so" : null} aviso={typeof sp.aviso === "string" ? sp.aviso.slice(0, 300) : null} />;
}
