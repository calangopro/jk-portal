"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarGastoDoMeta, CONTA_DO_META, lerGastoDasPlataformas, PROVEDOR_META_ADS } from "@/lib/trafego/plataformas";
import { hojeEmSaoPaulo, somarDias } from "@/lib/vendas/periodo";
import type { IntegracaoState } from "./actions";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Salva o token do Meta que lê o gasto de anúncio.
 *
 * O token é conferido ANTES de gravar, pedindo o gasto de ontem da conta da
 * JK: token sem a permissão ou sem a conta atribuída é recusado aqui, com o
 * motivo, em vez de falhar calado na rotina. Gravado, ele nunca volta para a
 * tela. Logo depois de salvar, a primeira leitura já roda.
 */
export async function salvarTokenDoMetaAds(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const db = createAdminClient();

  if (String(formData.get("remover") ?? "") === "1") {
    await db.from("integration_tokens").delete().eq("provider", PROVEDOR_META_ADS);
    revalidatePath("/admin/integracoes");
    revalidatePath("/admin/trafego");
    return { ok: "Token removido. O gasto do Meta volta a depender de lançamento à mão." };
  }

  const token = String(formData.get("valor") ?? "").trim();
  if (token.length < 40 || /\s/.test(token)) return { erro: "Cole o token inteiro, sem espaço nem quebra de linha." };

  const hoje = hojeEmSaoPaulo();
  const ontem = somarDias(hoje, -1);
  try {
    await buscarGastoDoMeta(token, ontem, ontem);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para conferir o token agora. Tente de novo." };
  }

  const { error } = await db
    .from("integration_tokens")
    .upsert({ provider: PROVEDOR_META_ADS, access_token: token, meta: { conta: CONTA_DO_META } }, { onConflict: "provider" });
  if (error) return { erro: error.message };

  const leitura = (await lerGastoDasPlataformas(db, hoje, 35)).find((r) => r.plataforma === "meta");
  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/trafego");
  revalidatePath("/admin");
  return leitura?.estado === "ok"
    ? { ok: `Token conferido e salvo. Primeira leitura feita: ${leitura.dias} dias, ${reais(leitura.gasto ?? 0)}.` }
    : { ok: "Token conferido e salvo. A primeira leitura sai na próxima hora." };
}
