import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { rodarLeituraDaKommo } from "@/lib/kommo/espelho";
import { conferirWebhook } from "@/lib/kommo/webhook";
import { processarVendasDaKommo } from "@/lib/kommo/vendas-rodada";
import { rodarAvisosDaKommo } from "@/lib/kommo/automacoes";

/**
 * A leitura da Kommo (0160, `lib/kommo/espelho.ts`), de dez em dez minutos pelo
 * `pg_cron`. Completa o que o webhook perdeu (a Kommo desliga webhook depois de
 * falhas) e, na primeira vez, traz os negócios dos últimos 90 dias, em várias
 * rodadas. A leitura só LÊ a Kommo; o passo dos avisos (cartão 49) escreve,
 * e só pelas automações que a diretoria ligou, por `lib/kommo/escrever.ts`.
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

    // O painel avisa a Kommo (cartão 49): outro passo, com pulso próprio. Durante a
    // carga inicial o espelho ainda não conhece os negócios, e o passo espera.
    if (r.cargaEmAndamento) {
      await registrarPulso(db, "kommo-avisos", true, "esperando a carga inicial do espelho");
    } else {
      try {
        const avisos = await rodarAvisosDaKommo(db, { prazoMs: 10_000 });
        await registrarPulso(db, "kommo-avisos", avisos.falhas === 0 || avisos.feitas > 0, avisos.detalhe);
      } catch (e) {
        await registrarPulso(db, "kommo-avisos", false, e instanceof Error ? e.message : String(e));
      }
    }
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await registrarPulso(db, "kommo", false, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
