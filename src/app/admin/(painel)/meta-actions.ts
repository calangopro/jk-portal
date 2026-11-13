"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo, primeiroDoMes } from "@/lib/vendas/periodo";

/**
 * Define ou muda a meta de faturamento do mês corrente.
 *
 * Só administrador, dono ou GM, e a RLS de `metas` confere de novo. O mês é
 * sempre o de hoje em São Paulo: a tela não manda o mês, para ninguém gravar
 * meta em mês errado mexendo no formulário.
 */
export async function definirMeta(formData: FormData): Promise<void> {
  const perfil = await requireAdmin();
  const s = String(formData.get("valor") ?? "").replace(/[R$\s]/g, "");
  const valor = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  if (!Number.isFinite(valor) || valor <= 0) return;

  const db = await createClient();
  const { error } = await db.from("metas").upsert(
    {
      mes: primeiroDoMes(hojeEmSaoPaulo()),
      valor: Math.round(valor * 100) / 100,
      definido_por: perfil.id,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "mes" },
  );
  if (error) console.error("[painel] definirMeta:", error.message);
  revalidatePath("/admin");
}
