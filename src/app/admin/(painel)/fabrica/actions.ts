"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { REF_DA_FABRICA, moverPedidoDaFabrica, moverPedidosDaFabrica } from "@/lib/fabrica/dados";
import { lerEtapa } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";

/**
 * Move um pedido da fábrica de etapa, anota ou guarda o rastreio.
 *
 * A área é conferida aqui e de novo dentro da função do banco, que é quem
 * grava e quem guarda o nome de quem moveu.
 */
export async function moverPedido(
  ref: string,
  etapa: string,
  extras: { rastreio?: string; nota?: string } = {},
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  const destino = lerEtapa(etapa);
  if (!destino || typeof ref !== "string" || !REF_DA_FABRICA.test(ref)) return { ok: false, erro: "Pedido ou etapa inválidos." };
  const r = await moverPedidoDaFabrica(await createClient(), {
    ref,
    etapa: destino,
    rastreio: extras.rastreio?.slice(0, 80),
    nota: extras.nota?.slice(0, 500),
  });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

/** O máximo de pedidos numa leva. É o mesmo teto da função do banco. */
const TETO_DA_LEVA = 200;

/**
 * Move vários pedidos de uma vez para a mesma etapa. Feito para pôr a fila em
 * dia (marcar como enviado o que já saiu) sem abrir pedido por pedido. Não
 * mexe em rastreio nem em anotação.
 */
export async function moverVarios(
  refs: string[],
  etapa: string,
): Promise<{ ok: true; movidos: number; fora: number } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  const destino = lerEtapa(etapa);
  const lista = [...new Set(Array.isArray(refs) ? refs : [])].filter((r) => typeof r === "string" && REF_DA_FABRICA.test(r));
  if (!destino || lista.length === 0) return { ok: false, erro: "Escolha pelo menos um pedido e a etapa." };
  if (lista.length > TETO_DA_LEVA) return { ok: false, erro: `Dá para mover até ${TETO_DA_LEVA} pedidos por vez.` };
  const r = await moverPedidosDaFabrica(await createClient(), { refs: lista, etapa: destino });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}
