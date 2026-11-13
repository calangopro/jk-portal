import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerDespesas } from "@/lib/custos/dados";
import { lerResumoDeVendas } from "@/lib/vendas/dados";
import { hojeEmSaoPaulo, primeiroDoMes } from "@/lib/vendas/periodo";
import { ligarDespesa, salvarDespesa } from "./actions";
import { PainelDeCustos, type MesDaLoja } from "./PainelDeCustos";

export const metadata = { title: "Custos da empresa" };

/**
 * Custos da empresa: o que a loja gasta para funcionar, com o comprovante.
 *
 * Substitui a lista de despesas que a dona mandava de cabeça. Cada custo diz se
 * é valor exato ou estimativa e de onde o número veio, e o comprovante fica num
 * bucket privado, aberto por link que vence em uma hora.
 *
 * Só administrador, na tela, na RLS das tabelas e na policy do bucket. Os
 * valores nunca entram no repositório: quem lança é gente, pelo painel.
 *
 * Ao lado do total a tela põe o faturamento pago da loja no mês, lido dos
 * pedidos da Tray, e diz o que ainda falta na conta (custo das peças e Pix por
 * fora), para o número não ser lido como resultado.
 */
export default async function CustosPage() {
  await requireAdmin();
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const [despesas, vendas] = await Promise.all([
    lerDespesas(db),
    lerResumoDeVendas(db, primeiroDoMes(hoje), hoje),
  ]);

  const mes: MesDaLoja | null = vendas
    ? {
        hoje,
        diasNoMes: new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate(),
        pedidosPagos: vendas.totais.pagos,
        faturamento: Number(vendas.totais.valor_pago),
      }
    : null;

  return <PainelDeCustos despesas={despesas} mes={mes} acoes={{ salvar: salvarDespesa, ligar: ligarDespesa }} />;
}
