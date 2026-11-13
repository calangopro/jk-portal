import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerFunilDoSite, type LeituraDoFunil } from "../ga4/funil";
import { lerItensDoPeriodo, lerResumoDeGasto } from "../trafego/dados";
import { diagnosticar, type Achado } from "../trafego/diagnostico";
import { canalDaOrigem } from "../vendas/origem";
import { intervaloDoPeriodo, type ChaveDePeriodo } from "../vendas/periodo";
import { juntarMeios, mapearGargalos, type Faixa, type Gargalo, type Meio } from "./gargalos";
import { IMPOSTO_DA_FATURA, MARGEM_DE_REFERENCIA, voltaParaEmpatar } from "./premissas";

/**
 * Tudo o que a tela de gargalos cruza: os pedidos da Tray, o gasto e as
 * campanhas das duas plataformas e o funil da loja no GA4.
 *
 * Cada fonte falha sozinha. Sem GA4 a tela perde só o funil do site; sem a
 * leitura das campanhas, só a parte de plataforma. O mapa de gargalos é montado
 * com o que veio.
 */

export type PlataformaContraLoja = {
  plataforma: "meta" | "google";
  nome: string;
  gasto: number;
  /** Gasto com o imposto que a fatura soma. Igual ao gasto quando não há imposto. */
  gastoComImposto: number;
  comprasInformadas: number;
  valorInformado: number;
  criados: number;
  pagos: number;
  cancelados: number;
  valorPago: number;
  valorCancelado: number;
  /** Venda paga com a etiqueta para cada R$ 1 pago à plataforma. */
  volta: number | null;
  custoPorVendaPaga: number | null;
  foraDeVenda: number | null;
};

export type GargalosDaTela = {
  de: string;
  ate: string;
  totais: { pedidos: number; pagos: number; cancelados: number; aguardando: number; valor_pago: number; valor_cancelado: number; clientes: number; clientes_que_pagaram: number } | null;
  faixas: Faixa[];
  meios: Meio[];
  repetidos: { pedidos_a_mais: number; clientes: number } | null;
  site: LeituraDoFunil;
  plataformas: PlataformaContraLoja[];
  margem: number;
  empate: number;
  gargalos: Gargalo[];
  vencedores: (Achado & { plataforma: string })[];
  pessimos: (Achado & { plataforma: string })[];
};

type Origem = { origem: string; criados: number; pagos: number; cancelados: number; valor_pago: number; valor_cancelado: number };

export async function lerGargalosDaTela(db: SupabaseClient, chave: ChaveDePeriodo, hoje: string): Promise<GargalosDaTela> {
  const { de, ate } = intervaloDoPeriodo(chave, hoje);
  const [raioX, gasto, itensDoMeta, itensDoGoogle, site] = await Promise.all([
    db.rpc("raio_x_dos_pedidos", { p_de: de, p_ate: ate }),
    lerResumoDeGasto(db, de, ate),
    lerItensDoPeriodo(db, "meta", de, ate),
    lerItensDoPeriodo(db, "google", de, ate),
    lerFunilDoSite(de, ate),
  ]);
  if (raioX.error) console.error("[gargalos] raio_x_dos_pedidos:", raioX.error.message);

  const r = (raioX.data ?? null) as {
    totais?: GargalosDaTela["totais"];
    faixas?: Faixa[];
    meios?: { tipo: string; pedidos: number; pagos: number; cancelados: number; valor_cancelado: number }[];
    repetidos?: GargalosDaTela["repetidos"];
    por_origem?: Origem[];
  } | null;
  const totais = r?.totais ? { ...r.totais, valor_pago: Number(r.totais.valor_pago), valor_cancelado: Number(r.totais.valor_cancelado) } : null;
  const faixas = (r?.faixas ?? []).map((f) => ({ ...f, valor_pago: Number(f.valor_pago), valor_cancelado: Number(f.valor_cancelado) }));
  const meios = juntarMeios(r?.meios ?? []);

  // A loja por canal, com a mesma função de origem da tela de vendas.
  const porCanal = new Map<string, { criados: number; pagos: number; cancelados: number; valorPago: number; valorCancelado: number }>();
  for (const o of r?.por_origem ?? []) {
    const canal = canalDaOrigem(o.origem);
    const a = porCanal.get(canal) ?? { criados: 0, pagos: 0, cancelados: 0, valorPago: 0, valorCancelado: 0 };
    a.criados += Number(o.criados);
    a.pagos += Number(o.pagos);
    a.cancelados += Number(o.cancelados);
    a.valorPago += Number(o.valor_pago);
    a.valorCancelado += Number(o.valor_cancelado);
    porCanal.set(canal, a);
  }

  const diagnosticos = { meta: itensDoMeta ? diagnosticar(itensDoMeta, "meta") : null, google: itensDoGoogle ? diagnosticar(itensDoGoogle, "google") : null };
  const plataformas: PlataformaContraLoja[] = (
    [
      { plataforma: "meta", nome: "Meta", canal: "meta" },
      { plataforma: "google", nome: "Google Ads", canal: "google_ads" },
    ] as const
  )
    .map(({ plataforma, nome, canal }) => {
      const gastoDaPlataforma = gasto?.por_plataforma.find((g) => g.plataforma === plataforma)?.gasto ?? 0;
      const gastoComImposto = Math.round(gastoDaPlataforma * (1 + (IMPOSTO_DA_FATURA[plataforma] ?? 0)) * 100) / 100;
      const loja = porCanal.get(canal) ?? { criados: 0, pagos: 0, cancelados: 0, valorPago: 0, valorCancelado: 0 };
      const d = diagnosticos[plataforma];
      const foraDeVenda = d && d.totais.gasto > 0 ? 1 - (d.verba.find((v) => v.objetivo === "venda")?.fatia ?? 0) : null;
      return {
        plataforma,
        nome,
        gasto: gastoDaPlataforma,
        gastoComImposto,
        comprasInformadas: d?.totais.compras ?? 0,
        valorInformado: d?.totais.valor ?? 0,
        ...loja,
        volta: gastoComImposto > 0 ? loja.valorPago / gastoComImposto : null,
        custoPorVendaPaga: gastoComImposto > 0 && loja.pagos > 0 ? gastoComImposto / loja.pagos : null,
        foraDeVenda,
      };
    })
    .filter((p) => p.gasto > 0 || p.valorPago > 0);

  const empate = voltaParaEmpatar();
  const gargalos = mapearGargalos({
    pedidos: totais,
    faixas,
    meios,
    repetidos: r?.repetidos ?? null,
    site: site.funil?.tudo ?? null,
    plataformas: plataformas.map((p) => ({ plataforma: p.plataforma, nome: p.nome, gasto: p.gastoComImposto, valorInformado: p.valorInformado, valorPago: p.valorPago, foraDeVenda: p.foraDeVenda })),
    semEtiqueta: porCanal.get("sem_etiqueta")?.valorPago ?? 0,
    empate,
  });

  const achados = (tipo: Achado["tipo"]) =>
    (["meta", "google"] as const)
      .flatMap((p) => (diagnosticos[p]?.achados ?? []).filter((a) => a.tipo === tipo).slice(0, 3).map((a) => ({ ...a, plataforma: p === "meta" ? "Meta" : "Google Ads" })));

  return {
    de,
    ate,
    totais,
    faixas,
    meios,
    repetidos: r?.repetidos ?? null,
    site,
    plataformas,
    margem: MARGEM_DE_REFERENCIA,
    empate,
    gargalos,
    vencedores: achados("crescer"),
    pessimos: achados("rever"),
  };
}
