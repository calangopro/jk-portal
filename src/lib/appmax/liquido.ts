/**
 * O que a Appmax descontou de cada venda, e como achar o pedido dela a partir
 * do pedido da Tray. Conta pura, sem rede e sem `server-only`: roda no teste
 * (`scripts/teste-pedidos-tray.mts`).
 *
 * A FONTE É `GET /v1/orders/total-liquid/{order_id}`, o mesmo detalhamento da
 * tela "Ver taxas" do pedido na Appmax: total do pedido, uma linha por taxa
 * (processamento, gateway e antifraude, parcelamento) e o líquido que a JK
 * recebe. Valores em reais. Conferido contra dois pedidos reais em 23/11/2026:
 * cartão (R$ 500,27: 3,49% = R$ 17,46 mais R$ 0,99, líquido R$ 481,82) e Pix
 * (R$ 398,71: 0,89% = R$ 3,55 mais R$ 0,99, líquido R$ 394,17).
 *
 * O NÚMERO DO PEDIDO DA APPMAX mora no pedido da Tray: em `Payment[].unique_number`
 * ("AM-133444274") e no começo de `Payment[].note`. A API da Appmax não lista
 * pedidos do lojista, então é por este número que se pede um a um.
 */

type Cru = Record<string, unknown>;

export type TaxaLida = {
  /** Como a Appmax escreve: "Taxa de processamento (3.49%)". */
  nome: string;
  /** Identificador interno da Appmax, quando vem. */
  interno: string | null;
  valor: number;
  tipo: "processamento" | "gateway" | "parcelamento" | "outra";
};

export type LiquidoLido = {
  totalPedido: number;
  liquido: number;
  /** O que saiu da venda: total do pedido menos o líquido. É a conta que vale. */
  descontado: number;
  taxaProcessamento: number;
  taxaGateway: number;
  taxaParcelamento: number;
  outras: number;
  taxas: TaxaLida[];
};

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

export function tipoDaTaxa(nome: string, interno: string | null): TaxaLida["tipo"] {
  const t = `${nome} ${interno ?? ""}`.toLowerCase();
  if (t.includes("gateway") || t.includes("antifraude") || t.includes("antifraud")) return "gateway";
  if (t.includes("parcelamento") || t.includes("installment")) return "parcelamento";
  if (t.includes("processamento") || t.includes("processing")) return "processamento";
  return "outra";
}

/**
 * Lê a resposta de `total-liquid`. Nulo quando não tem o total do pedido e o
 * líquido, que são o mínimo para a conta fechar.
 */
export function lerLiquido(resposta: unknown): LiquidoLido | null {
  const data = ((resposta as Cru | null)?.data ?? null) as Cru | null;
  const produtor = (data?.producer ?? null) as Cru | null;
  if (!produtor) return null;
  const totalPedido = numero(produtor.total_order);
  const liquido = numero(produtor.total_liquid ?? data?.total);
  if (totalPedido === null || liquido === null) return null;

  const taxas: TaxaLida[] = [];
  const lista = Array.isArray(produtor.processing_fee) ? (produtor.processing_fee as Cru[]) : [];
  for (const t of lista) {
    const valor = numero(t.value);
    if (valor === null) continue;
    const nome = String(t.key ?? "").slice(0, 120);
    const interno = t.internal_name ? String(t.internal_name).slice(0, 80) : null;
    taxas.push({ nome, interno, valor: centavos(valor), tipo: tipoDaTaxa(nome, interno) });
  }
  // Parcelamento pode vir fora da lista, em `installment_fee`.
  const parcelamentoFora = numero(produtor.installment_fee);
  if (parcelamentoFora && !taxas.some((t) => t.tipo === "parcelamento")) {
    taxas.push({ nome: "Taxa de parcelamento", interno: "installment_fee", valor: centavos(parcelamentoFora), tipo: "parcelamento" });
  }

  const soma = (tipo: TaxaLida["tipo"]) => centavos(taxas.filter((t) => t.tipo === tipo).reduce((s, t) => s + t.valor, 0));
  return {
    totalPedido: centavos(totalPedido),
    liquido: centavos(liquido),
    descontado: centavos(totalPedido - liquido),
    taxaProcessamento: soma("processamento"),
    taxaGateway: soma("gateway"),
    taxaParcelamento: soma("parcelamento"),
    outras: soma("outra"),
    taxas,
  };
}

export type VinculoComAppmax = {
  /** O número do pedido na Appmax. */
  id: number;
  /** `credit_card`, `pix`, `bank_slip`... como a Tray escreve. */
  meio: string | null;
  parcelas: number | null;
};

/**
 * O pedido da Appmax dentro do pedido completo da Tray. Nulo quando o pedido
 * não foi pago pela Appmax (outro meio, ou sem pagamento ainda).
 */
export function appmaxDoPedido(pedido: Cru): VinculoComAppmax | null {
  const pagamentos = Array.isArray(pedido.Payment) ? (pedido.Payment as Cru[]).map((p) => (p.Payment ?? p) as Cru) : [];
  let id: number | null = null;
  for (const p of pagamentos) {
    const unico = /^AM-(\d{3,12})$/.exec(String(p.unique_number ?? "").trim());
    const nota = /^(\d{3,12})\b/.exec(String(p.note ?? "").trim());
    const achado = unico?.[1] ?? (String(p.method ?? "").toLowerCase().includes("appmax") ? nota?.[1] : undefined);
    if (achado) {
      id = Number(achado);
      break;
    }
  }
  if (id === null || !Number.isSafeInteger(id)) return null;

  const vezes = /em\s+(\d{1,2})\s+vezes/i.exec(String(pedido.store_note ?? ""));
  const tipo = String(pedido.payment_method_type ?? "").trim().toLowerCase();
  // Parcelas só fazem sentido no cartão: o texto do Pix também diz "em N vezes" em alguns pedidos.
  return { id, meio: tipo || null, parcelas: tipo !== "credit_card" ? null : vezes ? Number(vezes[1]) : 1 };
}

export type LinhaLida = {
  meio: string | null;
  total_pedido: number;
  descontado: number;
  taxa_processamento: number;
  taxa_gateway: number;
  taxa_parcelamento: number;
};

export type TaxaMedida = {
  pedidos: number;
  total: number;
  descontado: number;
  /** descontado / total, em fração. Nulo sem venda. */
  taxaEfetiva: number | null;
  /** O que saiu em reais por venda (média). */
  descontadoPorVenda: number | null;
};

/** A taxa efetiva MEDIDA: o que a Appmax descontou de verdade sobre o que vendeu. */
export function taxaMedida(linhas: LinhaLida[]): TaxaMedida {
  const total = centavos(linhas.reduce((s, l) => s + l.total_pedido, 0));
  const descontado = centavos(linhas.reduce((s, l) => s + l.descontado, 0));
  return {
    pedidos: linhas.length,
    total,
    descontado,
    taxaEfetiva: total > 0 ? descontado / total : null,
    descontadoPorVenda: linhas.length ? centavos(descontado / linhas.length) : null,
  };
}
