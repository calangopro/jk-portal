"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ResultadoDoMapa = { ok: boolean; erro?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROS: Record<string, string> = {
  sem_acesso: "Só a diretoria liga usuário da Kommo a pessoa e loja.",
  usuario_desconhecido: "Esse usuário não está no espelho da Kommo. Rode a leitura de novo em Integrações.",
  papel_invalido: "Escolha o que esse usuário é.",
};

/** Liga um usuário da Kommo a uma pessoa e a uma loja. Passa pela função do banco, que confere a diretoria. */
export async function salvarMapaDaKommo(usuario: number, papel: string, pessoa: string, loja: string): Promise<ResultadoDoMapa> {
  await requireAdmin();
  if (!Number.isSafeInteger(usuario)) return { ok: false, erro: "Usuário inválido." };
  const { data, error } = await (await createClient()).rpc("kommo_mapa_salvar", {
    p_usuario: usuario,
    p_papel: papel,
    p_profile: UUID.test(pessoa) ? pessoa : null,
    p_location: UUID.test(loja) ? loja : null,
  });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string } | null;
  if (!r?.ok) return { ok: false, erro: ERROS[r?.erro ?? ""] ?? "Não deu para salvar." };
  revalidatePath("/admin/kommo");
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
