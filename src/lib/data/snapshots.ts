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

/**
 * Todas as linhas de um período, em páginas de 1.000.
 *
 * As páginas são pedidas AO MESMO TEMPO. Uma depois da outra, um período de
 * 8 mil linhas eram oito idas ao banco em fila, e a tela de Métricas levava
 * quatro segundos para chegar inteira. Primeiro se conta, depois se pede tudo
 * de uma vez. A ordem por `id` continua fixa, senão a paginação pode repetir
 * ou pular linha entre páginas.
 */
export async function snapshotsDoPeriodo(
  supabase: SupabaseClient,
  periodo: PeriodoDoSnapshot,
  dimensao?: "query" | "page",
): Promise<Snapshot[]> {
  const doPeriodo = (colunas: string, opcoes?: { count: "exact"; head: true }) => {
    let consulta = supabase
      .from("analytics_snapshots")
      .select(colunas, opcoes)
      .eq("source", "gsc")
      .eq("period_start", periodo.inicio)
      .eq("period_end", periodo.fim);
    if (dimensao) consulta = consulta.eq("dimension", dimensao);
    return consulta;
  };

  const { count, error } = await doPeriodo("id", { count: "exact", head: true });
  if (error || !count) return [];

  const paginas = Math.ceil(count / PAGINA);
  const partes = await Promise.all(
    Array.from({ length: paginas }, (_, i) =>
      doPeriodo("metric, dimension, dimension_value, value, period_start, period_end")
        .order("id")
        .range(i * PAGINA, (i + 1) * PAGINA - 1),
    ),
  );

  const todas: Snapshot[] = [];
  for (const parte of partes) {
    // Página com erro encerra a leitura ali, como na versão em fila: melhor
    // devolver o começo inteiro do que um conjunto com um buraco no meio.
    if (parte.error || !parte.data) break;
    todas.push(...(parte.data as unknown as Snapshot[]));
  }
  return todas;
}
