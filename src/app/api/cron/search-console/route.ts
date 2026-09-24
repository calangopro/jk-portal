import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { importarDoSearchConsole } from "@/lib/search-console/importar";

/**
 * Importa os últimos 28 dias do Search Console.
 *
 * Quem chama é o `pg_cron` do Supabase, toda segunda de manhã (migration 0038),
 * com o mesmo segredo da publicação agendada. O resultado, bom ou ruim, fica
 * gravado e aparece na tela de Métricas.
 */

export const dynamic = "force-dynamic";
// Token, duas consultas ao Google e até oito mil linhas gravadas. O padrão de
// 10 segundos da Vercel é curto para isso.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const resultado = await importarDoSearchConsole();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
}
