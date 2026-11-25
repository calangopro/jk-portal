import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularCpaIdeal, calcularMedias, type CpaIdeal, type Medias } from "@/lib/custos/medias";
import { custoDoProduto, type CustoGravado, type Familia, type Material, type Parametros } from "@/lib/margem/calculo";
import { lerFamilias, lerParametros } from "@/lib/margem/dados";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaDasCascatas, montarCascata, type Cascata, type EntradaDaCascata, type MediasParaCascata, type TipoDaLinha } from "./cascata";
import { diasEntre, hojeEmSaoPaulo, somarDias } from "./periodo";

/**
 * A cascata de UMA venda e a média por venda de um período, com os dados do banco
 * (cartões 80 e 81). O custo das peças sai das regras da Margem (cartão 82), e
 * com a caixinha nas regras ela sai da média de embalagem da lista de Custos. É custo da empresa: só quem é administrador chama, e quem
 * chama passa o cliente de serviço (as tabelas de custo e `appmax_pedidos` só
 * abrem para ele).
 *
 * O EXATO ONDE HÁ, A MÉDIA ONDE NÃO HÁ. A taxa lida na Appmax, o frete que o
 * cliente pagou e o custo da peça pela Margem são do pedido. O resto vem das
 * médias do período (`lib/custos/medias.ts`): a lista de Custos dividida pelo
 * que se vendeu, a taxa medida, o gasto real de anúncio. A conta de médias
 * lê o período inteiro, então fica guardada por alguns minutos (`lerMediasDaLoja`).
 */

type Cru = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const centavos = (v: number) => Math.round(v * 100) / 100;

type ItemComCusto = EntradaDaCascata["itens"][number];

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

  const doItem = (i: Cru): ItemComCusto => {
    const produto = doCodigo.get(String(i.produto_tray_id ?? ""));
    const nome = String(i.nome ?? produto?.nome ?? "Peça");
    const custo = custoDoProduto(produto ? (gravadoDe.get(produto.id) ?? null) : null, mapaFamilias, parametros, produto?.nome ?? nome);
    return { nome, quantidade: Math.max(Math.round(num(i.quantidade) ?? 1), 1), custo: custo.valor, falta: custo.falta, preco: num(i.preco) };
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
    ["gramas por mm da prata", !p.regras?.gramasPorMm.prata_950.alianca && !p.prataGramasPorMm],
    ["margem mínima", p.margemMinima === null],
  ];
  return vazios.filter(([, vazio]) => vazio).map(([nome]) => nome);
}

// ------------------------------------------------------------------ o período

type Taxa = { processamento: number; gateway: number; descontado: number };

type Carga = {
  de: string;
  ate: string;
  pedidos: Cru[];
  itensDe: Map<number, ItemComCusto[]>;
  taxas: Map<number, Taxa>;
  parametros: Parametros;
  medias: Medias;
  paraCascata: MediasParaCascata;
  cortado: boolean;
};

const TETO_DE_PEDIDOS = 3000;

