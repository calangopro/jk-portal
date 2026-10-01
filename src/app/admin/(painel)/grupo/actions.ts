"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TAG_GRUPO } from "@/lib/grupo/ler";
import { destinoAceito, esquemaDoGrupo } from "@/lib/grupo/tipos";
import { repassarLead } from "@/lib/leads/repassar";
import type { Lead } from "@/lib/leads/tipos";

export type EstadoDoGrupo = { ok?: string; erro?: string };

/** Salva o link do grupo e o visual da página. */
export async function salvarGrupo(_anterior: EstadoDoGrupo, form: FormData): Promise<EstadoDoGrupo> {
  const perfil = await requireStaff();

  const destino = String(form.get("destino") ?? "").trim();
  if (destino && !destinoAceito(destino)) {
    return {
      erro: "O link precisa começar com https:// (o convite do grupo, chat.whatsapp.com/..., ou o link do DevZapp).",
    };
  }

  const lido = esquemaDoGrupo.safeParse({ versao: 1, destino, tema: String(form.get("tema") ?? "campanha") });
  if (!lido.success) return { erro: "Escolha um visual da lista." };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    { key: "pagina:grupo", value: lido.data, is_public: true, updated_by: perfil.id },
    { onConflict: "key" },
  );
  if (error) return { erro: error.message };

  // A tag derruba o valor cacheado; os caminhos, o HTML pronto.
  revalidateTag(TAG_GRUPO);
  revalidatePath("/grupo");
  revalidatePath("/admin/grupo");
  return { ok: destino ? "Salvo. O link fixo já leva para o grupo novo." : "Salvo." };
}

/** Manda de novo um contato para os destinos que falharam, mesmo depois do teto. */
export async function reenviarContato(form: FormData): Promise<void> {
  await requireStaff();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = createAdminClient();
  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (data) await repassarLead(supabase, data as Lead, { forcar: true });

  revalidatePath("/admin/grupo");
}
