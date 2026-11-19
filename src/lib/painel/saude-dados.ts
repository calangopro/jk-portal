import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAVE_DO_DESTINO } from "@/lib/leads/repassar";
import { DESTINOS, DESTINOS_DESLIGADOS } from "@/lib/leads/tipos";
import { avaliarSaude, type Ligacao, type SaudeCrua } from "./saude";

/** Quais destinos têm chave colada. Só a presença: o valor nunca sai do banco. */
async function destinosComChave(): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("integration_tokens")
    .select("provider, access_token")
    .in("provider", Object.values(CHAVE_DO_DESTINO) as string[]);
  const comValor = new Set((data ?? []).filter((l) => Boolean(l.access_token)).map((l) => String(l.provider)));
  return DESTINOS.filter((d) => comValor.has(CHAVE_DO_DESTINO[d]));
}

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
  const comChave = await destinosComChave().catch(() => undefined);
  return avaliarSaude({
    comChave,
    desligados: [...DESTINOS_DESLIGADOS],
    agora: typeof cru.agora === "string" ? cru.agora : new Date().toISOString(),
    rotinas: Array.isArray(cru.rotinas) ? cru.rotinas : [],
    leituras: Array.isArray(cru.leituras) ? cru.leituras : [],
    destinos: Array.isArray(cru.destinos) ? cru.destinos.map((d) => ({ ...d, ok: Number(d.ok) || 0, erro: Number(d.erro) || 0, sem_chave: Number(d.sem_chave) || 0, ignorado: Number(d.ignorado) || 0, fora_da_fila: Number(d.fora_da_fila) || 0 })) : [],
    contatos: Number(cru.contatos) || 0,
    pendencias: {
      leads_esperando: Number(cru.pendencias?.leads_esperando) || 0,
      agendados_vencidos: Number(cru.pendencias?.agendados_vencidos) || 0,
      redes_vencidos: Number(cru.pendencias?.redes_vencidos) || 0,
    },
  });
}
