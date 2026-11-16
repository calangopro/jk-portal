import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
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
 * NO RELÓGIO DESDE 16/11/2026, de dez em dez minutos (migration 0101). Entrou
 * depois de a Tray homologar o aplicativo e de a conferência mostrar que as
 * duas portas escrevem igual (`docs/tray-api-de-pedidos.md`). Só a rodada que
 * grava deixa pulso: conferir não muda nada, e não pode fazer uma rotina
 * parada parecer viva na tela de saúde.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  const corpo = (await request.json().catch(() => ({}))) as { modo?: unknown; dias?: unknown; maximo?: unknown };
  const modo = corpo.modo === "conferir" ? "conferir" : "gravar";
  const resultado = await sincronizarPedidosDaTray(supabase, {
    loja: "jk",
    modo,
    dias: Number(corpo.dias) || undefined,
    maximo: Number(corpo.maximo) || undefined,
  });
  if (modo === "gravar") {
    const detalhe =
      resultado.estado === "ok"
        ? `${resultado.lidos} lidos, ${resultado.novos} novos, ${resultado.mudaram} mudaram de status${resultado.restam ? `, ${resultado.restam} para a próxima` : ""}`
        : resultado.mensagem;
    await registrarPulso(supabase, "pedidos-api", resultado.estado === "ok", detalhe);
  }
  return NextResponse.json(resultado, { status: resultado.estado === "erro" ? 502 : 200 });
}
