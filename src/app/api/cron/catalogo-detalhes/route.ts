import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { lerDetalhesDaLoja } from "@/lib/catalogo/detalhes";

/**
 * Lê pela API da Tray os detalhes que o arquivo do catálogo precisa e a busca
 * pública não traz: as fotos, a descrição completa, a referência, o GTIN, o
 * peso e as medidas (migration 0130).
 *
 * Quem chama é o `pg_cron` (migration 0131), de dez em dez minutos, com o
 * segredo de `integration_tokens`. Cada rodada lê no máximo 40 produtos; o
 * corpo aceita `{"maximo": N}` (até 200) para encher a tabela de uma vez.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();

  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => ({}))) as { maximo?: unknown };
  const maximo = typeof corpo.maximo === "number" ? corpo.maximo : undefined;

  const r = await lerDetalhesDaLoja({ maximo });
  await registrarPulso(
    supabase,
    "catalogo-detalhes",
    r.ok,
    r.ok ? `${r.lidos} lidos, ${r.pendentes} na fila${r.aviso ? `. ${r.aviso}` : ""}` : (r.erro ?? "falhou"),
  );

  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
