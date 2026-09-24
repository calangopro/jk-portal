import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Leitura de `analytics_snapshots` do Search Console, sempre do período mais
 * recente e sempre INTEIRA.
 *
 * O Supabase devolve no máximo 1.000 linhas por pedido (conferido em 24/09:
 * `limit=5000` voltou 1.000), e cada consulta do Search Console ocupa quatro
 * linhas, uma por métrica. Sem paginar, uma importação de 1.000 consultas
 * chegava às telas como 250, e o total de cliques saía errado sem aviso.
 */

export type Snapshot = {
  metric: string;
  dimension: string;
  dimension_value: string;
  value: number;
  period_start: string;
  period_end: string;
};

export type PeriodoDoSnapshot = { inicio: string; fim: string };

const PAGINA = 1000;

/** O período mais recente importado, de qualquer dimensão ou só de uma. */
export async function ultimoPeriodo(
  supabase: SupabaseClient,
  dimensao?: "query" | "page",
): Promise<PeriodoDoSnapshot | null> {
  let consulta = supabase
    .from("analytics_snapshots")
    .select("period_start, period_end")
    .eq("source", "gsc");
  if (dimensao) consulta = consulta.eq("dimension", dimensao);

  const { data } = await consulta
    .order("period_end", { ascending: false })
    .order("period_start", { ascending: true })
    .limit(1);

  const linha = (data ?? [])[0] as { period_start: string; period_end: string } | undefined;
  return linha ? { inicio: linha.period_start, fim: linha.period_end } : null;
}

/** Todas as linhas de um período, em páginas de 1.000. */
export async function snapshotsDoPeriodo(
  supabase: SupabaseClient,
  periodo: PeriodoDoSnapshot,
  dimensao?: "query" | "page",
): Promise<Snapshot[]> {
  const todas: Snapshot[] = [];
  for (let de = 0; ; de += PAGINA) {
    let consulta = supabase
      .from("analytics_snapshots")
      .select("metric, dimension, dimension_value, value, period_start, period_end")
      .eq("source", "gsc")
      .eq("period_start", periodo.inicio)
      .eq("period_end", periodo.fim);
    if (dimensao) consulta = consulta.eq("dimension", dimensao);

    // Ordem fixa, senão a paginação pode repetir ou pular linha entre páginas.
    const { data, error } = await consulta.order("id").range(de, de + PAGINA - 1);
    if (error || !data) break;
    todas.push(...(data as Snapshot[]));
    if (data.length < PAGINA) break;
  }
  return todas;
}
