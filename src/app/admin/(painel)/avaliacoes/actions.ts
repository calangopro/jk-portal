"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { responderNoGoogle, usarHorarioDoGoogle } from "@/lib/google-perfil/painel";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

/**
 * Quem fala em nome da loja no Google e mexe no horário da página pública:
 * administrador, dono, GM e gerente. A tela abre para quem cuida do catálogo,
 * mas escrever para fora é mais fechado.
 */
function podeFalarPelaLoja(papel: string): boolean {
  return ehAdmin(papel) || papel === "gerente";
}

/** Publica a resposta de uma avaliação no Google. É pública e sai no nome da loja. */
export async function responder(name: string, resposta: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const perfil = await requireArea("catalogo");
  if (!podeFalarPelaLoja(perfil.role)) return { ok: false, erro: "Só administrador, dono, GM ou gerente responde em nome da loja." };
  const texto = String(resposta ?? "").trim();
  if (texto.length < 2) return { ok: false, erro: "Escreva a resposta." };
  if (texto.length > 4000) return { ok: false, erro: "A resposta passou de 4.000 caracteres." };
  if (/[—–]/.test(texto)) return { ok: false, erro: "Troque o travessão por vírgula ou ponto: a casa não usa travessão." };
  const r = await responderNoGoogle(String(name ?? ""), texto);
  if (r.ok) revalidatePath("/admin/avaliacoes");
  return r;
}

/** Leva o horário que o Google tem para a página pública da loja, com a fonte escrita. */
export async function usarHorario(localName: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const perfil = await requireArea("catalogo");
  if (!podeFalarPelaLoja(perfil.role)) return { ok: false, erro: "Só administrador, dono, GM ou gerente muda o horário da loja." };
  const r = await usarHorarioDoGoogle(String(localName ?? ""), hojeEmSaoPaulo());
  if (!r.ok) return r;
  revalidatePath("/admin/avaliacoes");
  revalidatePath("/admin/lojas");
  revalidatePath(`/lojas/${r.slug}`);
  revalidatePath("/lojas");
  return { ok: true };
}
