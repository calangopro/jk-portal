/**
 * Os pedidos do site, do jeito que o VENDEDOR precisa: achar o pedido que ele
 * fechou e marcar como dele (0105). E o mês dele, para o Início.
 *
 * Arquivo PURO (sem banco, sem navegador e sem importar função de outro
 * arquivo): serve à tela, ao servidor e ao teste (`npm run verificar:suporte`).
 *
 * A régua do valor é do banco (`pedidos_do_site`): o valor só chega no pedido
 * que já é da própria pessoa, ou para quem vê o faturamento. Uma lista com o
 * valor de todos os pedidos deixaria somar o faturamento da loja.
 */

export type FiltroDoVendedor = "sem_vendedor" | "meus" | "todos";

export const FILTROS: { chave: FiltroDoVendedor; nome: string }[] = [
  { chave: "sem_vendedor", nome: "Sem vendedor" },
  { chave: "meus", nome: "Meus" },
  { chave: "todos", nome: "Todos" },
];

export function lerFiltro(v: unknown): FiltroDoVendedor {
  return FILTROS.some((f) => f.chave === v) ? (v as FiltroDoVendedor) : "sem_vendedor";
}

export type PeriodoDoPedido = "30d" | "mes" | "mes_passado" | "90d" | "tudo";

/** O painel tem pedido da loja desde 01/05/2026 (o histórico trazido pela API em 16/11). Antes disso não há o que achar. */
export const INICIO_DOS_PEDIDOS = "2026-05-01";

export const PERIODOS_DO_PEDIDO: { chave: PeriodoDoPedido; nome: string }[] = [
  { chave: "30d", nome: "30 dias" },
  { chave: "mes", nome: "Este mês" },
  { chave: "mes_passado", nome: "Mês passado" },
  { chave: "90d", nome: "90 dias" },
  { chave: "tudo", nome: "Desde maio" },
];

export function lerPeriodoDoPedido(v: unknown): PeriodoDoPedido {
  return PERIODOS_DO_PEDIDO.some((p) => p.chave === v) ? (v as PeriodoDoPedido) : "30d";
}

