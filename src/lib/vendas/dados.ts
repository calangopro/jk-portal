import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Situacao } from "./tray-csv";
import type { LinhaDeOrigem } from "./origem";
import { intervaloDoPeriodo, primeiroDoMes, somarDias, type ChaveDePeriodo } from "./periodo";
import { lerResumoPorFora, type ResumoPorFora } from "./por-fora";

/**
 * Leitura das vendas da loja para a tela /admin/vendas.
 *
 * Tudo sai da função `resumo_de_vendas` do banco (0053), que soma por
 * situação, dia, hora, origem, pagamento e produto num pedido só. Ela roda com
 * os direitos de quem chama, então o cliente passado aqui tem que ser o da
 * sessão: é a RLS que garante que só administrador recebe número.
 */

export type Totais = {
  pagos: number;
  valor_pago: number;
  aguardando: number;
  valor_aguardando: number;
  cancelados: number;
  valor_cancelado: number;
  frete: number;
  desconto: number;
  clientes: number;
  com_itens: number;
};

export type Dia = {
  dia: string;
  pagos: number;
  valor_pago: number;
  aguardando: number;
  valor_aguardando: number;
  cancelados: number;
  valor_cancelado: number;
};

export type Hora = { hora: number; pagos: number; valor: number };

export type Pagamento = { tipo: string; pagos: number; valor: number; criados: number; cancelados: number };

export type ProdutoVendido = {
  produto_tray_id: string | null;
  nome: string;
  quantidade: number;
  valor: number;
  pedidos: number;
  url: string | null;
  imagem: string | null;
};

export type PedidoRecente = {
  pedido: number;
  feito_em: string;
  cliente: string | null;
  cidade: string | null;
  uf: string | null;
  total: number;
  status: string;
  situacao: Situacao;
  origem: string;
  pagamento: string | null;
  itens: string | null;
};

export type ResumoDeVendas = {
  totais: Totais;
  por_dia: Dia[];
  por_hora: Hora[];
  por_origem: LinhaDeOrigem[];
  por_pagamento: Pagamento[];
  produtos: ProdutoVendido[];
  pedidos: PedidoRecente[];
};

export const TOTAIS_ZERADOS: Totais = {
  pagos: 0, valor_pago: 0, aguardando: 0, valor_aguardando: 0, cancelados: 0,
  valor_cancelado: 0, frete: 0, desconto: 0, clientes: 0, com_itens: 0,
};

export const DIA_ZERADO = (dia: string): Dia => ({
  dia, pagos: 0, valor_pago: 0, aguardando: 0, valor_aguardando: 0, cancelados: 0, valor_cancelado: 0,
});

const VAZIO: ResumoDeVendas = {
  totais: TOTAIS_ZERADOS, por_dia: [], por_hora: [], por_origem: [], por_pagamento: [], produtos: [], pedidos: [],
};

/** Resumo do intervalo, as duas pontas inclusive. Erro do banco vira `null`. */
export async function lerResumoDeVendas(
  db: SupabaseClient,
  de: string,
  ate: string,
): Promise<ResumoDeVendas | null> {
  const { data, error } = await db.rpc("resumo_de_vendas", { p_de: de, p_ate: ate });
  if (error) {
    console.error("[vendas] resumo_de_vendas:", error.message);
    return null;
  }
  return { ...VAZIO, ...(data as Partial<ResumoDeVendas> | null) };
}

/**
 * `quando` é a última leitura BOA, por qualquer das duas portas (a API, de dez
 * em dez minutos, ou a exportação do painel da loja). `erro` é o da última
 * tentativa, quando ela falhou: uma rodada ruim no meio de várias boas não
 * atrasa os números, então quem decide o aviso é a idade de `quando`.
 */
export type UltimaImportacao = { quando: string; ok: boolean; erro: string | null; fonte: "api" | "exportacao" } | null;

/**
 * Quando os pedidos foram lidos da Tray pela última vez. A conta mora no banco
 * (`ultima_leitura_de_pedidos`, 0100) porque o pulso das rotinas só abre para
 * administrador, e esta resposta também serve a quem tem a área de vendas.
 */
export async function ultimaImportacao(db: SupabaseClient): Promise<UltimaImportacao> {
  const { data, error } = await db.rpc("ultima_leitura_de_pedidos");
  if (error) {
    console.error("[vendas] ultima_leitura_de_pedidos:", error.message);
    return null;
  }
  const l = data as { quando?: string | null; fonte?: string | null; erro?: string | null } | null;
  if (!l?.quando) return null;
  return { quando: l.quando, ok: !l.erro, erro: l.erro ?? null, fonte: l.fonte === "api" ? "api" : "exportacao" };
}

export type VendasDaTela = {
  /** Do começo do mês (ou de ontem, no dia 1) até hoje: alimenta hoje, ontem e o mês. */
  topo: ResumoDeVendas | null;
  resumo: ResumoDeVendas | null;
  anterior: ResumoDeVendas | null;
  ultima: UltimaImportacao;
  /** Vendas registradas por fora da loja no mês corrente. */
  porFora: ResumoPorFora | null;
};

/**
 * As quatro leituras da tela, de uma vez. O topo não depende do período
 * escolhido; no dia 1, ontem é do mês passado, então a leitura começa nele.
 */
export async function lerVendasDaTela(db: SupabaseClient, chave: ChaveDePeriodo, hoje: string): Promise<VendasDaTela> {
  const ontem = somarDias(hoje, -1);
  const inicioDoMes = primeiroDoMes(hoje);
  const intervalo = intervaloDoPeriodo(chave, hoje);
  const [topo, resumo, anterior, ultima, porFora] = await Promise.all([
    lerResumoDeVendas(db, ontem < inicioDoMes ? ontem : inicioDoMes, hoje),
    lerResumoDeVendas(db, intervalo.de, intervalo.ate),
    lerResumoDeVendas(db, intervalo.anteriorDe, intervalo.anteriorAte),
    ultimaImportacao(db),
    lerResumoPorFora(db, inicioDoMes, hoje),
  ]);
  return { topo, resumo, anterior, ultima, porFora };
}
