import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/auth/acessos";
import { getSessionProfile } from "@/lib/auth/session";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { DIAS_DO_AVISO, ENDERECO_DAS_OPORTUNIDADES, separarParaOAviso } from "@/lib/clientes/oportunidades";
import { ENDERECO_DAS_SUGESTOES } from "@/lib/sugestoes/sugestoes";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

export const dynamic = "force-dynamic";

/**
 * As CONTAGENS do menu: números que aparecem no item, mas não são aviso. São
 * duas: as oportunidades de venda abertas, para quem vende (o que vence em até
 * sete dias mais o que passou da data e ninguém marcou, a mesma conta do cartão
 * do Início), e as sugestões de melhoria novas, para a diretoria.
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
  const vende = perfil.areas.includes("lancar_venda");
  const diretoria = ehAdmin(perfil.role);
  if (!vende && !diretoria) return NextResponse.json({ contagens: {} }, { headers: semGuardar });

  const db = await createClient();
  const contagens: Record<string, number> = {};
  if (vende) {
    const dados = await lerOportunidades(db, hojeEmSaoPaulo(), DIAS_DO_AVISO, await lerLojasFisicas());
    // Leitura que falhou não vira zero: a moldura fica com o último número que tinha.
    if (!dados) return NextResponse.json({ contagens: null }, { headers: semGuardar });
    contagens[ENDERECO_DAS_OPORTUNIDADES] = separarParaOAviso(dados.lista).total;
  }
  if (diretoria) {
    // As sugestões de melhoria que ninguém da diretoria olhou ainda (`sugestoes_novas`, 0140).
    const { data, error } = await db.rpc("sugestoes_novas");
    if (error) return NextResponse.json({ contagens: null }, { headers: semGuardar });
    contagens[ENDERECO_DAS_SUGESTOES] = Number(data) || 0;
  }
  return NextResponse.json({ contagens }, { headers: { "Cache-Control": "private, max-age=300" } });
}
