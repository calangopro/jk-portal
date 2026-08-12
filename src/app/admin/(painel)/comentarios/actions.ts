"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

type Status = "pending" | "approved" | "spam" | "rejected";

/** Muda o status de um comentário e revalida a página onde ele aparece. */
export async function moderar(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as Status;
  const slug = String(formData.get("slug") ?? "");
  if (!id || !["pending", "approved", "spam", "rejected"].includes(status)) return;

  const supabase = await createClient();
  await supabase.from("comments").update({ status }).eq("id", id);

  revalidatePath("/admin/comentarios");
  if (slug) revalidatePath(`/guia/${slug}`);
}

/** Remoção definitiva. Só admin, e só do que já está marcado como spam. */
export async function apagarComentario(formData: FormData) {
  const perfil = await requireStaff();
  if (perfil.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("comments").delete().eq("id", id).eq("status", "spam");
  revalidatePath("/admin/comentarios");
}

/** Aprova todos os pendentes de uma vez. Útil quando a fila está limpa. */
export async function aprovarTodos() {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("comments").update({ status: "approved" }).eq("status", "pending");
  revalidatePath("/admin/comentarios");
  revalidatePath("/guia", "layout");
}
