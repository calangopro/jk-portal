"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVEDOR_APPMAX, pedirToken } from "@/lib/appmax/cliente";
import type { IntegracaoState } from "./actions";

/**
 * Guarda o Client ID e o Client Secret da Appmax (Produção). O Client Secret
 * vai para `integration_tokens` e nunca volta para a tela. Antes de gravar, a
 * Appmax é perguntada se aceita o par: credencial errada é recusada aqui, com
 * o motivo, em vez de falhar calada na rotina.
 */
export async function salvarCredencialDaAppmax(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const db = createAdminClient();

  if (String(formData.get("remover") ?? "") === "1") {
    await db.from("integration_tokens").delete().eq("provider", PROVEDOR_APPMAX);
    revalidatePath("/admin/integracoes");
    return { ok: "Credencial removida. A taxa real por venda deixa de ser lida." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();
  if (!clientId || /\s/.test(clientId) || clientId.length < 8) return { erro: "Cole o Client ID inteiro, sem espaço." };
  if (!clientSecret || /\s/.test(clientSecret) || clientSecret.length < 8) return { erro: "Cole o Client Secret inteiro, sem espaço nem quebra de linha." };

  try {
    await pedirToken(clientId, clientSecret);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para conferir agora. Tente de novo." };
  }

  const { error } = await db
    .from("integration_tokens")
    .upsert({ provider: PROVEDOR_APPMAX, access_token: clientSecret, meta: { client_id: clientId } }, { onConflict: "provider" });
  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  return { ok: "A Appmax aceitou a credencial e ela foi salva. A primeira leitura das taxas sai em até 10 minutos." };
}
