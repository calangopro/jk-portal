"use server";

import { ehAdmin } from "@/lib/auth/acessos";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerSobraDoPedido, type SobraDoPedido } from "@/lib/vendas/sobra";

/**
 * A cascata da venda para a gaveta do pedido. É custo e taxa da empresa: só o
 * administrador recebe. Quem não é recebe `sem_acesso` e a gaveta não desenha
 * nada, sem erro e sem aviso, porque para essa pessoa o bloco não existe.
 */
export async function sobraDoPedido(numero: number): Promise<SobraDoPedido | { tipo: "sem_acesso" } | { tipo: "erro" }> {
  const perfil = await getSessionProfile();
  if (!perfil || !ehAdmin(perfil.role)) return { tipo: "sem_acesso" };
  if (!Number.isInteger(numero) || numero <= 0) return { tipo: "nao_achado" };
  try {
    return await lerSobraDoPedido(createAdminClient(), numero);
  } catch (e) {
    console.error("[pedido] sobra:", e instanceof Error ? e.message : e);
    return { tipo: "erro" };
  }
}
