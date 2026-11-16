import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { processarFila } from "@/lib/redes/fila";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Publica nas redes sociais o que foi agendado e venceu.
 *
 * Quem chama é o `pg_cron` do Supabase, de minuto em minuto, e SÓ quando há
 * envio vencido (`disparar_fila_das_redes`, migration 0084): fila vazia não
 * acorda esta função. Por isso ela é uma rotina "sob demanda" na tela de saúde.
 *
 * A rota não decide o que sai: só cumpre o que uma pessoa liberou, pelo painel
 * ou pelo conector. As travas moram em `lib/redes/posts.ts` e a publicação em
 * `lib/redes/fila.ts`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  try {
    const feitos = await processarFila(supabase, { limite: 4 });
    const conta = (estado: string) => feitos.filter((f) => f.estado === estado).length;
    // Envio que deu erro não é a ROTINA parada: o motivo fica no próprio envio, e a tela de publicar mostra.
    await registrarPulso(supabase, "redes-fila", true, `${conta("publicado")} publicados, ${conta("processando")} preparando, ${conta("erro") + conta("de_novo")} com erro`);
    return NextResponse.json({ ok: true, envios: feitos.map((f) => ({ rede: f.rede, estado: f.estado })) });
  } catch (e) {
    console.error("[redes] fila:", e);
    await registrarPulso(supabase, "redes-fila", false, e instanceof Error ? e.message : "erro na fila");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
