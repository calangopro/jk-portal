"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS, type Estado } from "@/lib/vendas/recuperacao";

/** "1.234,56", "1234,56" e "1234.56" viram número. */
function dinheiro(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Grava o que a equipe decidiu sobre um caso da fila de recuperação.
 *
 * A decisão fica presa ao pedido de referência do caso. "Recuperado" não se
 * grava: é a própria fila que tira o cliente quando aparece pedido pago dele.
 * Voltar para a fila é gravar "a_recuperar" por cima.
 *
 * Só administrador, e a RLS da tabela barra os outros papéis mesmo que alguém
 * chame a ação direto.
 */
export async function marcarCaso(formData: FormData): Promise<void> {
  const perfil = await requireArea("recuperacao");

  const pedido = Number(formData.get("pedido"));
  const estado = String(formData.get("estado") ?? "") as Estado;
  if (!Number.isInteger(pedido) || pedido <= 0 || !ESTADOS.includes(estado)) return;

  const valorFora = estado === "pago_por_fora" ? dinheiro(formData.get("valor")) : null;
  // Sem valor, "pagou por fora" não serve para nada: é o único registro desse dinheiro.
  if (estado === "pago_por_fora" && valorFora === null) return;

  const nota = String(formData.get("nota") ?? "").trim().slice(0, 300) || null;

  const db = await createClient();
  const { error } = await db.from("recuperacao_casos").upsert(
    {
      pedido,
      estado,
      nota,
      valor_fora: valorFora,
      atualizado_por: perfil.id,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "pedido" },
  );
  if (error) console.error("[recuperacao] marcarCaso:", error.message);

  revalidatePath("/admin/recuperacao");
}
