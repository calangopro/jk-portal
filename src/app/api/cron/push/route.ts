import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { rodadaDoPush } from "@/lib/avisos/enviar";

/**
 * Manda os avisos por push (cartão 59, 0190). Quem chama é o banco
 * (`disparar_push`): na hora, pelo gatilho da mensagem do chat e do caso de
 * suporte; de minuto em minuto, quando há aparelho ligado (é o que pega a
 * Kommo e o que o gatilho perdeu); e de 15 em 15 sempre, para deixar pulso.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const db = createAdminClient();
  if (!(await cronAutorizado(request, db))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  try {
    const r = await rodadaDoPush(db);
    await registrarPulso(db, "push", true, r.detalhe);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await registrarPulso(db, "push", false, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
