import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerQrcode } from "@/lib/qrcode/ler";
import { destinoDoQrcode } from "@/lib/qrcode/tipos";
import { SITE } from "@/lib/seo/site";

/**
 * O endereço do QR impresso: jkaliancas.com.br/qrcode.
 *
 * Leva para o destino salvo em /admin/qrcode naquele momento e grava a leitura.
 * O número do WhatsApp mudou, troca no painel: o adesivo continua certo.
 *
 * 302 e sem cache, nunca 301: o destino muda, e um 301 ficaria guardado no
 * celular de quem já leu, apontando para o número velho.
 *
 * A contagem mora aqui e não no GA4 porque a pessoa vai direto para o
 * WhatsApp, sem nenhuma página do site carregar no meio. Uma página de
 * passagem para o GA4 medir custaria um segundo de tela branca a cada leitura,
 * na frente de quem está no banheiro do shopping com o celular na mão.
 */

export const dynamic = "force-dynamic";

/** Robô de prévia de link (WhatsApp, Facebook) e ferramenta de teste não leem adesivo. */
const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|curl|wget|python|headless|lighthouse/i;

function aparelho(ua: string): "iphone" | "android" | "outro" {
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "outro";
}

export async function GET(request: NextRequest) {
  const destino = destinoDoQrcode(await lerQrcode()) ?? `${SITE.lojaUrl}/bio`;
  const ua = request.headers.get("user-agent") ?? "";

  // O Next responde HEAD com este mesmo GET, e HEAD não é gente lendo QR.
  if (request.method === "GET" && !ROBO.test(ua)) {
    const origem = (request.nextUrl.searchParams.get("o") ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);
    after(async () => {
      try {
        await createAdminClient()
          .from("qrcode_leituras")
          .insert({ origem, aparelho: aparelho(ua), destino: destino.slice(0, 600) });
      } catch {
        // Perder a contagem não pode impedir a pessoa de chegar ao WhatsApp.
      }
    });
  }

  const resposta = NextResponse.redirect(destino, 302);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
