/**
 * Lê a resposta das APIs de anúncio e devolve o gasto por dia, no formato de
 * `anuncios_gasto`. Arquivo puro, para o teste rodar sem rede e sem banco.
 *
 * As duas plataformas só devolvem linha para dia COM veiculação. Dia fechado
 * sem linha é dia de gasto zero, e precisa ser gravado como zero: sem isso a
 * tela de tráfego acusaria "dia sem gasto lançado" para sempre.
 */

export type DiaDeGasto = { dia: string; gasto: number; impressoes: number | null; cliques: number | null };

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const centavos = (n: number) => Math.round(n * 100) / 100;
const inteiro = (v: unknown): number | null => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : Math.round(n);
};

function somarPorDia(linhas: DiaDeGasto[]): DiaDeGasto[] {
  const porDia = new Map<string, DiaDeGasto>();
  for (const l of linhas) {
    const a = porDia.get(l.dia);
    if (!a) {
      porDia.set(l.dia, { ...l });
      continue;
    }
    a.gasto = centavos(a.gasto + l.gasto);
    a.impressoes = a.impressoes == null && l.impressoes == null ? null : (a.impressoes ?? 0) + (l.impressoes ?? 0);
    a.cliques = a.cliques == null && l.cliques == null ? null : (a.cliques ?? 0) + (l.cliques ?? 0);
  }
  return [...porDia.values()].sort((a, b) => (a.dia < b.dia ? -1 : 1));
}

/**
 * Insights do Meta com `time_increment=1`: cada linha é um dia, com `spend`,
 * `impressions` e `clicks` em texto. Linha sem data ou com gasto que não é
 * número é descartada, nunca vira zero.
 */
export function lerInsightsDoMeta(linhas: unknown[]): DiaDeGasto[] {
  const dias: DiaDeGasto[] = [];
  for (const bruta of linhas) {
    const l = (bruta ?? {}) as Record<string, unknown>;
    const dia = String(l.date_start ?? "");
    const gasto = Number(l.spend);
    if (!DIA.test(dia) || l.spend == null || !Number.isFinite(gasto)) continue;
    dias.push({ dia, gasto: centavos(gasto), impressoes: inteiro(l.impressions), cliques: inteiro(l.clicks) });
  }
  return somarPorDia(dias);
}

/**
 * `googleAds:searchStream` devolve uma lista de lotes, cada um com `results`.
 * O custo vem em micros (milionésimos da moeda), como texto.
 */
export function lerLotesDoGoogle(lotes: unknown): DiaDeGasto[] {
  const dias: DiaDeGasto[] = [];
  for (const lote of Array.isArray(lotes) ? lotes : [lotes]) {
    const resultados = ((lote ?? {}) as { results?: unknown[] }).results ?? [];
    for (const bruta of resultados) {
      const r = (bruta ?? {}) as { segments?: { date?: string }; metrics?: Record<string, unknown> };
      const dia = String(r.segments?.date ?? "");
      const micros = Number(r.metrics?.costMicros ?? 0);
      if (!DIA.test(dia) || !Number.isFinite(micros)) continue;
      dias.push({ dia, gasto: centavos(micros / 1_000_000), impressoes: inteiro(r.metrics?.impressions), cliques: inteiro(r.metrics?.clicks) });
    }
  }
  return somarPorDia(dias);
}

/**
 * Completa com zero os dias FECHADOS do intervalo que a plataforma não
 * devolveu. Hoje fica de fora quando não veio: o dia ainda está correndo, e
 * gravar zero diria que não houve gasto.
 */
export function completarDias(dias: DiaDeGasto[], de: string, ate: string, hoje: string): DiaDeGasto[] {
  const tem = new Map(dias.map((d) => [d.dia, d]));
  const saida: DiaDeGasto[] = [];
  const fim = new Date(`${ate}T00:00:00Z`);
  for (const d = new Date(`${de}T00:00:00Z`); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const dia = d.toISOString().slice(0, 10);
    const lido = tem.get(dia);
    if (lido) saida.push(lido);
    else if (dia < hoje) saida.push({ dia, gasto: 0, impressoes: 0, cliques: 0 });
  }
  return saida;
}
