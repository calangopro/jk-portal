import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerVendasDaTela } from "@/lib/vendas/dados";
import { hojeEmSaoPaulo, lerPeriodo } from "@/lib/vendas/periodo";
import { PainelDeVendas } from "./PainelDeVendas";

export const metadata = { title: "Vendas" };

/**
 * Vendas da loja virtual, lidas dos pedidos da Tray (`tray_pedidos`).
 *
 * É a tela que substitui o relatório pedido todo dia no WhatsApp: hoje, ontem
 * e o mês até agora em cima, e embaixo o período escolhido aberto por dia,
 * origem, pagamento, horário e produto.
 *
 * Só conta pedido PAGO. A Tray cria o pedido antes do pagamento, e quatro em
 * cada dez são cancelados depois, então somar pedido criado mostraria mais que
 * o dobro do que entrou. Só administrador, porque é faturamento da empresa (a
 * RLS da tabela barra os outros papéis mesmo que alguém chegue à rota).
 *
 * O que NÃO está aqui: o Pix recebido por fora da loja, que não passa pela
 * Tray. A tela diz isso para ninguém ler o total como sendo o da empresa.
 */
export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireAdmin();
  const chave = lerPeriodo((await searchParams).periodo);
  const hoje = hojeEmSaoPaulo();
  const dados = await lerVendasDaTela(await createClient(), chave, hoje);
  return <PainelDeVendas chave={chave} hoje={hoje} {...dados} />;
}
