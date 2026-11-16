"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { marcarComentario, ocultarComentario, responderComentario } from "@/lib/redes/comentarios";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As ações da tela de comentários. Pedem a área `redes` e chamam o núcleo
 * (`lib/redes/comentarios.ts`). Responder e ocultar mexem na rede de verdade,
 * em público: a tela pede o segundo toque antes de chamar.
 */

export type RespostaDoComentario = { ok: true; aviso: string } | { ok: false; erro: string };

const atualizar = () => revalidatePath("/admin/redes/comentarios");

/** Publica a resposta em nome da JK. Fica gravado quem respondeu. */
export async function responder(id: string, texto: string): Promise<RespostaDoComentario> {
  const perfil = await requireArea("redes");
  const r = await responderComentario(createAdminClient(), { id: perfil.id }, String(id ?? ""), String(texto ?? ""));
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: `Resposta publicada no ${r.rede}.` };
}

/** Tira da fila sem responder, ou devolve para a fila. Nada vai para a rede. */
export async function marcar(id: string, estado: "visto" | "novo"): Promise<RespostaDoComentario> {
  await requireArea("redes");
  const r = await marcarComentario(createAdminClient(), String(id ?? ""), estado === "novo" ? "novo" : "visto");
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: estado === "novo" ? "Voltou para a fila." : "Tirado da fila." };
}

/** Oculta o comentário na rede. */
export async function ocultar(id: string): Promise<RespostaDoComentario> {
  await requireArea("redes");
  const r = await ocultarComentario(createAdminClient(), String(id ?? ""));
  if (!r.ok) return r;
  atualizar();
  return { ok: true, aviso: `Comentário ocultado no ${r.rede}.` };
}
