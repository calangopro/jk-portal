"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type IntegracaoState = { erro?: string; ok?: string };

/** Salva a configuração pública e liga ou desliga a integração. */
export async function salvarIntegracao(
  _prev: IntegracaoState,
  formData: FormData,
): Promise<IntegracaoState> {
  await requireAdmin();

  const provider = String(formData.get("provider") ?? "");
  const conectar = String(formData.get("conectar") ?? "") === "1";
  if (!provider) return { erro: "Integração não identificada." };

  // Cada provedor guarda campos próprios, todos NÃO sensíveis.
  const config: Record<string, string> = {};
  if (provider === "gtm") {
    const id = String(formData.get("container_id") ?? "").trim();
    if (conectar && !/^GTM-[A-Z0-9]+$/i.test(id)) {
      return { erro: "O ID do GTM tem o formato GTM-XXXXXXX." };
    }
    config.container_id = id;
  }
  if (provider === "ga4") {
    const id = String(formData.get("measurement_id") ?? "").trim();
    if (conectar && !/^G-[A-Z0-9]+$/i.test(id)) {
      return { erro: "O ID do GA4 tem o formato G-XXXXXXXXXX." };
    }
    config.measurement_id = id;
  }
  if (provider === "gsc") {
    config.site_url = String(formData.get("site_url") ?? "").trim();
  }
  if (provider === "gmb") {
    config.account = String(formData.get("account") ?? "").trim();
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        provider,
        display_name: String(formData.get("display_name") ?? provider),
        config,
        status: conectar ? "connected" : "disconnected",
        connected_at: conectar ? new Date().toISOString() : null,
      },
      { onConflict: "provider" },
    );

  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  revalidatePath("/", "layout");
  return { ok: conectar ? "Conectado." : "Desconectado." };
}
