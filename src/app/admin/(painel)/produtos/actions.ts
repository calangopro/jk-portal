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
  const { revalidarPrecos } = await import("@/lib/tray/revalidar");
  const r = await sincronizarCatalogo();

  if (r.revalidar) revalidarPrecos();
  revalidatePath("/admin/produtos");

  if (!r.ok) return { erro: r.erro ?? "A sincronização falhou." };

  const partes = [
    `${r.produtos} produtos conferidos`,
    r.alterados > 0 ? `${r.alterados} atualizados` : "nenhum mudou na loja",
    r.desativados > 0 ? `${r.desativados} desativados` : null,
  ].filter(Boolean);

  const falhas = r.falhas > 0
    ? ` ${r.falhas} não gravaram. Primeiro erro: ${r.primeiroErro ?? "sem detalhe"}.`
    : "";
  const aviso = r.aviso ? ` ${r.aviso}` : "";

  return { ok: `Pronto em ${(r.duracaoMs / 1000).toFixed(1)}s: ${partes.join(", ")}.${falhas}${aviso}` };
}
