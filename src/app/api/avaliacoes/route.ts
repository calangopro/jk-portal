import { NextResponse } from "next/server";
import { lerAvaliacoesPublicas } from "@/lib/google-perfil/publico";

/**
 * Avaliações do Google para a loja: `/guias/api/avaliacoes`.
 *
 * Quem chama é o tema da Tray, pelo mesmo domínio (o Worker manda `/guias/*`
 * para cá), então não precisa de CORS; o cabeçalho de origem fica só para o
 * teste por fora. `?loja=<slug>` traz uma loja só, `?limite=` até 60.
 *
 * Uma hora no cache da borda: a sincronização é diária, e a loja inteira lê
 * daqui sem bater no banco a cada visita.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const loja = (params.get("loja") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const limite = Number.parseInt(params.get("limite") ?? "", 10) || 24;

  const dados = await lerAvaliacoesPublicas(loja, limite);

  return NextResponse.json(dados, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "https://www.jkaliancas.com.br",
    },
  });
}
