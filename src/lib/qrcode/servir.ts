import "server-only";
import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerQrcode } from "./ler";
import { destinoDeFabrica, destinoDoQrcode } from "./tipos";

/**
 * A leitura de um QR: leva ao destino salvo no painel e conta.
 *
 * 302 e sem cache, nunca 301: o destino muda, e um 301 ficaria guardado no
 * celular de quem já leu, apontando para o número velho.
 *
 * A contagem mora aqui e não no GA4 porque a pessoa vai direto para o
 * WhatsApp, sem nenhuma página do site carregar no meio. Uma página de
 * passagem para o GA4 medir custaria um segundo de tela branca a cada leitura.
 *
 * Slug que não existe (endereço digitado errado) vai para o destino do QR do
 * Tamboré e não conta: melhor cair no WhatsApp da JK do que numa página de
 * erro, e a contagem é de adesivo, não de digitação.
 */

/** Robô de prévia de link (WhatsApp, Facebook) e ferramenta de teste não leem adesivo. */
const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|curl|wget|python|headless|lighthouse/i;

function aparelho(ua: string): "iphone" | "android" | "outro" {
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "outro";
}

export async function responderLeitura(request: NextRequest, slug: string): Promise<NextResponse> {
  const doQr = await lerQrcode(slug);
  const principal = slug === "" || doQr ? null : await lerQrcode("");

  const destino =
    (doQr && destinoDoQrcode(doQr)) ??
    (principal && destinoDoQrcode(principal)) ??
    destinoDoQrcode(destinoDeFabrica())!;

  const ua = request.headers.get("user-agent") ?? "";

  // O Next responde HEAD com este mesmo GET, e HEAD não é gente lendo QR.
  // Slug sem linha no banco não conta. O do Tamboré conta sempre, mesmo quando
  // a leitura do destino falhou e valeu o de fábrica: a gravação é outro
  // pedido, e pode dar certo.
  if (request.method === "GET" && !ROBO.test(ua) && (doQr || slug === "")) {
    const origem = (request.nextUrl.searchParams.get("o") ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);
    after(async () => {
      try {
        await createAdminClient()
          .from("qrcode_leituras")
          .insert({ qrcode: slug, origem, aparelho: aparelho(ua), destino: destino.slice(0, 600) });
      } catch {
        // Perder a contagem não pode impedir a pessoa de chegar ao destino.
      }
    });
  }

  const resposta = NextResponse.redirect(destino, 302);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
