import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Anota um endereço que não existe.
 *
 * Por que passa pelo navegador em vez de ser gravado direto na página 404:
 * o Next renderiza `not-found.tsx` junto de páginas que respondem 200, porque
 * o componente faz parte da árvore de layout e entra no pacote de navegação.
 * Registrar dali contava a página publicada como endereço quebrado, o que foi
 * observado na prática: uma visita a um guia existente somava três "404".
 *
 * Do navegador o sinal é exato: só chega quando a página de erro apareceu de
 * verdade para alguém. Rastreador que não roda JavaScript fica de fora, e tudo
 * bem: esse lado o Search Console já cobre. O que faltava era enxergar o link
 * quebrado que a pessoa clicou hoje, no WhatsApp ou num impresso antigo.
 *
 * A triagem contra varredura de robô, e o teto de endereços distintos na fila,
 * moram na função do banco, para valerem qualquer que seja o caminho de entrada.
 */
export async function POST(request: Request) {
  try {
    const corpo = (await request.json()) as { path?: string; referrer?: string };
    const caminho = typeof corpo.path === "string" ? corpo.path : "";
    if (!caminho) return new NextResponse(null, { status: 204 });

    // Chave de serviço porque `registrar_404` deixou de ser executável por
    // `anon`: com a chave anônima, que vai no HTML de toda página, qualquer
    // pessoa poderia chamar a função direto no PostgREST e encher a fila de
    // endereços quebrados com caminhos inventados. Este endpoint é a única
    // porta, e a triagem continua dentro da função do banco.
    const supabase = createAdminClient();
    await supabase.rpc("registrar_404", {
      p_path: caminho.slice(0, 200),
      p_referrer: typeof corpo.referrer === "string" ? corpo.referrer.slice(0, 500) : null,
    });
  } catch {
    // Falha aqui não pode virar erro na cara de quem já caiu num 404.
  }

  return new NextResponse(null, { status: 204 });
}
