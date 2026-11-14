"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { moverPedidoDaFabrica } from "@/lib/fabrica/dados";
import { lerEtapa } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";

/**
 * Move um pedido da fábrica de etapa, anota ou guarda o rastreio.
 *
 * A área é conferida aqui e de novo dentro da função do banco, que é quem
 * grava e quem guarda o nome de quem moveu.
 */
export async function moverPedido(
  pedido: number,
  etapa: string,
  extras: { rastreio?: string; nota?: string } = {},
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  const destino = lerEtapa(etapa);
  if (!destino || !Number.isSafeInteger(pedido) || pedido <= 0) return { ok: false, erro: "Pedido ou etapa inválidos." };
  const r = await moverPedidoDaFabrica(await createClient(), {
    pedido,
    etapa: destino,
    rastreio: extras.rastreio?.slice(0, 80),
    nota: extras.nota?.slice(0, 500),
  });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}
