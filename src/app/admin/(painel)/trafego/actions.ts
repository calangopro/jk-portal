"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PLATAFORMAS, dividirPorDia } from "@/lib/trafego/retorno";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

/**
 * Lança o gasto de anúncio de um dia ou de um intervalo.
 *
 * Com intervalo, o valor é dividido igualmente pelos dias: serve para pôr o
 * total da fatura do mês quando ninguém anotou dia a dia. Lançar de novo o
 * mesmo dia e a mesma plataforma SUBSTITUI o valor, não soma, que é o que
 * deixa corrigir um número sem duplicar gasto.
 */
export async function lancarGasto(formData: FormData): Promise<void> {
  const perfil = await requireArea("trafego");

  const plataforma = String(formData.get("plataforma") ?? "");
  if (!PLATAFORMAS.some((p) => p.chave === plataforma)) return;
  const s = String(formData.get("valor") ?? "").replace(/[R$\s]/g, "");
  const valor = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  if (!Number.isFinite(valor) || valor < 0) return;

  const data = (v: FormDataEntryValue | null) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
  const hoje = hojeEmSaoPaulo();
  let de = data(formData.get("de"));
  let ate = data(formData.get("ate")) ?? de;
  // Datas trocadas de lugar: é o mesmo intervalo, não um erro para a pessoa adivinhar.
  if (de && ate && ate < de) [de, ate] = [ate, de];
  if (!de || !ate || ate > hoje) return;

  const dias = dividirPorDia(valor, de, ate);
  // Três meses é o maior intervalo que faz sentido dividir por igual.
  if (dias.length === 0 || dias.length > 92) return;

  const db = await createClient();
  const { error } = await db.from("anuncios_gasto").upsert(
    dias.map((d) => ({
      dia: d.dia,
      plataforma,
      campanha: "",
      gasto: d.gasto,
      fonte: "manual",
      lancado_por: perfil.id,
      atualizado_em: new Date().toISOString(),
    })),
    { onConflict: "dia,plataforma,campanha" },
  );
  if (error) console.error("[trafego] lancarGasto:", error.message);

  revalidatePath("/admin/trafego");
  revalidatePath("/admin");
}
