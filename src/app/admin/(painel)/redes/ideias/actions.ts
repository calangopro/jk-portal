"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { criarIdeia, editarIdeia, ligarIdeiaAoPost, mudarEstadoDaIdeia, type DadosDaIdeia } from "@/lib/redes/ideias";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As ações do banco de ideias. Pedem a área `redes` e chamam o núcleo
 * (`lib/redes/ideias.ts`). Nada aqui vai para rede nenhuma.
 */

export type RespostaDaIdeia = { ok: true; id?: string } | { ok: false; erro: string };

const atualizar = () => {
  revalidatePath("/admin/redes/ideias");
  revalidatePath("/admin/redes/calendario");
};

export async function criar(dados: DadosDaIdeia): Promise<RespostaDaIdeia> {
  const perfil = await requireArea("redes");
  const r = await criarIdeia(createAdminClient(), { id: perfil.id }, dados);
  if (r.ok) atualizar();
  return r;
}

export async function editar(id: string, dados: DadosDaIdeia): Promise<RespostaDaIdeia> {
  await requireArea("redes");
  const r = await editarIdeia(createAdminClient(), String(id ?? ""), dados);
  if (r.ok) atualizar();
  return r;
}

export async function mover(id: string, estado: "ideia" | "produzindo" | "descartada"): Promise<RespostaDaIdeia> {
  await requireArea("redes");
  const r = await mudarEstadoDaIdeia(createAdminClient(), String(id ?? ""), estado === "produzindo" || estado === "descartada" ? estado : "ideia");
  if (r.ok) atualizar();
  return r;
}

/** Chamada pelo compositor quando o rascunho que nasceu da ideia ganha um id. */
export async function ligarAoPost(ideia: string, post: string): Promise<RespostaDaIdeia> {
  await requireArea("redes");
  const r = await ligarIdeiaAoPost(createAdminClient(), String(ideia ?? ""), String(post ?? ""));
  if (r.ok) atualizar();
  return r;
}
