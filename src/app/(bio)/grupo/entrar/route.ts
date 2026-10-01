import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerGrupo } from "@/lib/grupo/ler";
import { SITE } from "@/lib/seo/site";

/**
 * O link fixo do grupo: jkaliancas.com.br/grupo/entrar.
 *
 * Leva para o convite que estiver salvo no painel naquele momento. É isso que
 * deixa o anúncio, a bio, o QR das lojas e o ManyChat apontarem para um
 * endereço só: o grupo encheu, troca o destino no painel, e nenhum link
 * espalhado por aí precisa mudar. Para o anúncio, trocar o link quebraria o
 * aprendizado da campanha.
 *
 * Quem vem do formulário traz `?l=<id do contato>`, e o clique fica gravado no
 * contato. É a diferença entre "deixou o contato" e "foi até o grupo".
 *
 * 302 e sem cache, nunca 301: o destino muda, e um 301 ficaria guardado no
 * navegador apontando para o grupo cheio.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const grupo = await lerGrupo();
  const lead = request.nextUrl.searchParams.get("l") ?? "";

  if (UUID.test(lead)) {
    after(async () => {
      try {
        await createAdminClient()
          .from("leads")
          .update({ clicou_grupo_em: new Date().toISOString() })
          .eq("id", lead)
          .is("clicou_grupo_em", null);
      } catch {
        // Perder o registro do clique não pode impedir a pessoa de entrar.
      }
    });
  }

  // Sem grupo configurado, a bio ainda tem o que mostrar.
  const destino = grupo.destino || `${SITE.lojaUrl}/bio`;
  const resposta = NextResponse.redirect(destino, 302);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
