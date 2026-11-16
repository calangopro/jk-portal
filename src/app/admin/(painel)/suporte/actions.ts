"use server";

import { requireSessao } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { linksDosPrints } from "@/lib/suporte/dados";

/**
 * O que o suporte pede ao SERVIDOR: só o link assinado do print, que precisa
 * da chave de serviço. Abrir, assumir e fechar saem direto do navegador para
 * o banco (`api.ts`), como no chat. A área é conferida aqui e de novo dentro
 * da função do banco, que é quem decide se a sessão pode ver aquele caso.
 */
export async function assinarPrints(caso: number): Promise<string[]> {
  const perfil = await requireSessao();
  if (!perfil.areas.includes("lancar_venda") && !perfil.areas.includes("suporte")) return [];
  if (!Number.isInteger(caso) || caso <= 0) return [];
  return linksDosPrints(await createClient(), caso);
}
