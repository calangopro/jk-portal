import type { NextRequest } from "next/server";
import { responderLeitura } from "@/lib/qrcode/servir";

/**
 * jkaliancas.com.br/qrcode, o endereço dos 36 adesivos dos banheiros do
 * Shopping Tamboré. Está impresso: não muda de lugar, não ganha parâmetro
 * obrigatório. É a linha de slug vazio em `qrcodes`, e o destino se troca em
 * /admin/qrcode. Os outros QRs moram em `qrcode/[slug]`.
 */

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return responderLeitura(request, "");
}
