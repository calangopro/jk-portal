import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A garantia digital no banco (0194). A parte pública fala pela chave de
 * serviço, porque as funções públicas não abrem para a chave anônima: a
 * página do cliente nunca conversa com o banco direto do navegador.
 */

export type GarantiaPublica = {
  codigo: string;
  os: number | null;
  pedido: number | null;
  emitidaEm: string;
  registrada: boolean;
  travada: boolean;
  pecas: { nome: string; quantidade: number }[];
  beneficios: string[];
};

const num = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const pecasDe = (v: unknown) =>
  (Array.isArray(v) ? (v as Record<string, unknown>[]) : []).map((p) => ({ nome: String(p.nome ?? "Peça"), quantidade: num(p.quantidade) ?? 1, info: typeof p.info === "string" ? p.info : null }));

export async function lerGarantiaPublica(codigo: string): Promise<GarantiaPublica | null> {
  const { data, error } = await createAdminClient().rpc("garantia_ver", { p_codigo: codigo });
  if (error) {
    console.error("[garantia] garantia_ver:", error.message);
    return null;
  }
  if (!data) return null;
  const g = data as Record<string, unknown>;
  return {
    codigo: String(g.codigo),
    os: num(g.os),
    pedido: num(g.pedido),
    emitidaEm: String(g.emitida_em ?? ""),
    registrada: g.registrada === true,
    travada: g.travada === true,
    pecas: pecasDe(g.pecas).map(({ nome, quantidade }) => ({ nome, quantidade })),
    beneficios: Array.isArray(g.beneficios) ? (g.beneficios as unknown[]).filter((b): b is string => typeof b === "string") : [],
  };
}

export type GarantiaAberta =
  | { ok: true; nome: string | null; pecas: { nome: string; quantidade: number; info: string | null }[]; registro: Record<string, string> | null }
  | { ok: false; motivo: "nao_existe" | "travada" | "errado" | "sem_aceite" | "falhou" };

const motivo = (v: unknown): Exclude<GarantiaAberta, { ok: true }>["motivo"] =>
  v === "nao_existe" || v === "travada" || v === "errado" || v === "sem_aceite" ? v : "falhou";

export async function abrirGarantia(codigo: string, digitos: string): Promise<GarantiaAberta> {
  const { data, error } = await createAdminClient().rpc("garantia_abrir", { p_codigo: codigo, p_digitos: digitos });
  if (error || !data) {
    if (error) console.error("[garantia] garantia_abrir:", error.message);
    return { ok: false, motivo: "falhou" };
  }
  const r = data as Record<string, unknown>;
  if (r.ok !== true) return { ok: false, motivo: motivo(r.motivo) };
  return {
    ok: true,
    nome: typeof r.nome === "string" ? r.nome : null,
    pecas: pecasDe(r.pecas),
    registro: r.registro && typeof r.registro === "object" ? (r.registro as Record<string, string>) : null,
  };
}

export async function registrarGarantia(codigo: string, digitos: string, dados: Record<string, string | boolean | null>): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await createAdminClient().rpc("garantia_registrar", { p_codigo: codigo, p_digitos: digitos, p: dados });
  if (error || !data) {
    if (error) console.error("[garantia] garantia_registrar:", error.message);
    return { ok: false, motivo: "falhou" };
  }
  const r = data as Record<string, unknown>;
  return r.ok === true ? { ok: true } : { ok: false, motivo: motivo(r.motivo) };
}

/** Emite (ou devolve) a garantia de um trabalho, com a sessão de quem pediu. */
export async function emitirGarantia(db: SupabaseClient, ref: string): Promise<{ ok: true; codigo: string } | { ok: false; erro: string }> {
  const { data, error } = await db.rpc("fabrica_emitir_garantia", { p_ref: ref });
  if (error) {
    console.error("[garantia] fabrica_emitir_garantia:", error.message);
    return { ok: false, erro: /telefone|acesso|Pedido|OS|venda/i.test(error.message) ? error.message : "Não deu para emitir a garantia agora." };
  }
  return { ok: true, codigo: String((data as { codigo?: string })?.codigo ?? "") };
}

export type GarantiaParaImprimir = { codigo: string; os: number | null; pedido: number | null; emitidaEm: string; pecas: { nome: string; quantidade: number }[] };

export async function lerGarantiaParaImprimir(db: SupabaseClient, codigo: string): Promise<GarantiaParaImprimir | null> {
  const { data, error } = await db.rpc("garantia_para_imprimir", { p_codigo: codigo });
  if (error || !data) {
    if (error) console.error("[garantia] garantia_para_imprimir:", error.message);
    return null;
  }
  const g = data as Record<string, unknown>;
  return { codigo: String(g.codigo), os: num(g.os), pedido: num(g.pedido), emitidaEm: String(g.emitida_em ?? ""), pecas: pecasDe(g.pecas).map(({ nome, quantidade }) => ({ nome, quantidade })) };
}
