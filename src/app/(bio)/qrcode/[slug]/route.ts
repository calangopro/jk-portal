import type { NextRequest } from "next/server";
import { responderLeitura } from "@/lib/qrcode/servir";

/**
 * jkaliancas.com.br/qrcode/<slug>, os QRs criados em /admin/qrcode depois do
 * do Tamboré. O Worker já manda tudo que começa com /qrcode para cá, então
 * QR novo não pede mudança na Cloudflare.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Câmera de celular lê o que está no QR, e o painel só gera minúsculas. Quem
  // digitou à mão com maiúscula ainda chega no lugar certo.
  return responderLeitura(request, slug.toLowerCase());
}
