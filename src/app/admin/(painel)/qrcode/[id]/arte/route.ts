import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { qrEmPng, qrEmSvg } from "@/lib/qrcode/arte";
import { enderecoDoQrcode } from "@/lib/qrcode/tipos";

/**
 * A arte de um QR, em SVG (padrão) ou PNG (`?formato=png`). Com `?baixar=1`
 * sai como arquivo, com o nome do lugar.
 *
 * Rota, e não página, então o layout do painel não protege: a conferência de
 * sessão é feita aqui. A leitura do QR passa pela RLS de `qrcodes`.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getSessionProfile();
  if (!perfil?.isActive) return new NextResponse("Entre no painel para baixar.", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("qrcodes").select("slug").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("QR não encontrado.", { status: 404 });

  const endereco = enderecoDoQrcode(data.slug);
  const png = request.nextUrl.searchParams.get("formato") === "png";
  const baixar = request.nextUrl.searchParams.get("baixar") === "1";
  const arquivo = `qrcode-${data.slug || "tambore"}.${png ? "png" : "svg"}`;

  const headers: Record<string, string> = {
    "Content-Type": png ? "image/png" : "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, no-store",
  };
  if (baixar) headers["Content-Disposition"] = `attachment; filename="${arquivo}"`;

  const corpo = png ? new Uint8Array(await qrEmPng(endereco)) : await qrEmSvg(endereco);
  return new NextResponse(corpo, { headers });
}
