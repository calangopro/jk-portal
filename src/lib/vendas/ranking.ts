import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O ranking de Vendedores (0104): quanto cada pessoa vendeu, por fora da loja
 * (Registrar venda) e na loja (o pedido pago que ela marcou como dela no
 * histórico do pedido). É outra conta que `resumo_por_fora`, de propósito:
 * aquela é o dinheiro que entrou POR FORA e alimenta a meta e os custos.
 *
 * Pedido que já tem venda por fora ligada não entra na parte da loja, para o
 * mesmo dinheiro não contar duas vezes. Só quem tem a área de vendas recebe.
 */

export type LinhaDoRanking = {
  vendedor_id: string;
  vendedor: string;
  fora_vendas: number;
  fora_valor: number;
  recuperadas: number;
  valor_recuperado: number;
  loja_pedidos: number;
  loja_valor: number;
  vendas: number;
  valor: number;
};

export type Ranking = {
  por_vendedor: LinhaDoRanking[];
  /** Pedidos pagos do período marcados para alguém. */
  loja: { pedidos: number; valor: number };
  /** Pedidos pagos do período que ninguém marcou. */
  sem_vendedor: { pedidos: number; valor: number };
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function lerRanking(db: SupabaseClient, de: string, ate: string): Promise<Ranking | null> {
  const { data, error } = await db.rpc("ranking_de_vendedores", { p_de: de, p_ate: ate });
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[vendas] ranking_de_vendedores:", error.message);
    return null;
  }
  const d = data as Record<string, unknown>;
  const lista = Array.isArray(d.por_vendedor) ? (d.por_vendedor as Record<string, unknown>[]) : [];
  const parte = (v: unknown) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { pedidos: n(o.pedidos), valor: n(o.valor) };
  };
  return {
    por_vendedor: lista.map((l) => ({
      vendedor_id: String(l.vendedor_id ?? ""),
      vendedor: typeof l.vendedor === "string" ? l.vendedor : "Sem nome",
      fora_vendas: n(l.fora_vendas),
      fora_valor: n(l.fora_valor),
      recuperadas: n(l.recuperadas),
      valor_recuperado: n(l.valor_recuperado),
      loja_pedidos: n(l.loja_pedidos),
      loja_valor: n(l.loja_valor),
      vendas: n(l.vendas),
      valor: n(l.valor),
    })),
    loja: parte(d.loja),
    sem_vendedor: parte(d.sem_vendedor),
  };
}
