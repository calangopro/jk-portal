"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

export type MidiaState = { erro?: string; ok?: string };

/** Salva os campos de SEO da imagem. O alt é obrigatório. */
export async function salvarMidia(
  _prev: MidiaState,
  formData: FormData,
): Promise<MidiaState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  if (!id) return { erro: "Imagem não identificada." };
  if (!alt) return { erro: "O texto alternativo é obrigatório. Descreva a imagem." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .update({
      alt,
      title: String(formData.get("title") ?? "").trim() || null,
      caption: String(formData.get("caption") ?? "").trim() || null,
      credit: String(formData.get("credit") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/admin/midia");
  return { ok: "Salvo." };
}

/** Desativa a imagem. Soft delete: o histórico é preservado. */
export async function desativarMidia(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("media")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/midia");
}

export async function reativarMidia(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("media").update({ deactivated_at: null }).eq("id", id);
  revalidatePath("/admin/midia");
}

/**
 * Pede à IA um texto alternativo lendo a própria imagem.
 *
 * O contador de "imagens sem texto alternativo" é o número que mais trava a
 * biblioteca: o alt é obrigatório, e escrever um bom alt para dezenas de fotos
 * de aliança à mão é onde a pessoa desiste e escreve "aliança" em todas.
 *
 * A IA sugere, a pessoa decide: o texto cai no campo e ainda precisa ser salvo.
 */
export async function sugerirAlt(
  imagemUrl: string,
): Promise<{ ok: boolean; alt?: string; legenda?: string; erro?: string }> {
  await requireStaff();
  if (!imagemUrl) return { ok: false, erro: "Imagem sem endereço." };

  try {
    const { descreverImagem } = await import("@/lib/analyzer/assistente");
    const r = await descreverImagem({ imagemUrl });
    return { ok: true, alt: r.alt, legenda: r.legenda };
  } catch (e) {
    return {
      ok: false,
      erro: e instanceof Error ? e.message : "Não foi possível descrever a imagem.",
    };
  }
}
