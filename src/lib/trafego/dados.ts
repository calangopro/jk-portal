import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerResumoDeVendas } from "../vendas/dados";
import { agruparPorCanal } from "../vendas/origem";
import { diasEntre, intervaloDoPeriodo, type ChaveDePeriodo } from "../vendas/periodo";
import { lerResumoPorFora } from "../vendas/por-fora";
import { retornoPorPlataforma, type LinhaDeRetorno } from "./retorno";

/**
 * Gasto de anúncio guardado em `anuncios_gasto` (0059). A função do banco roda
 * com os direitos de quem chama: sem a área de tráfego, vem tudo zerado.
 */

export type GastoDaPlataforma = {
  plataforma: string;
  gasto: number;
  cliques: number | null;
  impressoes: number | null;
  dias: number;
  ultimo_dia: string;
  por_api: boolean;
};

export type ResumoDeGasto = {
  gasto: number;
  dias_com_gasto: number;
  por_plataforma: GastoDaPlataforma[];
  por_dia: { dia: string; gasto: number }[];
};

export async function lerResumoDeGasto(db: SupabaseClient, de: string, ate: string): Promise<ResumoDeGasto | null> {
  const { data, error } = await db.rpc("resumo_de_gasto", { p_de: de, p_ate: ate });
  if (error) {
    console.error("[trafego] resumo_de_gasto:", error.message);
    return null;
  }
  const r = (data ?? {}) as Partial<ResumoDeGasto>;
  return {
    gasto: Number(r.gasto ?? 0),
    dias_com_gasto: r.dias_com_gasto ?? 0,
    por_plataforma: (r.por_plataforma ?? []).map((p) => ({ ...p, gasto: Number(p.gasto) })),
    por_dia: (r.por_dia ?? []).map((d) => ({ dia: d.dia, gasto: Number(d.gasto) })),
  };
}

/** Tudo o que a tela de tráfego mostra, já cruzado: gasto de um lado, venda paga do outro. */
export type TrafegoDaTela = {
  de: string;
  ate: string;
  comparacao: string;
  /** `null` quando a leitura do gasto falhou. */
  gasto: ResumoDeGasto | null;
  gastoAnterior: number | null;
  linhas: LinhaDeRetorno[];
  /** Faturamento pago da loja no período, com e sem etiqueta. */
  vendaDaLoja: number;
  /** Vendas registradas por fora da loja no período. */
  porFora: number;
  /** Faturamento pago que chegou sem etiqueta de origem. */
  semEtiqueta: number;
  porDia: { dia: string; venda: number; gasto: number }[];
};

export async function lerTrafegoDaTela(db: SupabaseClient, chave: ChaveDePeriodo, hoje: string): Promise<TrafegoDaTela> {
  const { de, ate, anteriorDe, anteriorAte, comparacao } = intervaloDoPeriodo(chave, hoje);
  const [gasto, anterior, vendas, porFora] = await Promise.all([
    lerResumoDeGasto(db, de, ate),
    lerResumoDeGasto(db, anteriorDe, anteriorAte),
    lerResumoDeVendas(db, de, ate),
    lerResumoPorFora(db, de, ate),
  ]);

  const canais = agruparPorCanal(vendas?.por_origem ?? []);
  const vendaDoDia = new Map((vendas?.por_dia ?? []).map((d) => [d.dia, Number(d.valor_pago)]));
  const gastoDoDia = new Map((gasto?.por_dia ?? []).map((d) => [d.dia, d.gasto]));

  return {
    de,
    ate,
    comparacao,
    gasto,
    gastoAnterior: anterior ? anterior.gasto : null,
    linhas: retornoPorPlataforma(gasto?.por_plataforma ?? [], canais),
    vendaDaLoja: Number(vendas?.totais.valor_pago ?? 0),
    porFora: Number(porFora?.valor ?? 0),
    semEtiqueta: canais.find((c) => c.canal === "sem_etiqueta")?.valor ?? 0,
    porDia: diasEntre(de, ate).map((dia) => ({ dia, venda: vendaDoDia.get(dia) ?? 0, gasto: gastoDoDia.get(dia) ?? 0 })),
  };
}
