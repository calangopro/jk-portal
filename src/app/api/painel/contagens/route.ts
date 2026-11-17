import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { DIAS_DO_AVISO, ENDERECO_DAS_OPORTUNIDADES, separarParaOAviso } from "@/lib/clientes/oportunidades";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

export const dynamic = "force-dynamic";

/**
 * As CONTAGENS do menu: números que aparecem no item, mas não são aviso. Hoje,
 * as oportunidades de venda abertas (o que vence em até sete dias mais o que
 * passou da data e ninguém marcou), a mesma conta do cartão do Início.
 *
 * É um endereço à parte de `/api/painel/avisos`, de propósito. Aquele é
 * perguntado a cada minuto e precisa ser leve. Esta conta pede ao banco a base
 * inteira das oportunidades (dezenas de KB) e decide cada uma no servidor: por
 * isso a moldura pergunta só ao abrir e de dez em dez minutos, e a resposta
 * fica guardada cinco minutos no navegador da própria pessoa (`private`).
 *
 * Fica fora de `/admin`, como o outro, e confere a sessão por conta própria.
 * Quem decide o acesso de novo é a função do banco (`lancar_venda`). Devolve
 * só o número, nunca nome de cliente.
 */
export async function GET() {
  const semGuardar = { "Cache-Control": "no-store" };
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) return NextResponse.json({ erro: "sem sessão" }, { status: 401, headers: semGuardar });
  if (!perfil.areas.includes("lancar_venda")) return NextResponse.json({ contagens: {} }, { headers: semGuardar });

  const [db, lojas] = await Promise.all([createClient(), lerLojasFisicas()]);
  const dados = await lerOportunidades(db, hojeEmSaoPaulo(), DIAS_DO_AVISO, lojas);
  // Leitura que falhou não vira zero: a moldura fica com o último número que tinha.
  if (!dados) return NextResponse.json({ contagens: null }, { headers: semGuardar });
  return NextResponse.json(
    { contagens: { [ENDERECO_DAS_OPORTUNIDADES]: separarParaOAviso(dados.lista).total } },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
