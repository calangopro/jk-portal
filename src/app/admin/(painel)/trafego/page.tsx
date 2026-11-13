import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerTrafegoDaTela } from "@/lib/trafego/dados";
import { hojeEmSaoPaulo, lerPeriodo } from "@/lib/vendas/periodo";
import { lancarGasto } from "./actions";
import { TelaDeTrafego } from "./Tela";

export const metadata = { title: "Tráfego" };

/**
 * Tráfego pago: quanto foi gasto em anúncio e quanto de venda PAGA voltou.
 *
 * O gasto vem de `anuncios_gasto` (0059), lançado aqui mesmo enquanto a leitura
 * automática das plataformas não existe. A venda vem dos pedidos da Tray, pela
 * etiqueta de origem. Quem tem a área de tráfego também tem a de vendas, e é
 * por isso que as duas leituras respondem para a mesma pessoa.
 */
export default async function TrafegoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireArea("trafego");
  const chave = lerPeriodo((await searchParams).periodo);
  const hoje = hojeEmSaoPaulo();
  const dados = await lerTrafegoDaTela(await createClient(), chave, hoje);
  return <TelaDeTrafego chave={chave} hoje={hoje} acao={lancarGasto} {...dados} />;
}
