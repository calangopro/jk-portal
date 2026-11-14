import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O pulso de uma rotina agendada (0074): "rodei agora, e deu certo ou não".
 *
 * Cada rota de `/api/cron` chama isto ao terminar. A tela de saúde olha a data:
 * rotina sem pulso recente está parada, seja qual for o motivo (segredo errado,
 * erro no meio do caminho, relógio desligado). É a resposta ao relógio do
 * banco, que dispara a rota e não olha o que ela respondeu.
 *
 * Nunca derruba a rotina: o pulso é diagnóstico, e falhar aqui não pode
 * transformar uma rodada boa em erro.
 */
export type Rotina = "leads" | "publicar" | "catalogo" | "anuncios" | "search-console" | "avaliacoes";

export async function registrarPulso(db: SupabaseClient, rotina: Rotina, ok: boolean, detalhe?: string): Promise<void> {
  try {
    const agora = new Date().toISOString();
    const linha: Record<string, unknown> = { rotina, ultima_em: agora, ok, detalhe: detalhe ? detalhe.slice(0, 300) : null };
    // Rodada ruim não mexe na data da última rodada boa: é dela que sai o "parada desde".
    if (ok) linha.ultima_boa_em = agora;
    const { error } = await db.from("rotinas_pulso").upsert(linha, { onConflict: "rotina" });
    if (error) console.error(`[pulso] ${rotina}:`, error.message);
  } catch (e) {
    console.error(`[pulso] ${rotina}:`, e);
  }
}
