import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { lerChaves } from "@/lib/leads/chaves";
import { repassarLead } from "@/lib/leads/repassar";
import type { Lead } from "@/lib/leads/tipos";

/**
 * Nova tentativa dos contatos que algum destino recusou.
 *
 * Quem chama é o `pg_cron`, de dez em dez minutos, e só quando existe contato
 * pendente (a conferência mora na função do banco, 0041). Contato com menos de
 * dois minutos fica de fora: o repasse do próprio envio ainda pode estar
 * rodando, e as duas tentativas juntas criariam o contato duas vezes na Kommo.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const ate = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("envio_pendente", true)
    .lte("criado_em", ate)
    .order("criado_em", { ascending: true })
    .limit(30);

  const lista = (data ?? []) as Lead[];
  const chaves = await lerChaves(supabase);
  let resolvidos = 0;

  for (let i = 0; i < lista.length; i += 3) {
    const lote = lista.slice(i, i + 3);
    const r = await Promise.all(lote.map((lead) => repassarLead(supabase, lead, { chaves })));
    resolvidos += r.filter((envios) => !Object.values(envios).some((s) => s?.status === "erro")).length;
  }

  return NextResponse.json({ tentados: lista.length, resolvidos });
}