/** Lê o período inteiro e calcula as médias. É a parte pesada: quem precisa só das médias usa `lerMediasDaLoja`, que guarda o resultado. */
async function carregarPeriodo(db: SupabaseClient, de: string, ate: string): Promise<Carga> {
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
  const taxas = new Map<number, Taxa>();
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

  const itensCrus = pedidos.flatMap((p) => (Array.isArray(p.itens) ? (p.itens as Cru[]) : []));
  const [{ parametros, doItem }, gasto, despesas] = await Promise.all([
    contextoDeCusto(db, itensCrus),
    db.from("anuncios_gasto").select("gasto").eq("campanha", "").gte("dia", de).lte("dia", ate).limit(5000),
    db.from("despesas").select("nome, categoria, tipo, valor, ativo, confirmado").eq("ativo", true),
  ]);

  const itensDe = new Map<number, ItemComCusto[]>();
  for (const p of pedidos) itensDe.set(Number(p.pedido), (Array.isArray(p.itens) ? (p.itens as Cru[]) : []).map(doItem));

  // As somas que as médias precisam, tiradas dos mesmos pedidos.
  let faturamento = 0, freteCobradoTotal = 0, vendasComFreteCobrado = 0, totalLido = 0, descontado = 0, lidos = 0;
  let pecasVendas = 0, pecasReceita = 0, pecasCusto = 0;
  for (const p of pedidos) {
    const total = num(p.total) ?? 0;
    const frete = num(p.frete_valor) ?? 0;
    faturamento += total;
    freteCobradoTotal += frete;
    if (frete > 0) vendasComFreteCobrado++;
    const t = taxas.get(Number(p.pedido));
    if (t) {
      lidos++;
      totalLido += total;
      descontado += t.descontado;
    }
    const itens = itensDe.get(Number(p.pedido)) ?? [];
    if (itens.length > 0 && itens.every((i) => i.custo !== null && typeof i.preco === "number" && i.preco > 0)) {
      pecasVendas++;
      for (const i of itens) {
        pecasReceita += (i.preco as number) * i.quantidade;
        pecasCusto += (i.custo as number) * i.quantidade;
      }
    }
  }
  const gastoTotal = (gasto.data ?? []).reduce((s, l) => s + (num((l as Cru).gasto) ?? 0), 0);

  const medias = calcularMedias({
    despesas: ((despesas.data ?? []) as Cru[]).map((d) => ({
      nome: String(d.nome ?? ""),
      categoria: String(d.categoria ?? ""),
      tipo: d.tipo === "por_pedido" ? "por_pedido" : "mensal",
      valor: num(d.valor) ?? 0,
      ativo: d.ativo !== false,
      confirmado: Boolean(d.confirmado),
    })),
    dias: diasEntre(de, ate).length,
    vendas: pedidos.length,
    faturamento,
    freteCobradoTotal,
    vendasComFreteCobrado,
    taxaMedida: lidos > 0 ? { total: totalLido, descontado, pedidos: lidos } : null,
    anuncioReal: gastoTotal > 0 ? gastoTotal : null,
    custoDasPecas: pecasVendas > 0 ? { vendas: pecasVendas, receita: pecasReceita, custo: pecasCusto } : null,
    caixinhaNoProduto: parametros.regras?.caixinha !== null && parametros.regras?.caixinha !== undefined,
  });

  const paraCascata: MediasParaCascata = {
    taxaFracao: medias.taxa?.fracao ?? null,
    impostoFracao: medias.imposto?.fracao ?? null,
    freteGratis: medias.frete?.porVendaGratis ?? null,
    embalagem: medias.embalagem?.porVenda ?? null,
    pecasFracao: medias.pecas?.confiavel ? medias.pecas.fracaoDaReceita : null,
  };
  return { de, ate, pedidos, itensDe, taxas, parametros, medias, paraCascata, cortado };
}

const textoDoAnuncio = (m: Medias) =>
  m.anuncio ? `Rateio: R$ ${m.anuncio.gasto.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} gastos em anúncio no período, divididos pelos ${m.vendas} pedidos pagos. Não é o anúncio que trouxe este pedido.` : undefined;

function cascataDoPedido(c: Carga, p: Cru): Cascata {
  return montarCascata({
    total: num(p.total) ?? 0,
    freteCobrado: num(p.frete_valor) ?? 0,
    taxaReal: c.taxas.get(Number(p.pedido)) ?? null,
    parametros: PARAMETROS_DA_CASCATA(c.parametros),
    itens: c.itensDe.get(Number(p.pedido)) ?? [],
    anuncioPorVenda: c.medias.anuncio?.porVenda ?? null,
    anuncioDetalhe: textoDoAnuncio(c.medias),
    medias: c.paraCascata,
  });
}

// ------------------------------------------------------------------ as médias da loja, guardadas

export type MediasDaLoja = { medias: Medias; paraCascata: MediasParaCascata };

const DIAS_DAS_MEDIAS = 30;

/** As médias dos últimos 30 dias, guardadas por 10 minutos: é a parte pesada e muda devagar. Só o painel de administrador chama. */
export const lerMediasDaLoja = unstable_cache(
  async (hoje: string): Promise<MediasDaLoja> => {
    const c = await carregarPeriodo(createAdminClient(), somarDias(hoje, -(DIAS_DAS_MEDIAS - 1)), hoje);
    return { medias: c.medias, paraCascata: c.paraCascata };
  },
  ["medias-da-loja-v3"],
  { revalidate: 600, tags: ["medias-da-loja"] },
);

export const mediasDeHoje = () => lerMediasDaLoja(hojeEmSaoPaulo());

// ------------------------------------------------------------------ uma venda

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

