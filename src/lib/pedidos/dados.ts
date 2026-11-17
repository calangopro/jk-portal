import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerMeuMes, type MeuMes } from "./do-site";

/** O mês de vendas de quem está logado (0105). Nulo para quem não lança venda, ou quando a leitura falhou. */
export async function lerMeuMesNoServidor(db: SupabaseClient): Promise<MeuMes | null> {
  const { data, error } = await db.rpc("meu_mes_de_vendas");
  if (error) {
    console.error("[pedidos] meu_mes_de_vendas:", error.message);
    return null;
  }
  return lerMeuMes(data);
}
