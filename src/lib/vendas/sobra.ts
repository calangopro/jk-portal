import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { custoDoProduto, type CustoGravado, type Familia, type Material, type Parametros } from "@/lib/margem/calculo";
import { lerFamilias, lerParametros } from "@/lib/margem/dados";
import { mediaDasCascatas, montarCascata, type Cascata, type EntradaDaCascata, type TipoDaLinha } from "./cascata";
import { hojeEmSaoPaulo, somarDias } from "./periodo";

/**
 * A cascata de UMA venda, com os dados do banco (cartão 80). É custo da
 * empresa: só quem é administrador chama, e quem chama passa o cliente de
 * serviço (as tabelas de custo e `appmax_pedidos` só abrem para ele).
 */

type Cru = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export type SobraDoPedido =
  | { tipo: "nao_achado" }
  | {
      tipo: "ok";
      numero: number;
      pago: boolean;
      meio: string | null;
      parcelas: number | null;
      cascata: Cascata;
      /** Os parâmetros da Margem que ainda estão vazios, para a tela dizer o que preencher. */
      semParametros: string[];
    };

/** O rateio de anúncio por venda: o gasto lançado nos últimos 30 dias dividido pelos pedidos pagos no mesmo período. */
export async function anuncioPorVenda(db: SupabaseClient): Promise<{ valor: number | null; detalhe: string }> {
  const hoje = hojeEmSaoPaulo();
  const desde = somarDias(hoje, -29);
  const [gasto, pagos] = await Promise.all([
    db.from("anuncios_gasto").select("gasto").eq("campanha", "").gte("dia", desde).lte("dia", hoje).limit(2000),
    db.from("tray_pedidos").select("pedido", { count: "exact", head: true }).eq("situacao", "pago").gte("dia", desde).lte("dia", hoje),
  ]);
  const total = (gasto.data ?? []).reduce((s, l) => s + (num(l.gasto) ?? 0), 0);
  const quantos = pagos.count ?? 0;
  if (total <= 0 || quantos <= 0) return { valor: null, detalhe: "Sem gasto de anúncio lançado nos últimos 30 dias." };
  const valor = Math.round((total / quantos) * 100) / 100;
  return {
    valor,
    detalhe: `Rateio: R$ ${total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} gastos em anúncio nos últimos 30 dias, divididos pelos ${quantos} pedidos pagos. Não é o anúncio que trouxe este pedido.`,
  };
}

/** Tudo o que a conta de custo precisa para os produtos de uma lista de pedidos: parâmetros, famílias e o custo gravado de cada produto. */
async function contextoDeCusto(db: SupabaseClient, itensCrus: Cru[]) {
  const codigos = Array.from(new Set(itensCrus.map((i) => String(i.produto_tray_id ?? "")).filter(Boolean)));
  const doCodigo = new Map<string, { id: string; nome: string }>();
  for (let i = 0; i < codigos.length; i += 300) {
    const { data } = await db.from("products").select("id, tray_id, name").in("tray_id", codigos.slice(i, i + 300));
    for (const p of data ?? []) doCodigo.set(String((p as Cru).tray_id), { id: String((p as Cru).id), nome: String((p as Cru).name ?? "") });
  }
  const ids = [...doCodigo.values()].map((p) => p.id);
  const gravadoDe = new Map<string, CustoGravado>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("produto_custos").select("product_id, material, familia, gramas, resto, custo_fixo").in("product_id", ids.slice(i, i + 300));
    for (const l of data ?? []) {
      gravadoDe.set(String((l as Cru).product_id), {
        material: ((l as Cru).material as Material | null) ?? null,
        familia: ((l as Cru).familia as string | null) ?? null,
        gramas: num((l as Cru).gramas),
        resto: num((l as Cru).resto),
        custoFixo: num((l as Cru).custo_fixo),
      });
    }
  }
  const [parametros, familias] = await Promise.all([lerParametros(db), lerFamilias(db)]);
  const mapaFamilias = new Map<string, Familia>(familias.map((f) => [f.codigo, f]));

  const doItem = (i: Cru): EntradaDaCascata["itens"][number] => {
    const produto = doCodigo.get(String(i.produto_tray_id ?? ""));
    const nome = String(i.nome ?? produto?.nome ?? "Peça");
    const custo = custoDoProduto(produto ? (gravadoDe.get(produto.id) ?? null) : null, mapaFamilias, parametros, produto?.nome ?? nome);
    return { nome, quantidade: Math.max(Math.round(num(i.quantidade) ?? 1), 1), custo: custo.valor, falta: custo.falta };
  };
  return { parametros, doItem };
}

const PARAMETROS_DA_CASCATA = (p: Parametros): EntradaDaCascata["parametros"] => ({ taxa: p.taxa, tarifaFixa: p.tarifaFixa, imposto: p.imposto, frete: p.frete, embalagem: p.embalagem });

function parametrosVazios(p: Parametros): string[] {
  const vazios: [string, boolean][] = [
    ["imposto", p.imposto === null],
    ["frete médio", p.frete === null],
    ["embalagem", p.embalagem === null],
    ["preço do grama", p.cotacao18k === null && p.cotacaoPrata === null],
    ["margem mínima", p.margemMinima === null],
  ];
  return vazios.filter(([, vazio]) => vazio).map(([nome]) => nome);
}

