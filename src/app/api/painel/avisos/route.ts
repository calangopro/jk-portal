import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { avisosDoSuporte } from "@/lib/suporte/casos";
import { lerResumoDoSuporteNoServidor } from "@/lib/suporte/dados";
import { avisosDoMenu } from "@/lib/time/chat";
import { lerResumoDoChat } from "@/lib/time/dados";

export const dynamic = "force-dynamic";

/**
 * Os números do menu do painel, para a moldura atualizar sozinha (ver
 * `AvisosAoVivo.ts`). Devolve só contagem, nunca texto de mensagem.
 *
 * Fica fora de `/admin` como a ficha do aplicativo, e por isso confere a
 * sessão por conta própria: sem pessoa ativa, 401 e nenhum número. A conta é
 * a das funções do banco, que olham a área de novo (`time` para o chat;
 * `suporte` e `lancar_venda` para o suporte pós-venda).
 */
export async function GET() {
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) {
    return NextResponse.json({ erro: "sem sessão" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const db = await createClient();
  const [chat, suporte] = await Promise.all([lerResumoDoChat(db), lerResumoDoSuporteNoServidor(db)]);
  return NextResponse.json({ avisos: { ...avisosDoMenu(chat), ...avisosDoSuporte(suporte) } }, { headers: { "Cache-Control": "no-store" } });
}
