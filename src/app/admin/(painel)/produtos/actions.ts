"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";

export type SyncState = { erro?: string; ok?: string };

/** Dispara a sincronização manual do catálogo. */
export async function sincronizarAgora(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  await requireStaff();

  const { sincronizarCatalogo } = await import("@/lib/tray/sincronizar");
  const r = await sincronizarCatalogo();

  revalidatePath("/admin/produtos");

  if (!r.ok) return { erro: r.erro ?? "A sincronização falhou." };

  const partes = [
    `${r.produtos} produtos`,
    `${r.categorias} categorias`,
    `${r.atributos} com atributos`,
    r.desativados > 0 ? `${r.desativados} desativados` : null,
  ].filter(Boolean);

  const aviso = r.falhas > 0
    ? ` ${r.falhas} não gravaram. Primeiro erro: ${r.primeiroErro ?? "sem detalhe"}.`
    : "";

  return { ok: `Pronto em ${(r.duracaoMs / 1000).toFixed(1)}s: ${partes.join(", ")}.${aviso}` };
}
