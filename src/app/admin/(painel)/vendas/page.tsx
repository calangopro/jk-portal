import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerVendasDaTela } from "@/lib/vendas/dados";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { sobraDoPeriodo } from "@/lib/vendas/sobra";
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
  const perfil = await requireArea("vendas");
  const chave = lerPeriodo((await searchParams).periodo);
  const hoje = hojeEmSaoPaulo();
  const intervalo = intervaloDoPeriodo(chave, hoje);
  // Para onde vai cada venda é custo e taxa da empresa (cartão 80): só o administrador, e só ele dispara a leitura.
  const [dados, sobra] = await Promise.all([
    lerVendasDaTela(await createClient(), chave, hoje),
    ehAdmin(perfil.role) ? sobraDoPeriodo(createAdminClient(), intervalo.de, intervalo.ate).catch((e) => { console.error("[vendas] sobra:", e instanceof Error ? e.message : e); return null; }) : Promise.resolve(null),
  ]);
  return <PainelDeVendas chave={chave} hoje={hoje} {...dados} sobra={sobra} />;
}
