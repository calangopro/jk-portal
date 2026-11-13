import { requireArea } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerOrigemDosPedidos, lerSaudeDoColetor } from "@/lib/origem/dados";
import { lerTrafegoDaTela } from "@/lib/trafego/dados";
import { lerConexoes } from "@/lib/trafego/plataformas";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
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
  // O estado das ligações sai do registro de leituras, que só o cliente de
  // serviço enxerga. Quem chega aqui já passou pela conferência da área.
  const db = await createClient();
  const { de, ate } = intervaloDoPeriodo(chave, hoje);
  const [dados, conexoes, origem, saude] = await Promise.all([
    lerTrafegoDaTela(db, chave, hoje),
    lerConexoes(createAdminClient()),
    lerOrigemDosPedidos(db, de, ate),
    lerSaudeDoColetor(db),
  ]);
  return <TelaDeTrafego chave={chave} hoje={hoje} acao={lancarGasto} conexoes={conexoes} origem={origem} saude={saude} {...dados} />;
}