/** "2026-11-17" menos `n` dias, sem fuso: a conta é de calendário. */
function somar(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** De que dia a que dia o período vai, contado a partir de hoje (o dia de São Paulo). */
export function intervaloDoPedido(p: PeriodoDoPedido, hoje: string): { de: string; ate: string } {
  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  switch (p) {
    case "mes":
      return { de: inicioDoMes, ate: hoje };
    case "mes_passado": {
      const fim = somar(inicioDoMes, -1);
      return { de: `${fim.slice(0, 7)}-01`, ate: fim };
    }
    case "90d":
      return { de: somar(hoje, -90), ate: hoje };
    case "tudo":
      return { de: INICIO_DOS_PEDIDOS, ate: hoje };
    default:
      return { de: somar(hoje, -30), ate: hoje };
  }
}

export type PedidoDoSite = {
  numero: number;
  dia: string | null;
  feitoEm: string | null;
  situacao: string | null;
  cliente: string | null;
  cidade: string | null;
  uf: string | null;
  pecas: string[];
  nPecas: number;
  vendedor: { id: string; nome: string | null } | null;
  /** O vendedor veio da venda por fora ligada ao pedido, e não de uma marcação. */
  soPorFora: boolean;
  meu: boolean;
  /** Só no pedido que é da pessoa, ou para quem vê o faturamento. */
  total: number | null;
};

export type ListaDePedidosDoSite = {
  eu: string | null;
  de: string | null;
  ate: string | null;
  /** O que o banco entendeu da busca: nada, número de pedido, telefone ou texto. */
  busca: "nada" | "pedido" | "telefone" | "texto";
  encontrados: number;
  pode: { atribuir: boolean; veValor: boolean };
  vendedores: { id: string; nome: string }[];
  pedidos: PedidoDoSite[];
};

/** O teto da lista: com mais que isso, a tela pede para refinar a busca. É o mesmo `limit` de `pedidos_do_site`. */
export const TETO_DA_LISTA = 120;

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const BUSCAS = ["nada", "pedido", "telefone", "texto"] as const;

function lerPedido(v: unknown): PedidoDoSite | null {
  const p = objeto(v);
  const n = numero(p?.numero);
  if (!p || !n || n <= 0) return null;
  const vend = objeto(p.vendedor);
  return {
    numero: n,
    dia: texto(p.dia),
    feitoEm: texto(p.feito_em),
    situacao: texto(p.situacao),
    cliente: texto(p.cliente),
    cidade: texto(p.cidade),
    uf: texto(p.uf),
    pecas: (Array.isArray(p.pecas) ? p.pecas : []).filter((x): x is string => typeof x === "string"),
    nPecas: Math.max(0, numero(p.n_pecas) ?? 0),
    vendedor: vend && typeof vend.id === "string" ? { id: vend.id, nome: texto(vend.nome) } : null,
    soPorFora: p.so_por_fora === true,
    meu: p.meu === true,
    total: numero(p.total),
  };
}

/** Lê o que `pedidos_do_site` devolve. Nulo é sem acesso (ou falha de leitura). */
export function lerPedidosDoSite(v: unknown): ListaDePedidosDoSite | null {
  const l = objeto(v);
  if (!l) return null;
  const pode = objeto(l.pode) ?? {};
  const busca = BUSCAS.find((b) => b === l.busca) ?? "nada";
  return {
    eu: texto(l.eu),
    de: texto(l.de),
    ate: texto(l.ate),
    busca,
    encontrados: Math.max(0, numero(l.encontrados) ?? 0),
    pode: { atribuir: pode.atribuir === true, veValor: pode.ve_valor === true },
    vendedores: (Array.isArray(l.vendedores) ? l.vendedores : [])
      .map(objeto)
      .filter((x): x is Record<string, unknown> => x !== null && typeof x.id === "string")
      .map((x) => ({ id: String(x.id), nome: texto(x.nome) ?? "Sem nome" })),
    pedidos: (Array.isArray(l.pedidos) ? l.pedidos : []).map(lerPedido).filter((p): p is PedidoDoSite => p !== null),
  };
}

const primeiro = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || null;

/** De quem é o pedido, em palavra, para a linha da lista. */
export function donoDoPedido(p: Pick<PedidoDoSite, "vendedor" | "meu" | "soPorFora">): { palavra: string; tom: "bom" | "neutro" } {
  if (p.meu) return { palavra: p.soPorFora ? "Sua venda (por fora)" : "Sua venda", tom: "bom" };
  if (p.vendedor) return { palavra: `Venda de ${primeiro(p.vendedor.nome) ?? "outra pessoa"}${p.soPorFora ? " (por fora)" : ""}`, tom: "neutro" };
  return { palavra: "Sem vendedor", tom: "neutro" };
}

/** Quais pedidos da tela dá para escolher na leva: sem vendedor (ou qualquer um, para quem pode marcar outra pessoa). */
export function podeEscolherNaLeva(p: Pick<PedidoDoSite, "vendedor" | "meu">, atribuir: boolean): boolean {
  return atribuir || (!p.vendedor && !p.meu);
}

/** O resumo das peças: as duas primeiras e quantas mais. */
export function pecasEmPalavra(p: Pick<PedidoDoSite, "pecas" | "nPecas">): string {
  if (p.pecas.length === 0) return "Sem itens no painel";
  const duas = p.pecas.slice(0, 2).join(" · ");
  const mais = p.nPecas - Math.min(2, p.pecas.length);
  return mais > 0 ? `${duas} (mais ${mais})` : duas;
}

// ------------------------------------------------------------- o meu mês

export type MeuMes = {
  /** O primeiro dia do mês, "2026-11-01". */
  mes: string;
  foraVendas: number;
  foraValor: number;
  lojaPedidos: number;
  lojaValor: number;
  mesPassado: number;
  /** A posição no ranking do mês. Nula quando a pessoa ainda não vendeu no mês. */
  posicao: number | null;
  noRanking: number;
  /** Pedidos pagos dos últimos 30 dias que ninguém marcou. */
  semVendedor30d: number;
};

export function lerMeuMes(v: unknown): MeuMes | null {
  const l = objeto(v);
  if (!l || typeof l.mes !== "string") return null;
  return {
    mes: l.mes,
    foraVendas: numero(l.fora_vendas) ?? 0,
    foraValor: numero(l.fora_valor) ?? 0,
    lojaPedidos: numero(l.loja_pedidos) ?? 0,
    lojaValor: numero(l.loja_valor) ?? 0,
    mesPassado: numero(l.mes_passado) ?? 0,
    posicao: numero(l.posicao),
    noRanking: numero(l.no_ranking) ?? 0,
    semVendedor30d: numero(l.sem_vendedor_30d) ?? 0,
  };
}

export const totalDoMes = (m: Pick<MeuMes, "foraValor" | "lojaValor">) => m.foraValor + m.lojaValor;

/** "novembro", do primeiro dia do mês. */
export function nomeDoMes(mes: string): string {
  const t = Date.parse(`${mes.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(t) ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(new Date(t)) : "";
}
