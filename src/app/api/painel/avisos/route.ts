import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { avisosDoMenu } from "@/lib/time/chamados";
import { lerAvisoDeChamados } from "@/lib/time/dados";

export const dynamic = "force-dynamic";

/**
 * Os números do menu do painel, para a moldura atualizar sozinha (ver
 * `AvisosAoVivo.ts`). Devolve só contagem, nunca texto de chamado.
 *
 * Fica fora de `/admin` como a ficha do aplicativo, e por isso confere a
 * sessão por conta própria: sem pessoa ativa, 401 e nenhum número. A conta é
 * a da função do banco, que olha a área `time` de novo.
 */
export async function GET() {
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) {
    return NextResponse.json({ erro: "sem sessão" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const chamados = await lerAvisoDeChamados(await createClient());
  return NextResponse.json({ avisos: avisosDoMenu(chamados) }, { headers: { "Cache-Control": "no-store" } });
}
