import { requireArea } from "@/lib/auth/session";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { JANELAS, JANELA_PADRAO } from "@/lib/clientes/oportunidades";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { marcar } from "../clientes/actions";
import { TelaDeOportunidades } from "./Tela";

export const metadata = { title: "Oportunidades" };

/**
 * Oportunidades de venda: quem vale chamar nos próximos dias.
 *
 * A lista é CONTA, não tabela: o banco separa quem pode ter alguma coisa na
 * janela (`base_de_oportunidades`, 0069) e a decisão de cada caso é de
 * `lib/clientes/oportunidades.ts`, que tem teste. Quem tem a área de lançar
 * venda entra. O portal não manda mensagem a cliente: a tela só traz o link
 * que abre a conversa. O desenho mora em `Tela.tsx`.
 */
export default async function OportunidadesPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireArea("lancar_venda");
  const pedido = Number((await searchParams).dias);
  const dias = JANELAS.includes(pedido) ? pedido : JANELA_PADRAO;
  const [db, lojas] = await Promise.all([createClient(), lerLojasFisicas()]);
  const dados = await lerOportunidades(db, hojeEmSaoPaulo(), dias, lojas);
  return <TelaDeOportunidades dados={dados} dias={dias} marcar={marcar} />;
}
