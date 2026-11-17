import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { rodarEnvioDaLoja } from "@/lib/meta/loja";

/**
 * Manda ao Meta a compra da loja pelo servidor (0120, `lib/meta/loja.ts`).
 *
 * Quem chama é o `pg_cron`, de dez em dez minutos, três minutos depois da
 * leitura de pedidos. Desligada, a rota só deixa o pulso: a Saúde julga esta
 * rotina pelo relógio, e "desligado" é uma rodada boa.
 *
 * Corpo `{"simular": true}` monta tudo e devolve o que iria (pedido, evento e
 * os NOMES dos campos de cliente, nunca os valores), sem mandar e sem gravar.
 * É o que se usa para conferir antes de ligar.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => ({}))) as { simular?: unknown };
  const simular = corpo?.simular === true;

  try {
    const r = await rodarEnvioDaLoja(supabase, { simular });
    if (!simular) {
      if (r.estado === "desligado") await registrarPulso(supabase, "meta-loja", true, "desligado");
      else if (r.estado === "sem_chave") await registrarPulso(supabase, "meta-loja", false, r.detalhe);
      else {
        const detalhe = `${r.modo}: ${r.mandados} mandados, ${r.deixados} deixados, ${r.erros} com erro${r.trayVoltou ? ", a Tray voltou a mandar (Purchase em pausa)" : ""}`;
        await registrarPulso(supabase, "meta-loja", r.erros === 0, detalhe);
      }
    }
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!simular) await registrarPulso(supabase, "meta-loja", false, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
