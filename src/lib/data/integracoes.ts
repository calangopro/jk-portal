import { createReadClient } from "@/lib/supabase/read";

/**
 * Configuração pública das integrações (GA4, GTM). Só IDs que já vão para o
 * HTML mesmo. Segredo (token, refresh) nunca entra aqui, fica em variável de
 * ambiente ou no Vault do Supabase.
 */

export type ConfigIntegracoes = {
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
};

export async function obterConfigPublica(): Promise<ConfigIntegracoes> {
  const supabase = createReadClient();
  if (!supabase) return { gtmContainerId: null, ga4MeasurementId: null };

  try {
    const { data, error } = await supabase
      .from("integrations")
      .select("provider, config, status")
      .in("provider", ["gtm", "ga4"]);

    if (error || !data) return { gtmContainerId: null, ga4MeasurementId: null };

    const achar = (p: string) =>
      data.find((r: { provider: string }) => r.provider === p) as
        | { config: Record<string, string>; status: string }
        | undefined;

    const gtm = achar("gtm");
    const ga4 = achar("ga4");

    // Só injeta o que estiver marcado como conectado.
    return {
      gtmContainerId: gtm?.status === "connected" ? (gtm.config?.container_id ?? null) : null,
      ga4MeasurementId: ga4?.status === "connected" ? (ga4.config?.measurement_id ?? null) : null,
    };
  } catch {
    return { gtmContainerId: null, ga4MeasurementId: null };
  }
}
