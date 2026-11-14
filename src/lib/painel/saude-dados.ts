import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarSaude, type Ligacao, type SaudeCrua } from "./saude";

/**
 * Lê a saúde das ligações (0074) e já devolve avaliada. A função do banco só
 * responde a administrador, dono e GM; para os outros vem nulo, e daqui sai
 * `null` também.
 */
export async function lerSaude(db: SupabaseClient): Promise<Ligacao[] | null> {
  const { data, error } = await db.rpc("saude_das_ligacoes");
  if (error) {
    console.error("[saude] saude_das_ligacoes:", error.message);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const cru = data as Partial<SaudeCrua>;
  return avaliarSaude({
    agora: typeof cru.agora === "string" ? cru.agora : new Date().toISOString(),
    rotinas: Array.isArray(cru.rotinas) ? cru.rotinas : [],
    leituras: Array.isArray(cru.leituras) ? cru.leituras : [],
    destinos: Array.isArray(cru.destinos) ? cru.destinos.map((d) => ({ ...d, ok: Number(d.ok) || 0, erro: Number(d.erro) || 0, sem_chave: Number(d.sem_chave) || 0, ignorado: Number(d.ignorado) || 0, fora_da_fila: Number(d.fora_da_fila) || 0 })) : [],
    contatos: Number(cru.contatos) || 0,
    pendencias: { leads_esperando: Number(cru.pendencias?.leads_esperando) || 0, agendados_vencidos: Number(cru.pendencias?.agendados_vencidos) || 0 },
  });
}
