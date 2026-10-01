import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * As chaves dos destinos do contato, lidas de `integration_tokens`.
 *
 * Moram no banco, e não em variável da Vercel, para quem cuida do painel
 * conseguir trocar sozinho (a conta da Vercel não é de todo mundo). A tabela
 * não tem policy nenhuma: só a service_role lê, e o painel só ESCREVE, nunca
 * mostra o valor de volta.
 *
 * Provedores:
 *   - `kommo`: token de longa duração; `meta.subdominio`, `meta.funil_id`,
 *     `meta.etapa_id` (sem funil, vira só contato, sem negócio).
 *   - `rd_station`: token PÚBLICO de conversões (o mesmo da loja).
 *   - `meta_capi`: token da API de Conversões; `meta.pixel_id`,
 *     `meta.codigo_de_teste`.
 *   - `grupo_webhook`: a URL que recebe o contato (DevZapp, Make, n8n).
 *   - `grupo_entrada`: o segredo do aviso de entrada no grupo.
 */

export const PROVEDORES_DE_CHAVE = ["kommo", "rd_station", "meta_capi", "grupo_webhook", "grupo_entrada"] as const;
export type ProvedorDeChave = (typeof PROVEDORES_DE_CHAVE)[number];

export type Chave = {
  valor: string;
  meta: Record<string, string>;
  atualizadaEm: string | null;
};

export type Chaves = Partial<Record<ProvedorDeChave, Chave>>;

/** O pixel da JK, o mesmo da loja (`infra/gtm/README.md`). */
export const PIXEL_DA_JK = "364357034958645";

export const SUBDOMINIO_KOMMO = "kathleengfz";

export async function lerChaves(supabase: SupabaseClient): Promise<Chaves> {
  const { data } = await supabase
    .from("integration_tokens")
    .select("provider, access_token, meta, updated_at")
    .in("provider", PROVEDORES_DE_CHAVE as unknown as string[]);

  const chaves: Chaves = {};
  for (const linha of (data ?? []) as {
    provider: ProvedorDeChave;
    access_token: string | null;
    meta: Record<string, unknown> | null;
    updated_at: string | null;
  }[]) {
    if (!linha.access_token) continue;
    const meta = Object.fromEntries(
      Object.entries(linha.meta ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
    );
    chaves[linha.provider] = { valor: linha.access_token, meta, atualizadaEm: linha.updated_at };
  }
  return chaves;
}
