import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Comparação de tempo constante, para o segredo não vazar por cronometragem. */
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Confere se quem chamou é o `pg_cron` do Supabase.
 *
 * O relógio manda o segredo no cabeçalho `x-cron-secret`, e o valor certo mora
 * em `integration_tokens` (provider `cron`), tabela que só o `service_role`
 * enxerga. Sem segredo gravado, a resposta é NÃO: falta de configuração nunca
 * vira porta aberta.
 *
 * Recebe o cliente de fora porque a rota já precisa dele com service_role para
 * o trabalho que vem depois.
 */
export async function cronAutorizado(
  request: Request,
  supabase: SupabaseClient,
): Promise<boolean> {
  const recebido = request.headers.get("x-cron-secret") ?? "";
  if (!recebido) return false;

  const { data: token } = await supabase
    .from("integration_tokens")
    .select("access_token")
    .eq("provider", "cron")
    .maybeSingle();

  const esperado = (token?.access_token ?? "") as string;
  return Boolean(esperado) && segredoConfere(recebido, esperado);
}
