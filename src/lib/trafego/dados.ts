import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vendasPorItem, type Cobertura, type VendaDoItem } from "../origem/anotado";
import { lerOrigemDosPedidos } from "../origem/dados";
import { lerResumoDeVendas } from "../vendas/dados";
import { agruparPorCanal } from "../vendas/origem";
import { diasEntre, intervaloDoPeriodo, type ChaveDePeriodo } from "../vendas/periodo";
import { lerResumoPorFora } from "../vendas/por-fora";
import { retornoPorPlataforma, type LinhaDeRetorno } from "./retorno";
import { diagnosticar, type Diagnostico, type Item } from "./diagnostico";

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

// ---------------------------------------------------------------------------
// Campanhas, conjuntos e anúncios (0061)
// ---------------------------------------------------------------------------

export type CampanhasDaTela = {
  plataforma: "meta" | "google";
  de: string;
  ate: string;
  /** `null` quando a leitura falhou. */
  diagnostico: Diagnostico | null;
  /** O que a LOJA recebeu com a etiqueta da plataforma: pedidos criados, pagos e o valor pago. */
  loja: { criados: number; pagos: number; valor: number };
  /**
   * A venda da loja ligada a cada item pelo coletor de origem, por `nivel:id`,
   * e a cobertura do período. `null` quando a leitura falhou.
   */
  anotado: { itens: Record<string, VendaDoItem>; cobertura: Cobertura } | null;
};

/** Os itens de uma plataforma somados no intervalo. `null` quando a leitura falhou. */
export async function lerItensDoPeriodo(db: SupabaseClient, plataforma: "meta" | "google", de: string, ate: string): Promise<Item[] | null> {
  const { data, error } = await db.rpc("resumo_de_anuncios", { p_de: de, p_ate: ate, p_plataforma: plataforma });
  if (error) {
    console.error("[trafego] resumo_de_anuncios:", error.message);
    return null;
  }
  const num = (v: unknown) => (v == null ? null : Number(v));
  return ((data ?? []) as Record<string, unknown>[])
    .map((i) => ({
      nivel: i.nivel as Item["nivel"],
      id: String(i.id),
      nome: String(i.nome ?? ""),
      campanha_id: (i.campanha_id as string | null) ?? null,
      conjunto_id: (i.conjunto_id as string | null) ?? null,
      tipo: (i.tipo as string | null) ?? null,
      ativo: (i.ativo as boolean | null) ?? null,
      gasto: Number(i.gasto ?? 0),
      impressoes: Number(i.impressoes ?? 0),
      cliques: Number(i.cliques ?? 0),
      cliques_todos: num(i.cliques_todos),
      visitas: num(i.visitas),
      carrinhos: num(i.carrinhos),
      checkouts: num(i.checkouts),
      compras: num(i.compras),
      valor: num(i.valor),
      conversas: num(i.conversas),
    }))
    // Item que não gastou nem apareceu no período só ocupa lugar na lista.
    .filter((i) => i.gasto > 0 || i.impressoes > 0);
}

/**
 * Os itens da plataforma no período, já julgados, e a venda paga da loja com a
 * etiqueta dela para pôr ao lado do que a plataforma diz.
 */
export async function lerCampanhasDaTela(db: SupabaseClient, plataforma: "meta" | "google", chave: ChaveDePeriodo, hoje: string): Promise<CampanhasDaTela> {
  const { de, ate } = intervaloDoPeriodo(chave, hoje);
  const [lista, vendas, origem] = await Promise.all([
    lerItensDoPeriodo(db, plataforma, de, ate),
    lerResumoDeVendas(db, de, ate),
    lerOrigemDosPedidos(db, de, ate),
  ]);
  const canal = agruparPorCanal(vendas?.por_origem ?? []).find((c) => c.canal === (plataforma === "meta" ? "meta" : "google_ads"));
  return {
    plataforma,
    de,
    ate,
    diagnostico: lista ? diagnosticar(lista, plataforma) : null,
    loja: { criados: canal?.criados ?? 0, pagos: canal?.pagos ?? 0, valor: canal?.valor ?? 0 },
    anotado: origem ? { itens: vendasPorItem(origem.por_item, plataforma), cobertura: origem.cobertura } : null,
  };
}
