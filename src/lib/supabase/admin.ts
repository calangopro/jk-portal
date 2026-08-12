import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente ADMIN (service_role) — ignora RLS. USO EXCLUSIVO NO SERVIDOR.
 *
 * O import "server-only" faz o build FALHAR se este arquivo for importado em
 * qualquer código de cliente, impedindo o vazamento da service_role no bundle.
 * A chave NUNCA tem prefixo NEXT_PUBLIC_. Reservado à futura área /admin e a
 * scripts de build — nunca usar nas páginas públicas.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL ausentes.",
    );
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
