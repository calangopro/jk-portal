"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { ENDERECO_DAS_SUGESTOES, ehEstado } from "@/lib/sugestoes/sugestoes";
import { createClient } from "@/lib/supabase/server";

/** Muda o estado de uma sugestão e grava a resposta. Só a diretoria; o banco confere de novo (`sugestao_mudar`). */
export async function mudarSugestao(id: number, estado: string, resposta: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const perfil = await requireArea("time");
  if (!ehAdmin(perfil.role)) return { ok: false, erro: "Só a diretoria muda o estado de uma sugestão." };
  if (!Number.isInteger(id) || id <= 0 || !ehEstado(estado)) return { ok: false, erro: "Não deu para saber qual sugestão mudar." };
  const db = await createClient();
  const { data, error } = await db.rpc("sugestao_mudar", { p_id: id, p_estado: estado, p_resposta: resposta.slice(0, 2000) });
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (error || !r.ok) {
    if (error) console.error("[sugestoes] sugestao_mudar:", error.message);
    return {
      ok: false,
      erro:
        r.motivo === "nao_achou"
          ? "Essa sugestão não existe mais."
          : r.motivo === "no_roadmap"
            ? "Essa sugestão já está no Roadmap: o estado dela anda com o cartão. Aqui, só a resposta muda."
            : "Não deu para salvar agora. Tente de novo.",
    };
  }
  revalidatePath(ENDERECO_DAS_SUGESTOES);
  return { ok: true };
}
