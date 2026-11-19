"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { ehFase } from "@/lib/kommo/funil";
import { createClient } from "@/lib/supabase/server";

export type ResultadoDaFase = { ok: boolean; erro?: string; confirmadas?: number };

const ERROS: Record<string, string> = {
  sem_acesso: "Só a diretoria liga etapa da Kommo a fase.",
  etapa_desconhecida: "Essa etapa não está no espelho da Kommo. Rode a leitura de novo em Integrações.",
  fase_invalida: "Escolha uma das fases da lista.",
};

function depois() {
  revalidatePath("/admin/kommo/fases");
  revalidatePath("/admin/funil");
}

/** Liga uma etapa a uma fase, ou a "sem fase" (fase vazia). A função do banco confere a diretoria. */
export async function salvarFaseDaEtapa(funil: number, etapa: number, fase: string): Promise<ResultadoDaFase> {
  await requireAdmin();
  if (!Number.isSafeInteger(funil) || !Number.isSafeInteger(etapa)) return { ok: false, erro: "Etapa inválida." };
  if (fase && !ehFase(fase)) return { ok: false, erro: ERROS.fase_invalida };
  const { data, error } = await (await createClient()).rpc("kommo_fase_salvar", { p_funil: funil, p_etapa: etapa, p_fase: fase || null });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string } | null;
  if (!r?.ok) return { ok: false, erro: ERROS[r?.erro ?? ""] ?? "Não deu para salvar." };
  depois();
  return { ok: true };
}

/** Confirma de uma vez as fases que vieram por palpite e ninguém conferiu. */
export async function confirmarPalpites(): Promise<ResultadoDaFase> {
  await requireAdmin();
  const { data, error } = await (await createClient()).rpc("kommo_fases_confirmar_palpites");
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string; confirmadas?: number } | null;
  if (!r?.ok) return { ok: false, erro: ERROS[r?.erro ?? ""] ?? "Não deu para confirmar." };
  depois();
  return { ok: true, confirmadas: r.confirmadas ?? 0 };
}
