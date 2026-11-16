"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { apagarAutomacao, criarAutomacao, desligarAutomacao, editarAutomacao, ligarAutomacao, type EntradaDaRegra } from "@/lib/redes/automacoes";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As ações das automações. Montar, editar, desligar e apagar pedem a área
 * `redes`. LIGAR pede administrador, dono ou GM: a conferência é feita aqui,
 * pelo perfil da sessão, e de novo no núcleo.
 */

export type RespostaDaRegra = { ok: true; aviso: string } | { ok: false; erro: string };

const atualizar = () => revalidatePath("/admin/redes/automacoes");

export async function salvar(id: string | null, entrada: EntradaDaRegra): Promise<RespostaDaRegra> {
  const perfil = await requireArea("redes");
  const db = createAdminClient();
  if (!id) {
    const r = await criarAutomacao(db, { id: perfil.id }, entrada);
    if (!r.ok) return r;
    atualizar();
    return { ok: true, aviso: "Regra criada, desligada. Ela só responde depois que um administrador ligar." };
  }
  const r = await editarAutomacao(db, String(id), entrada);
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: r.desligou ? "Regra salva e DESLIGADA: o texto mudou, e precisa ser ligada de novo." : "Regra salva." };
}

export async function ligar(id: string): Promise<RespostaDaRegra> {
  const perfil = await requireArea("redes");
  const r = await ligarAutomacao(createAdminClient(), { id: perfil.id, admin: ehAdmin(perfil.role) }, String(id ?? ""));
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: "Regra ligada. Ela responde os comentários novos que tiverem a palavra, depois da espera." };
}

export async function desligar(id: string): Promise<RespostaDaRegra> {
  await requireArea("redes");
  const r = await desligarAutomacao(createAdminClient(), String(id ?? ""));
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: "Regra desligada. Nenhuma resposta automática sai mais por ela." };
}

export async function apagar(id: string): Promise<RespostaDaRegra> {
  await requireArea("redes");
  const r = await apagarAutomacao(createAdminClient(), String(id ?? ""));
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: "Regra apagada." };
}
