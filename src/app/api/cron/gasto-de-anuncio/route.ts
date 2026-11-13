import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { lerGastoDasPlataformas } from "@/lib/trafego/plataformas";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

/**
 * Lê o gasto de anúncio no Meta e no Google Ads e grava em `anuncios_gasto`.
 *
 * Quem chama é o `pg_cron` do Supabase, de hora em hora (migration 0060), com
 * o mesmo segredo da publicação agendada. Plataforma sem acesso não derruba a
 * outra: cada uma grava o próprio resultado em `sync_logs`, e é de lá que a
 * tela de tráfego tira "lida há X" ou o que falta configurar.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  const resultados = await lerGastoDasPlataformas(supabase, hojeEmSaoPaulo(), 7);
  return NextResponse.json({ resultados });
}
