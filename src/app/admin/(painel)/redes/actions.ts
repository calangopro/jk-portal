"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { lerRedes } from "@/lib/redes/leitura";
import { createAdminClient } from "@/lib/supabase/admin";

export type RespostaDasRedes = { ok?: string; erro?: string };

/** Entre uma leitura pedida à mão e a seguinte. As redes limitam chamadas, e a rotina já lê de meia em meia hora. */
const INTERVALO_MS = 3 * 60_000;

/**
 * "Ler agora": roda a leitura das redes sem esperar a rotina. Qualquer pessoa
 * com a área pode pedir. Não devolve nome de conta nem mensagem da rede: só a
 * contagem, e o detalhe de cada conta aparece na própria tela.
 */
export async function lerRedesAgora(_anterior: RespostaDasRedes, _dados: FormData): Promise<RespostaDasRedes> {
  await requireArea("redes");
  const db = createAdminClient();

  const { data: ultima } = await db.from("redes_contas").select("lida_em").eq("status", "ativa").order("lida_em", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (ultima?.lida_em && Date.now() - Date.parse(ultima.lida_em as string) < INTERVALO_MS) {
    return { erro: "As redes foram lidas há menos de 3 minutos. Espere um pouco para pedir de novo." };
  }

  const contas = await lerRedes(db, { dias: 7, paginas: 1, metricas: 25, prazoMs: 40_000 });
  revalidatePath("/admin/redes", "layout");
  if (contas.length === 0) return { erro: "Nenhuma conta ligada para ler." };
  const boas = contas.filter((c) => c.estado === "ok").length;
  const parciais = contas.filter((c) => c.estado === "parcial").length;
  const ruins = contas.length - boas - parciais;
  if (ruins === contas.length) return { erro: "Nenhuma conta respondeu. O motivo de cada uma está no cartão dela." };
  const partes = [`${boas} ${boas === 1 ? "conta lida" : "contas lidas"}`];
  if (parciais) partes.push(`${parciais} com leitura incompleta`);
  if (ruins) partes.push(`${ruins} sem resposta`);
  return { ok: `${partes.join(", ")}.` };
}
