import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { sincronizarCatalogo } from "@/lib/tray/sincronizar";
import { revalidarPrecos } from "@/lib/tray/revalidar";

/**
 * Sincroniza o catálogo com a Tray e refaz as páginas quando o preço mudou.
 *
 * Quem chama é o `pg_cron` do Supabase, de quinze em quinze minutos
 * (migration 0040), com o segredo de `integration_tokens`, no mesmo desenho da
 * publicação agendada. Antes disso não existia relógio nenhum: o preço só
 * mudava quando alguém apertava "Sincronizar agora", e a loja podia mudar um
 * valor de manhã que o portal anunciava o velho por semanas.
 *
 * A primeira rodada do dia cai à meia-noite de São Paulo (03h00 UTC é um dos
 * horários da grade de quinze minutos), e é ela que tira do ar a promoção que
 * acabou no dia anterior.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();

  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const r = await sincronizarCatalogo();
  if (r.revalidar) revalidarPrecos();

  return NextResponse.json(
    {
      ok: r.ok,
      produtos: r.produtos,
      alterados: r.alterados,
      desativados: r.desativados,
      falhas: r.falhas,
      revalidou: r.revalidar,
      aviso: r.aviso ?? null,
      erro: r.erro ?? null,
      duracaoMs: r.duracaoMs,
    },
    { status: r.ok ? 200 : 500 },
  );
}
