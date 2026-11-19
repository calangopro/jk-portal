import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { rodarLeituraDaKommo } from "@/lib/kommo/espelho";
import { conferirWebhook } from "@/lib/kommo/webhook";
import { processarVendasDaKommo } from "@/lib/kommo/vendas-rodada";

/**
 * A leitura da Kommo (0160, `lib/kommo/espelho.ts`), de dez em dez minutos pelo
 * `pg_cron`. Completa o que o webhook perdeu (a Kommo desliga webhook depois de
 * falhas) e, na primeira vez, traz os negócios dos últimos 90 dias, em várias
 * rodadas. Só LÊ a Kommo.
 *
 * Sem a chave, a rota não deixa pulso: a Saúde mostra "ainda sem registro",
 * que é a verdade (a ligação nunca foi feita), em vez de um "funcionando".
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const db = createAdminClient();
  if (!(await cronAutorizado(request, db))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  try {
    const r = await rodarLeituraDaKommo(db, { prazoMs: 45_000 });
    if (r.estado === "sem_chave") return NextResponse.json(r);
    // Uma vez por hora, confere se a Kommo não desligou o webhook.
    if (new Date().getUTCMinutes() < 10) await conferirWebhook(db);
    // A venda ganha (cartão 47) é um passo à parte: falhar aqui não derruba a leitura do espelho.
    let vendas = "";
    try {
      vendas = (await processarVendasDaKommo(db)).detalhe;
    } catch (e) {
      vendas = `vendas da Kommo: ${e instanceof Error ? e.message : String(e)}`;
    }
    await registrarPulso(db, "kommo", true, [r.detalhe, vendas].filter(Boolean).join("; "));
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await registrarPulso(db, "kommo", false, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
