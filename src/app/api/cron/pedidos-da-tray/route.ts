import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarPedidosDaTray } from "@/lib/vendas/pedidos-da-api";

/**
 * Lê pela API da Tray os pedidos que mudaram desde a última rodada.
 *
 * Chamada com o segredo das rotinas (`x-cron-secret`). Com corpo vazio, grava
 * os pedidos da loja da JK. Com `{"modo": "conferir", "dias": 3}`, só compara o
 * que a API devolve com o que as exportações gravaram e responde as diferenças,
 * sem gravar. Enquanto o aplicativo não for autorizado na loja da JK, responde
 * `nao_autorizada` e não faz mais nada.
 *
 * AINDA NÃO ESTÁ NO RELÓGIO, de propósito. A rotina entra no `pg_cron` depois
 * de a Tray homologar o aplicativo e de uma rodada de `conferir` mostrar que o
 * status vem escrito igual ao das exportações. O passo a passo está em
 * `docs/tray-api-de-pedidos.md`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  const corpo = (await request.json().catch(() => ({}))) as { modo?: unknown; dias?: unknown; maximo?: unknown };
  const resultado = await sincronizarPedidosDaTray(supabase, {
    loja: "jk",
    modo: corpo.modo === "conferir" ? "conferir" : "gravar",
    dias: Number(corpo.dias) || undefined,
    maximo: Number(corpo.maximo) || undefined,
  });
  return NextResponse.json(resultado, { status: resultado.estado === "erro" ? 502 : 200 });
}
