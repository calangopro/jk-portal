import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerFilaDeRecuperacao, lerJanela } from "@/lib/vendas/recuperacao";
import { marcarCaso } from "./actions";
import { PainelDeRecuperacao } from "./PainelDeRecuperacao";

export const metadata = { title: "Recuperação" };

/**
 * Fila de recuperação: quem criou pedido na loja, não pagou e não voltou.
 *
 * Nasceu de uma conta feita em 12/11/2026: em trinta dias, 73 clientes
 * travaram no pagamento e não voltaram, somando mais que tudo o que a loja
 * vendeu no período, com ticket três vezes maior. Ninguém chamava essas
 * pessoas, porque o funil de recuperação da Kommo só recebe carrinho.
 *
 * A fila é calculada no banco (`fila_de_recuperacao`, 0054) a cada visita, em
 * cima dos pedidos trazidos da Tray. O portal não manda mensagem para ninguém:
 * o atendimento continua na Kommo, e aqui fica o que chamar primeiro e o que
 * aconteceu com cada caso. Só administrador.
 */
export default async function RecuperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const profile = await requireArea("recuperacao");
  const janela = lerJanela((await searchParams).dias);
  const fila = await lerFilaDeRecuperacao(await createClient(), janela);
  return <PainelDeRecuperacao fila={fila} janela={janela} acao={marcarCaso} comFicha={profile.areas.includes("lancar_venda")} />;
}
