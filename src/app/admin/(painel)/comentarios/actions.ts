"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { SITE } from "@/lib/seo/site";

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

export type ResponderState = { erro?: string; ok?: string };

const MIN_RESPOSTA = 2;
const MAX_RESPOSTA = 2000;

/**
 * Resposta da loja a um comentário.
 *
 * SÓ ADMIN. A verificação aqui é a primeira porta, e a policy
 * `comments_admin_reply` (migration 0036) é a que vale: sem ela, bastaria uma
 * chamada direta com a chave anônima, que vai no HTML, para pendurar texto no
 * site como se fosse a JK falando.
 *
 * Responder também PUBLICA a pergunta, quando ela ainda estava na fila. Sem
 * isso a resposta ficaria pendurada num comentário que o site não mostra, e a
 * pessoa da moderação descobriria isso pelo silêncio.
 */
export async function responder(
  _prev: ResponderState,
  formData: FormData,
): Promise<ResponderState> {
  const perfil = await requireStaff();
  if (perfil.role !== "admin") {
    return { erro: "Só administrador responde comentário." };
  }

  const parentId = String(formData.get("parent_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const corpo = String(formData.get("corpo") ?? "").trim();

  if (!parentId) return { erro: "Comentário não identificado." };
  if (corpo.length < MIN_RESPOSTA) return { erro: "Escreva a resposta." };
  if (corpo.length > MAX_RESPOSTA) return { erro: "Resposta muito longa." };

  const supabase = await createClient();

  const { data: pai } = await supabase
    .from("comments")
    .select("id, content_id, parent_id, status")
    .eq("id", parentId)
    .maybeSingle();

  if (!pai) return { erro: "Comentário não encontrado." };
  // Fio de um nível só: resposta de resposta viraria conversa em escada, e a
  // tela pública não desenha isso.
  if (pai.parent_id) return { erro: "Resposta não recebe resposta." };

  const { error } = await supabase.from("comments").insert({
    content_id: pai.content_id,
    parent_id: pai.id,
    // Quem assina na tela é a marca; quem assina no banco é a pessoa.
    author_name: SITE.name,
    body: corpo,
    status: "approved",
    author_profile_id: perfil.id,
  });

  if (error) return { erro: "Não foi possível responder agora. Tente de novo." };

  if (pai.status !== "approved") {
    await supabase.from("comments").update({ status: "approved" }).eq("id", pai.id);
  }

  revalidatePath("/admin/comentarios");
  if (slug) revalidatePath(`/guia/${slug}`);

  return {
    ok:
      pai.status === "approved"
        ? "Resposta publicada."
        : "Resposta publicada, e o comentário foi ao ar junto.",
  };
}

/**
 * Apaga uma resposta da loja.
 *
 * Comentário de visitante nunca é apagado assim: ele vira spam e só some por
 * `apagarComentario`, que preserva o histórico da moderação. Resposta da casa é
 * texto nosso, escrito agora, e um erro de digitação publicado não pode
 * depender de virar spam para sair do ar.
 */
export async function apagarResposta(formData: FormData) {
  const perfil = await requireStaff();
  if (perfil.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    // A trava do "só resposta" é esta: linha sem perfil é de visitante.
    .not("author_profile_id", "is", null);

  revalidatePath("/admin/comentarios");
  if (slug) revalidatePath(`/guia/${slug}`);
}
