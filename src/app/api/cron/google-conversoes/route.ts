import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { previaDoGoogle, rodarConversoesDoGoogle, validarNoGoogle } from "@/lib/google-ads/envio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Conversões do Google Ads: retira o pedido cancelado e manda a compra paga
 * (migration 0135, docs/google-compra-paga.md).
 *
 * Chamada com o segredo das rotinas (`x-cron-secret`). Três modos, pelo corpo:
 *
 * - vazio: uma rodada. Obedece ao interruptor `google:conversoes` em
 *   `site_settings`: desligado, não faz nada; ligado em validação, manda com
 *   `validate_only` e nada fica gravado no Google.
 * - `{"modo": "previa"}`: o que seria mandado agora, sem chamar o Google e sem
 *   gravar nada. Vale com tudo desligado.
 * - `{"modo": "validar", "maximo": 20, "acao_compra_paga": "123"}`: monta os
 *   corpos com os pedidos que sairiam agora e manda ao Google SEMPRE em
 *   validação, sem mexer na fila. É o teste contra a conta de verdade.
 *
 * FORA DO RELÓGIO até 01/12/2026: `disparar_conversoes_do_google()` existe e
 * não está agendada. Só a rodada deixa pulso; prévia e validação não mudam
 * nada e não podem fazer a rotina parecer viva na tela de saúde.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  const corpo = (await request.json().catch(() => ({}))) as { modo?: unknown; maximo?: unknown; acao_compra_paga?: unknown };

  try {
    if (corpo.modo === "previa") return NextResponse.json(await previaDoGoogle(supabase));
    if (corpo.modo === "validar") {
      const acao = typeof corpo.acao_compra_paga === "string" && /^\d{4,20}$/.test(corpo.acao_compra_paga) ? corpo.acao_compra_paga : null;
      return NextResponse.json(await validarNoGoogle(supabase, { maximo: Number(corpo.maximo) || undefined, acaoCompraPaga: acao }));
    }

    const resultado = await rodarConversoesDoGoogle(supabase);
    const detalhe =
      resultado.estado === "desligado"
        ? "desligado"
        : [
            resultado.validar ? "em validação" : "valendo",
            resultado.retirada ? `${resultado.retirada.aceitas} retiradas` : null,
            resultado.compraPaga ? `${resultado.compraPaga.aceitas} compras pagas` : null,
            resultado.conferidas ? `${resultado.conferidas} conferidas` : null,
            resultado.problema,
          ]
            .filter(Boolean)
            .join(", ");
    await registrarPulso(supabase, "google-conversoes", resultado.estado !== "erro", detalhe);
    return NextResponse.json(resultado);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro desconhecido.";
    if (corpo.modo !== "previa" && corpo.modo !== "validar") await registrarPulso(supabase, "google-conversoes", false, mensagem);
    return NextResponse.json({ estado: "erro", mensagem }, { status: 500 });
  }
}
