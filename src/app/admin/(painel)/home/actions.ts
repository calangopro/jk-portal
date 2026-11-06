"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { esquemaDoLayout, layoutPadraoDaHome } from "@/lib/blocos/tipos";
import { TAG_LAYOUT } from "@/lib/blocos/ler";
import { conferirLayout } from "@/lib/blocos/conferir";

export type ResultadoDaHome = { ok: true } | { ok: false; erro: string };

export async function salvarHome(bruto: unknown): Promise<ResultadoDaHome> {
  const perfil = await requireStaff();

  const lido = esquemaDoLayout.safeParse(bruto);
  if (!lido.success) return { ok: false, erro: "O layout chegou num formato que não reconheço." };
  const layout = lido.data;

  // Regra absoluta do projeto, conferida no servidor. Deixar só no formulário
  // seria conselho, e conselho se contorna.
  const problema = conferirLayout(layout);
  if (problema) return { ok: false, erro: problema };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: "pagina:home",
      value: layout as unknown as Record<string, unknown>,
      updated_by: perfil.id,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, erro: error.message };

  // Tag derruba o dado cacheado; caminho derruba o HTML já renderizado. Só a
  // tag deixaria o Next servir a home antiga até o ISR de uma hora expirar.
  revalidateTag(TAG_LAYOUT);
  revalidatePath("/");
  return { ok: true };
}

/** Volta a home ao layout de fábrica, sem apagar nada além do que ela mesma gravou. */
export async function restaurarHome(): Promise<ResultadoDaHome> {
  await requireStaff();
  return salvarHome(layoutPadraoDaHome());
}
