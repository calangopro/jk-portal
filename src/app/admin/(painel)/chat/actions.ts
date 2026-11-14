"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { conferirResposta, lerTema, type RascunhoDeResposta } from "@/lib/time/biblioteca";
import { linksDasImagensDoChat, virarResposta } from "@/lib/time/dados";

/**
 * O que o chat pede ao SERVIDOR. É pouco de propósito: mandar, sincronizar e
 * marcar como lida saem direto do navegador para o banco (`api.ts`), que é o
 * caminho mais curto. Aqui fica só o que precisa da chave de serviço (assinar
 * o link da imagem) e o que mexe em outra tela (guardar na biblioteca).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, teto: number): string => (typeof v === "string" ? v.trim().slice(0, teto) : "");

/**
 * O link assinado de cada imagem, pelo id. A área é conferida aqui e de novo
 * dentro da função do banco, que é quem decide de quais imagens a sessão pode
 * saber o caminho. Imagem recusada simplesmente não volta no resultado.
 */
export async function assinarImagens(anexos: string[]): Promise<Record<string, string>> {
  await requireArea("time");
  const ids = [...new Set((Array.isArray(anexos) ? anexos : []).filter((a): a is string => typeof a === "string" && UUID.test(a)))].slice(0, 60);
  if (ids.length === 0) return {};
  return linksDasImagensDoChat(await createClient(), ids);
}

/**
 * "Guardar na biblioteca": a mensagem que já tem resposta de outra pessoa vira
 * uma resposta "a confirmar", com a origem escrita pelo banco (a sala, quem
 * respondeu e quando).
 */
export async function guardarNaBiblioteca(mensagem: number, r: RascunhoDeResposta): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  await requireArea("time");
  if (!Number.isInteger(mensagem) || mensagem <= 0) return { ok: false, erro: "Mensagem inválida." };
  const limpo = { tema: texto(r?.tema, 40), pergunta: texto(r?.pergunta, 300), explicacao: texto(r?.explicacao, 4000), frase: texto(r?.frase, 2000), origem: "" };
  const erro = conferirResposta(limpo);
  const tema = lerTema(limpo.tema);
  if (erro || !tema) return { ok: false, erro: erro ?? "Escolha o tema da resposta." };
  const feito = await virarResposta(await createClient(), mensagem, { tema, pergunta: limpo.pergunta, explicacao: limpo.explicacao, frase: limpo.frase });
  if (feito.ok) revalidatePath("/admin/biblioteca");
  return feito;
}