export async function lerSobraDoPedido(db: SupabaseClient, numero: number): Promise<SobraDoPedido> {
  const { data: pedido } = await db
    .from("tray_pedidos")
    .select("pedido, total, frete_valor, situacao, itens")
    .eq("pedido", numero)
    .maybeSingle();
  if (!pedido) return { tipo: "nao_achado" };

  const itensCrus = (Array.isArray(pedido.itens) ? pedido.itens : []) as Cru[];
  const [{ parametros, doItem }, appmax, rateio] = await Promise.all([
    contextoDeCusto(db, itensCrus),
    db.from("appmax_pedidos").select("meio, parcelas, descontado, taxa_processamento, taxa_gateway, lido_em").eq("pedido", numero).maybeSingle(),
    anuncioPorVenda(db),
  ]);

  const lido = appmax.data && appmax.data.lido_em ? appmax.data : null;
  const cascata = montarCascata({
    total: num(pedido.total) ?? 0,
    freteCobrado: num(pedido.frete_valor) ?? 0,
    taxaReal: lido ? { processamento: num(lido.taxa_processamento) ?? 0, gateway: num(lido.taxa_gateway) ?? 0, descontado: num(lido.descontado) ?? 0 } : null,
    parametros: PARAMETROS_DA_CASCATA(parametros),
    itens: itensCrus.map(doItem),
    anuncioPorVenda: rateio.valor,
    anuncioDetalhe: rateio.detalhe,
  });

  return {
    tipo: "ok",
    numero,
    pago: pedido.situacao === "pago",
    meio: (appmax.data?.meio as string | null) ?? null,
    parcelas: num(appmax.data?.parcelas),
    cascata,
    semParametros: parametrosVazios(parametros),
  };
}

// ------------------------------------------------------------------ o período

export type SobraDoPeriodo = {
  de: string;
  ate: string;
  vendas: number;
  /** Vendas com todas as linhas da cascata preenchidas. */
  completas: number;
  /** Vendas com a taxa lida na Appmax (as outras usam a média da Margem). */
  comTaxaLida: number;
  ticketMedio: number | null;
  /** A sobra média por venda, em reais e sobre o ticket. */
  sobraMedia: number | null;
  fracao: number | null;
  /** O que sai de cada venda em média, por linha (o que falta numa venda conta zero nela). Nulo quando nenhuma venda tem número. */
  porTipo: Record<TipoDaLinha, number | null>;
  /** Em quantas vendas cada linha é inteira: sem peça sem custo nem parâmetro vazio. */
  inteiras: Record<TipoDaLinha, number>;
  semParametros: string[];
  /** A leitura parou no teto: o período tem mais vendas do que as mostradas. */
  cortado: boolean;
};

const TETO_DE_PEDIDOS = 3000;

/** A média de cada linha da cascata por venda paga no período. É custo da empresa: só o administrador chama. */
export async function sobraDoPeriodo(db: SupabaseClient, de: string, ate: string): Promise<SobraDoPeriodo> {
  const pedidos: Cru[] = [];
  let cortado = false;
  for (let desde = 0; ; desde += 1000) {
    const { data } = await db
      .from("tray_pedidos")
      .select("pedido, total, frete_valor, itens")
      .eq("situacao", "pago")
      .gte("dia", de)
      .lte("dia", ate)
      .order("pedido", { ascending: false })
      .range(desde, desde + 999);
    pedidos.push(...((data ?? []) as Cru[]));
    if ((data ?? []).length < 1000) break;
    if (pedidos.length >= TETO_DE_PEDIDOS) {
      cortado = true;
      break;
    }
  }

  const numeros = pedidos.map((p) => Number(p.pedido));
  const taxas = new Map<number, { processamento: number; gateway: number; descontado: number }>();
  for (let i = 0; i < numeros.length; i += 400) {
    const { data } = await db
      .from("appmax_pedidos")
      .select("pedido, descontado, taxa_processamento, taxa_gateway")
      .in("pedido", numeros.slice(i, i + 400))
      .not("lido_em", "is", null);
    for (const l of data ?? []) {
      taxas.set(Number((l as Cru).pedido), { processamento: num((l as Cru).taxa_processamento) ?? 0, gateway: num((l as Cru).taxa_gateway) ?? 0, descontado: num((l as Cru).descontado) ?? 0 });
    }
  }

  const itensTodos = pedidos.flatMap((p) => (Array.isArray(p.itens) ? (p.itens as Cru[]) : []));
  const [{ parametros, doItem }, gasto] = await Promise.all([
    contextoDeCusto(db, itensTodos),
    db.from("anuncios_gasto").select("gasto").eq("campanha", "").gte("dia", de).lte("dia", ate).limit(5000),
  ]);
  const gastoTotal = (gasto.data ?? []).reduce((s, l) => s + (num((l as Cru).gasto) ?? 0), 0);
  const porVenda = pedidos.length > 0 && gastoTotal > 0 ? Math.round((gastoTotal / pedidos.length) * 100) / 100 : null;

  const cascatas = pedidos.map((p) =>
    montarCascata({
      total: num(p.total) ?? 0,
      freteCobrado: num(p.frete_valor) ?? 0,
      taxaReal: taxas.get(Number(p.pedido)) ?? null,
      parametros: PARAMETROS_DA_CASCATA(parametros),
      itens: (Array.isArray(p.itens) ? (p.itens as Cru[]) : []).map(doItem),
      anuncioPorVenda: porVenda,
    }),
  );
  const m = mediaDasCascatas(cascatas);
  return {
    de,
    ate,
    vendas: m.vendas,
    completas: m.completas,
    comTaxaLida: cascatas.filter((c) => c.linhas.find((l) => l.tipo === "taxa")?.origem === "real").length,
    ticketMedio: m.vendas ? Math.round((m.total / m.vendas) * 100) / 100 : null,
    sobraMedia: m.vendas ? Math.round((m.sobra / m.vendas) * 100) / 100 : null,
    fracao: m.fracao,
    porTipo: m.porTipo,
    inteiras: m.inteiras,
    semParametros: parametrosVazios(parametros),
    cortado,
  };
}
