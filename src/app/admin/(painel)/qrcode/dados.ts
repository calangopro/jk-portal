import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Os números das telas de QR. Tudo sai somado do banco (`qrcode_resumo` e
 * `qrcode_leituras_diarias`, migration 0044), com o dia de São Paulo, para o
 * painel não esbarrar no limite de 1.000 linhas do PostgREST num mês cheio.
 */

export type Resumo = {
  qrcode: string;
  total: number;
  hoje: number;
  ultimos_7: number;
  ultimos_30: number;
  iphone_30: number;
  android_30: number;
  ultima: string | null;
};

export function resumoVazio(slug: string): Resumo {
  return { qrcode: slug, total: 0, hoje: 0, ultimos_7: 0, ultimos_30: 0, iphone_30: 0, android_30: 0, ultima: null };
}

/** Soma vários resumos num só, para o quadro de todos os QRs. */
export function somar(resumos: Resumo[]): Resumo {
  return resumos.reduce(
    (s, r) => ({
      qrcode: "",
      total: s.total + r.total,
      hoje: s.hoje + r.hoje,
      ultimos_7: s.ultimos_7 + r.ultimos_7,
      ultimos_30: s.ultimos_30 + r.ultimos_30,
      iphone_30: s.iphone_30 + r.iphone_30,
      android_30: s.android_30 + r.android_30,
      ultima: !s.ultima || (r.ultima && r.ultima > s.ultima) ? r.ultima : s.ultima,
    }),
    resumoVazio(""),
  );
}

/** `AAAA-MM-DD` de `n` dias antes de `dia`, sem fuso no meio da conta. */
function diasAntes(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Os últimos 30 dias, do mais antigo até hoje. */
export function trintaDias(hoje: string): string[] {
  return Array.from({ length: 30 }, (_, i) => diasAntes(hoje, 29 - i));
}

/** Leituras por dia de um QR, ou de todos quando `slug` não vem. */
export async function leiturasPorDia(
  supabase: SupabaseClient,
  dias: string[],
  slug?: string,
): Promise<Map<string, number>> {
  const { data } = await supabase.rpc("qrcode_leituras_diarias", {
    p_desde: dias[0],
    p_qrcode: slug ?? null,
  });
  const lidas = new Map(((data ?? []) as { dia: string; leituras: number }[]).map((l) => [l.dia, l.leituras]));
  return new Map(dias.map((d) => [d, lidas.get(d) ?? 0]));
}
