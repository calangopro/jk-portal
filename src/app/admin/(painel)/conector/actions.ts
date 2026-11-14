"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { criarChaveManual, revogarChave } from "@/lib/conector/chaves";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/auth/acessos";

export type EstadoDaChave = { erro?: string; chave?: string; nome?: string };

/**
 * Cria uma chave "jk_..." para colar no Claude Code. A chave inteira aparece
 * UMA vez, na resposta desta ação; no banco fica só o hash.
 */
export async function criarChave(_anterior: EstadoDaChave, form: FormData): Promise<EstadoDaChave> {
  const perfil = await requireStaff();
  const nome = String(form.get("nome") ?? "").trim();
  const escopo = form.get("escopo") === "leitura" ? "leitura" : "completo";
  if (nome.length < 2 || nome.length > 60) return { erro: "Dê um nome à chave, como Claude Code do Filipe." };
  try {
    const { chave } = await criarChaveManual({ nome, escopo, profileId: perfil.id });
    revalidatePath("/admin/conector");
    return { chave, nome };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para criar a chave." };
  }
}

/** Desliga um acesso. Cada pessoa desliga os seus; administrador desliga qualquer um. */
export async function desligarAcesso(form: FormData): Promise<void> {
  const perfil = await requireStaff();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  if (!ehAdmin(perfil.role)) {
    const { data } = await createAdminClient().from("conector_chaves").select("profile_id").eq("id", id).maybeSingle();
    if (data?.profile_id !== perfil.id) return;
  }
  await revogarChave(id, perfil.id);
  revalidatePath("/admin/conector");
}
