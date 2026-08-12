"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
// Mesma função que gera o slug de conteúdo: um só padrão de endereço no portal.
import { gerarSlug } from "@/lib/data/admin-contents";

export type AutoresState = { error?: string; success?: string };

/** Uma URL por linha, ignorando linha vazia e endereço malformado. */
function lerPerfis(bruto: string): { urls: string[]; invalidas: string[] } {
  const urls: string[] = [];
  const invalidas: string[] = [];
  for (const linha of bruto.split("\n").map((l) => l.trim()).filter(Boolean)) {
    try {
      const u = new URL(linha);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      urls.push(u.toString());
    } catch {
      invalidas.push(linha);
    }
  }
  return { urls, invalidas };
}

export async function salvarAutor(
  _prev: AutoresState,
  formData: FormData,
): Promise<AutoresState> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugInformado = String(formData.get("slug") ?? "").trim();
  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const credentials = String(formData.get("credentials") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) return { error: "Informe o nome de quem assina." };

  const { urls, invalidas } = lerPerfis(String(formData.get("same_as") ?? ""));
  if (invalidas.length) {
    return {
      error:
        `Endereço de perfil inválido: ${invalidas.join(", ")}. ` +
        "Use o endereço completo, começando com https://",
    };
  }

  const slug = gerarSlug(slugInformado || name);
  if (!slug) return { error: "Não foi possível montar um endereço a partir do nome." };

  const payload = {
    slug,
    name,
    job_title: jobTitle || null,
    credentials: credentials || null,
    bio: bio || null,
    email: email || null,
    same_as: urls,
  };

  const consulta = id
    ? supabase.from("authors").update(payload).eq("id", id)
    : supabase.from("authors").insert(payload);

  const { error } = await consulta;
  if (error) {
    if (error.code === "23505") {
      return { error: `Já existe uma pessoa com o endereço /autor/${slug}.` };
    }
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/admin/autores");
  revalidatePath(`/autor/${slug}`);
  return { success: id ? "Alterações salvas." : `${name} foi cadastrada.` };
}

/**
 * Desativa em vez de apagar, para não quebrar o `author.url` de conteúdo já
 * publicado nem perder o histórico de quem assinou o quê.
 */
export async function alternarAtivo(id: string, ativo: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("authors")
    .update({ is_active: ativo })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/autores");
  return { success: ativo ? "Pessoa reativada." : "Pessoa desativada." };
}
