"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import {
  ENDERECO_DO_ROADMAP, ehColuna, ehPrioridade, ehTipo, lerCartao, lerCartaoInteiro, lerConflitos, mensagemDoMotivo,
  type Cartao, type CartaoInteiro, type Conflito,
} from "@/lib/roadmap/roadmap";
import { createClient } from "@/lib/supabase/server";
import type { Resposta } from "./tipos";

/**
 * O que a tela do Roadmap pede ao servidor. Cada ação confere a área aqui e
 * chama a função do banco com a SESSÃO da pessoa (0141), que confere de novo
 * por dentro e grava quem fez. A regra mora no banco; aqui só se traduz a
 * recusa em frase.
 */

const recusa = (r: Record<string, unknown>): { ok: false; erro: string; motivo?: string; de?: string } => ({
  ok: false,
  erro: mensagemDoMotivo(r.motivo),
  motivo: typeof r.motivo === "string" ? r.motivo : undefined,
  de: typeof r.de === "string" ? r.de : undefined,
});

async function chamar(funcao: string, args: Record<string, unknown>): Promise<{ ok: true; r: Record<string, unknown> } | { ok: false; erro: string; motivo?: string; de?: string }> {
  await requireArea("roadmap");
  const db = await createClient();
  const { data, error } = await db.rpc(funcao, args);
  if (error) {
    console.error(`[roadmap] ${funcao}:`, error.message);
    return { ok: false, erro: "Não deu para falar com o banco agora. Tente de novo em alguns segundos." };
  }
  const r = (data ?? {}) as Record<string, unknown>;
  return r.ok === true ? { ok: true, r } : recusa(r);
}

const comCartao = (r: Record<string, unknown>): Resposta<{ cartao: Cartao }> => {
  const cartao = lerCartao(r.cartao);
  return cartao ? { ok: true, cartao } : { ok: false, erro: "Salvou, mas não deu para ler o cartão. Recarregue a página." };
};

export async function verCartao(id: number): Promise<Resposta<{ inteiro: CartaoInteiro }>> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: mensagemDoMotivo("nao_achou") };
  const c = await chamar("roadmap_ver", { p_id: id });
  if (!c.ok) return c;
  const inteiro = lerCartaoInteiro(c.r);
  return inteiro ? { ok: true, inteiro } : { ok: false, erro: "Não deu para ler o cartão agora." };
}

export async function conferirCaminhos(caminhos: string[], exceto: number | null): Promise<Resposta<{ conflitos: Conflito[] }>> {
  const lista = caminhos.filter((c) => typeof c === "string").slice(0, 30);
  if (lista.length === 0) return { ok: true, conflitos: [] };
  const c = await chamar("roadmap_conflitos", { p_caminhos: lista, p_exceto: exceto });
  return c.ok ? { ok: true, conflitos: lerConflitos(c.r.conflitos) } : c;
}

export type NovoCartao = { titulo: string; descricao: string; tipo: string; prioridade: string; coluna: string; caminhos: string[] };

export async function criarCartao(d: NovoCartao): Promise<Resposta<{ id: number }>> {
  if (!ehTipo(d.tipo) || !ehPrioridade(d.prioridade) || (d.coluna !== "ideias" && d.coluna !== "a_fazer")) {
    return { ok: false, erro: "Escolha o tipo, a prioridade e a coluna." };
  }
  const c = await chamar("roadmap_criar", {
    p_cartoes: [{ titulo: d.titulo, descricao: d.descricao, tipo: d.tipo, prioridade: d.prioridade, coluna: d.coluna, caminhos: d.caminhos }],
  });
  if (!c.ok) return c;
  const criado = Array.isArray(c.r.criados) ? (c.r.criados[0] as { id?: number } | undefined) : undefined;
  if (!criado?.id) {
    const recusado = Array.isArray(c.r.recusados) ? (c.r.recusados[0] as Record<string, unknown> | undefined) : undefined;
    return { ok: false, erro: mensagemDoMotivo(recusado?.motivo) };
  }
  revalidatePath(ENDERECO_DO_ROADMAP);
  return { ok: true, id: criado.id };
}

export type Pegada = { caminhos: string[]; ramo: string; sessao: string; responsavel: string | null; tomar: boolean };

export async function pegarCartao(id: number, d: Pegada): Promise<Resposta<{ cartao: Cartao; conflitos: Conflito[] }>> {
  const c = await chamar("roadmap_pegar", {
    p_id: id,
    p_caminhos: d.caminhos.slice(0, 30),
    p_ramo: d.ramo.trim() || null,
    p_sessao: d.sessao.trim() || null,
    p_responsavel: d.responsavel,
    p_tomar: d.tomar,
  });
  if (!c.ok) return c;
  revalidatePath(ENDERECO_DO_ROADMAP);
  const cartao = lerCartao(c.r.cartao);
  return cartao ? { ok: true, cartao, conflitos: lerConflitos(c.r.conflitos) } : { ok: false, erro: "Salvou, mas não deu para ler o cartão. Recarregue a página." };
}

export async function moverCartao(id: number, coluna: string, nota: string): Promise<Resposta<{ cartao: Cartao }>> {
  if (!ehColuna(coluna)) return { ok: false, erro: mensagemDoMotivo("coluna") };
  const c = await chamar("roadmap_mover", { p_id: id, p_coluna: coluna, p_nota: nota.trim() || null });
  if (!c.ok) return c;
  revalidatePath(ENDERECO_DO_ROADMAP);
  return comCartao(c.r);
}

export async function ligarPr(id: number, pr: string, ramo: string): Promise<Resposta<{ cartao: Cartao }>> {
  const c = await chamar("roadmap_ligar_pr", { p_id: id, p_pr_url: pr.trim(), p_ramo: ramo.trim() || null });
  if (!c.ok) return c;
  revalidatePath(ENDERECO_DO_ROADMAP);
  return comCartao(c.r);
}

export type CamposDoCartao = Partial<{ titulo: string; descricao: string; tipo: string; prioridade: string; caminhos: string[]; ramo: string; sessao: string }>;

export async function editarCartao(id: number, campos: CamposDoCartao): Promise<Resposta<{ cartao: Cartao }>> {
  const c = await chamar("roadmap_editar", { p_id: id, p_campos: campos });
  if (!c.ok) return c;
  revalidatePath(ENDERECO_DO_ROADMAP);
  return comCartao(c.r);
}

export type Levada = { tipo: string; prioridade: string; coluna: string; titulo: string };

export async function levarSugestao(sugestao: number, d: Levada): Promise<Resposta<{ id: number }>> {
  const c = await chamar("roadmap_levar_sugestao", {
    p_sugestao: sugestao, p_titulo: d.titulo.trim() || null, p_tipo: d.tipo, p_prioridade: d.prioridade, p_coluna: d.coluna,
  });
  if (!c.ok) return c;
  revalidatePath(ENDERECO_DO_ROADMAP);
  revalidatePath("/admin/sugestoes");
  return { ok: true, id: Number(c.r.id) };
}