export async function lerSobraDoPedido(db: SupabaseClient, numero: number): Promise<SobraDoPedido> {
  const { data: pedido } = await db
    .from("tray_pedidos")
    .select("pedido, total, frete_valor, situacao, itens")
    .eq("pedido", numero)
    .maybeSingle();
  if (!pedido) return { tipo: "nao_achado" };

  const itensCrus = (Array.isArray(pedido.itens) ? pedido.itens : []) as Cru[];
  const [{ parametros, doItem }, appmax, { medias, paraCascata }] = await Promise.all([
    contextoDeCusto(db, itensCrus),
    db.from("appmax_pedidos").select("meio, parcelas, descontado, taxa_processamento, taxa_gateway, lido_em").eq("pedido", numero).maybeSingle(),
    mediasDeHoje(),
  ]);

  const lido = appmax.data && appmax.data.lido_em ? appmax.data : null;
  const cascata = montarCascata({
    total: num(pedido.total) ?? 0,
    freteCobrado: num(pedido.frete_valor) ?? 0,
    taxaReal: lido ? { processamento: num(lido.taxa_processamento) ?? 0, gateway: num(lido.taxa_gateway) ?? 0, descontado: num(lido.descontado) ?? 0 } : null,
    parametros: PARAMETROS_DA_CASCATA(parametros),
    itens: itensCrus.map(doItem),
    anuncioPorVenda: medias.anuncio?.porVenda ?? null,
    anuncioDetalhe: textoDoAnuncio(medias),
    medias: paraCascata,
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

// ------------------------------------------------------------------ a média do período

export type SobraDoPeriodo = {
  de: string;
  ate: string;
  vendas: number;
  /** Vendas com todas as linhas da cascata preenchidas (exato ou média). */
  completas: number;
  /** Vendas com a taxa lida na Appmax (as outras usam a média medida). */
  comTaxaLida: number;
  ticketMedio: number | null;
  /** A sobra média por venda, em reais e sobre o ticket. */
  sobraMedia: number | null;
  fracao: number | null;
  /** O que sai de cada venda em média, por linha (o que falta numa venda conta zero nela). Nulo quando nenhuma venda tem número. */
  porTipo: Record<TipoDaLinha, number | null>;
  /** Em quantas vendas cada linha é exata: sem média nem falta. */
  exatas: Record<TipoDaLinha, number>;
  /** Em quantas vendas cada linha está em falta. */
  faltaEm: Record<TipoDaLinha, number>;
  semParametros: string[];
  /** A leitura parou no teto: o período tem mais vendas do que as mostradas. */
  cortado: boolean;
  /** Quanto custa cada coisa por venda, e de onde saiu (a lista de Custos dividida pelo que se vendeu). */
  medias: Medias;
  /** O CPA ideal do período, da margem de contribuição. */
  cpa: CpaIdeal | null;
};

async function sobraDoPeriodoSemCache(de: string, ate: string): Promise<SobraDoPeriodo> {
  const c = await carregarPeriodo(createAdminClient(), de, ate);
  const cascatas = c.pedidos.map((p) => cascataDoPedido(c, p));
  const m = mediaDasCascatas(cascatas);
  const exatas = {} as Record<TipoDaLinha, number>;
  for (const t of ["taxa", "imposto", "custo", "frete", "embalagem", "anuncio"] as TipoDaLinha[]) {
    exatas[t] = cascatas.filter((x) => x.linhas.find((l) => l.tipo === t)?.origem === "real").length;
  }
  const ticket = m.vendas ? centavos(m.total / m.vendas) : null;
  // Uma linha só entra no CPA se pelo menos 80% das vendas têm número nela: com menos, o valor médio só vale para
  // as poucas que têm, e o CPA sairia otimista. Fora do CPA, ela vira "falta" e o CPA sai parcial.
  const bastaParaOCpa = (t: TipoDaLinha) => m.vendas > 0 && 1 - m.faltaEm[t] / m.vendas >= 0.8;
  const cpa = ticket !== null
    ? calcularCpaIdeal({
        ticket,
        pecas: bastaParaOCpa("custo") ? m.porTipo.custo : null,
        taxa: bastaParaOCpa("taxa") ? m.porTipo.taxa : null,
        imposto: bastaParaOCpa("imposto") ? m.porTipo.imposto : null,
        frete: bastaParaOCpa("frete") ? m.porTipo.frete : null,
        embalagem: bastaParaOCpa("embalagem") ? m.porTipo.embalagem : null,
        fixo: c.medias.fixo?.porVenda ?? null,
        margemMinima: c.parametros.margemMinima,
        cpaReal: c.medias.anuncio?.porVenda ?? null,
      })
    : null;
  return {
    de,
    ate,
    vendas: m.vendas,
    completas: m.completas,
    comTaxaLida: exatas.taxa,
    ticketMedio: ticket,
    sobraMedia: m.vendas ? centavos(m.sobra / m.vendas) : null,
    fracao: m.fracao,
    porTipo: m.porTipo,
    exatas,
    faltaEm: m.faltaEm,
    semParametros: parametrosVazios(c.parametros),
    cortado: c.cortado,
    medias: c.medias,
    cpa,
  };
}

/** A média por venda do período. Guardada por 2 minutos por período; é custo da empresa, só o administrador chama. */
export const sobraDoPeriodo = unstable_cache(sobraDoPeriodoSemCache, ["sobra-do-periodo-v3"], { revalidate: 120, tags: ["sobra-do-periodo"] });
