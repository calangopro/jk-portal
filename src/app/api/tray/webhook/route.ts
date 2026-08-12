import { NextResponse, type NextRequest } from "next/server";

/**
 * Webhook da Tray: recebe aviso de produto criado, alterado ou removido e
 * dispara a sincronização, para o portal não depender só do agendamento.
 *
 * Protegido por segredo compartilhado em TRAY_WEBHOOK_SECRET, enviado pela
 * Tray no cabeçalho x-tray-secret ou na query ?secret=. Sem o segredo
 * configurado, a rota fica desligada em vez de ficar aberta.
 */
export async function POST(request: NextRequest) {
  const segredo = process.env.TRAY_WEBHOOK_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "Webhook desligado." }, { status: 503 });
  }

  const enviado =
    request.headers.get("x-tray-secret") ??
    request.nextUrl.searchParams.get("secret");

  if (enviado !== segredo) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { sincronizarCatalogo } = await import("@/lib/tray/sincronizar");
  const r = await sincronizarCatalogo();

  return NextResponse.json(
    { ok: r.ok, produtos: r.produtos, categorias: r.categorias, erro: r.erro },
    { status: r.ok ? 200 : 500 },
  );
}
