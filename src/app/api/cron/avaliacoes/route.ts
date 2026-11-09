import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { sincronizarAvaliacoes } from "@/lib/google-perfil/sincronizar";
import { TAG_AVALIACOES } from "@/lib/google-perfil/publico";

/**
 * Sincroniza as avaliações do Google das lojas.
 *
 * Quem chama é o `pg_cron` do Supabase, todo dia de manhã (migration 0048),
 * com o mesmo segredo da publicação agendada. O resultado fica gravado e
 * aparece no cartão do Google em Integrações.
 */

export const dynamic = "force-dynamic";
// Contas, locais e todas as páginas de avaliação de oito lojas.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const resultado = await sincronizarAvaliacoes();
  if (resultado.ok) revalidateTag(TAG_AVALIACOES);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
}
