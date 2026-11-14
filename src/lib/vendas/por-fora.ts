import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vendas fechadas fora da loja Tray (0058): o que o vendedor fecha no WhatsApp
 * e não vira pedido.
 *
 * `resumo_por_fora` roda com os direitos de quem chama: o vendedor recebe só as
 * próprias vendas, e quem tem a área de vendas recebe todas. Por isso o cliente
 * passado aqui tem que ser o da sessão.
 */

export const FORMAS = [
  { chave: "pix", nome: "Pix" },
  { chave: "link_de_pagamento", nome: "Link de pagamento" },
  { chave: "cartao", nome: "Cartão" },
  { chave: "dinheiro", nome: "Dinheiro" },
  { chave: "outro", nome: "Outro" },
] as const;

export const CANAIS = [
  { chave: "whatsapp", nome: "WhatsApp" },
  { chave: "instagram", nome: "Instagram" },
  { chave: "loja_fisica", nome: "Loja física" },
  { chave: "indicacao", nome: "Indicação" },
  { chave: "recuperacao", nome: "Recuperação de pedido" },
  { chave: "outro", nome: "Outro" },
] as const;

export const NOME_DA_FORMA = Object.fromEntries(FORMAS.map((f) => [f.chave, f.nome])) as Record<string, string>;
export const NOME_DO_CANAL_DE_VENDA = Object.fromEntries(CANAIS.map((c) => [c.chave, c.nome])) as Record<string, string>;

export type VendaPorFora = {
  id: string;
  feita_em: string;
  dia: string;
  vendedor: string;
  valor: number;
  forma: string;
  canal: string;
  cliente: string | null;
  produto: string | null;
  conferir: string | null;
};

export type PorVendedor = {
  vendedor_id: string;
  vendedor: string;
  vendas: number;
  valor: number;
  recuperadas: number;
  valor_recuperado: number;
};

export type ResumoPorFora = {
  vendas: number;
  valor: number;
  a_conferir: number;
  por_vendedor: PorVendedor[];
  por_dia: { dia: string; vendas: number; valor: number }[];
  por_forma: { forma: string; vendas: number; valor: number }[];
  ultimas: VendaPorFora[];
};

export const POR_FORA_VAZIO: ResumoPorFora = { vendas: 0, valor: 0, a_conferir: 0, por_vendedor: [], por_dia: [], por_forma: [], ultimas: [] };

/** Erro do banco vira `null`, e a tela diz que não deu para ler. */
export async function lerResumoPorFora(db: SupabaseClient, de: string, ate: string): Promise<ResumoPorFora | null> {
  const { data, error } = await db.rpc("resumo_por_fora", { p_de: de, p_ate: ate });
  if (error) {
    console.error("[vendas] resumo_por_fora:", error.message);
    return null;
  }
  const r = { ...POR_FORA_VAZIO, ...(data as Partial<ResumoPorFora> | null) };
  return { ...r, valor: Number(r.valor) };
}

/** Em que etapa da fábrica está uma venda por fora (0075). */
export type VendaNaFabrica = { etapa: string; entrega: string | null; rastreio: string | null };

/**
 * A etapa da fábrica de cada venda pedida. Só vem venda que a pessoa pode ver e
 * que foi para a fábrica; erro vira objeto vazio, e a lista de vendas continua
 * valendo sem o selo.
 */
export async function lerEtapasDasVendas(db: SupabaseClient, ids: string[]): Promise<Record<string, VendaNaFabrica>> {
  if (ids.length === 0) return {};
  const { data, error } = await db.rpc("etapa_das_vendas", { p_ids: ids });
  if (error) {
    console.error("[vendas] etapa_das_vendas:", error.message);
    return {};
  }
  return (data ?? {}) as Record<string, VendaNaFabrica>;
}
