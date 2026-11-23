import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { lerCredencial } from "@/lib/appmax/cliente";
import { lerLiquidosDaAppmax } from "@/lib/appmax/ler";
import { vincularPedidosPagos } from "@/lib/appmax/vincular";

/**
 * Lê da Appmax o que foi descontado de cada venda paga (0205, `lib/appmax/`).
 *
 * Quem chama é o `pg_cron`, de dez em dez minutos. Sem a chave da Appmax a rota
 * só deixa o pulso: a Saúde julga esta rotina pelo relógio, e "sem chave" é
 * ligação que nunca foi feita, não rodada com erro.
 *
 * Corpo `{"vincular": 30}` liga ao pedido da Appmax os pagos dos últimos 30 dias
 * que ainda não têm vínculo (até 60 por chamada; chame de novo para o resto).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => ({}))) as { vincular?: unknown };
  const dias = typeof corpo?.vincular === "number" && Number.isFinite(corpo.vincular) ? corpo.vincular : null;

  try {
    if (dias !== null) {
      return NextResponse.json({ vinculo: await vincularPedidosPagos(supabase, { dias }) });
    }
    // Com a chave colada, cada rodada também liga ao pedido da Appmax uns poucos pagos dos últimos 35 dias que ainda
    // não têm vínculo (o histórico anterior à ligação). Pronto o histórico, isso não faz nenhuma chamada à Tray.
    if (await lerCredencial(supabase)) await vincularPedidosPagos(supabase, { dias: 35, maximo: 25 }).catch(() => null);
    const r = await lerLiquidosDaAppmax(supabase);
    if (r.estado === "sem_chave") await registrarPulso(supabase, "appmax", true, "sem chave");
    else if (r.estado === "recusada") await registrarPulso(supabase, "appmax", false, r.mensagem);
    else await registrarPulso(supabase, "appmax", r.com_erro === 0 || r.lidos > 0, `${r.lidos} lidos, ${r.com_erro} com erro`);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (dias === null) await registrarPulso(supabase, "appmax", false, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
