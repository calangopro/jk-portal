"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ComentarState = { erro?: string; ok?: string };

const MIN_CORPO = 3;
const MAX_CORPO = 2000;
/** Quantos comentários o mesmo IP pode enviar numa janela curta. */
const LIMITE_POR_JANELA = 3;
const JANELA_MINUTOS = 10;

/**
 * Recebe um comentário do público. Entra sempre como "pending" e só aparece
 * no site depois que alguém da equipe aprovar.
 *
 * Anti-spam em camadas: campo isca invisível, tempo mínimo de preenchimento,
 * limite por IP e tamanho máximo. Sem captcha, que atrapalha quem é gente.
 */
export async function enviarComentario(
  _prev: ComentarState,
  formData: FormData,
): Promise<ComentarState> {
  const contentId = String(formData.get("content_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const isca = String(formData.get("site") ?? "").trim();
  const abertoEm = Number(formData.get("aberto_em") ?? 0);

  // Campo isca: humano não enxerga, robô preenche.
  if (isca) return { ok: "Comentário enviado. Ele aparece depois da revisão." };

  // Preenchimento instantâneo é robô.
  if (abertoEm > 0 && Date.now() - abertoEm < 3000) {
    return { erro: "Envio muito rápido. Tente de novo em alguns segundos." };
  }

  if (!contentId) return { erro: "Conteúdo não identificado." };
  if (!nome) return { erro: "Diga como podemos te chamar." };
  if (corpo.length < MIN_CORPO) return { erro: "Escreva seu comentário." };
  if (corpo.length > MAX_CORPO) return { erro: "Comentário muito longo." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { erro: "Confira o e-mail digitado." };
  }

  const cabecalhos = await headers();
  const ip =
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabecalhos.get("x-real-ip") ||
    null;
  const userAgent = cabecalhos.get("user-agent") ?? null;

  const supabase = await createClient();

  if (ip) {
    const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", desde);

    if ((count ?? 0) >= LIMITE_POR_JANELA) {
      return { erro: "Você já enviou vários comentários agora. Aguarde alguns minutos." };
    }
  }

  const { error } = await supabase.from("comments").insert({
    content_id: contentId,
    author_name: nome.slice(0, 120),
    author_email: email ? email.slice(0, 200) : null,
    body: corpo,
    status: "pending",
    ip,
    user_agent: userAgent?.slice(0, 400) ?? null,
  });

  if (error) return { erro: "Não foi possível enviar agora. Tente de novo em instantes." };

  if (slug) revalidatePath(`/guia/${slug}`);
  return { ok: "Comentário enviado. Ele aparece assim que passar pela revisão." };
}
