import { Suspense } from "react";
import { requireArea } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/states";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerOrigemDosPedidos, lerSaudeDoColetor } from "@/lib/origem/dados";
import { lerTrafegoDaTela } from "@/lib/trafego/dados";
import { lerConexoes } from "@/lib/trafego/plataformas";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { lancarGasto } from "./actions";
import { OrigemAnotada } from "./OrigemAnotada";
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
  // A origem anotada (e a saúde do coletor, a leitura mais lenta da tela) chega
  // por último sem segurar o resto: começa já e entra no lugar dela quando
  // voltar (cartão 76).
  const origem = lerOrigemDosPedidos(db, de, ate);
  const saude = lerSaudeDoColetor(db);
  const [dados, conexoes] = await Promise.all([lerTrafegoDaTela(db, chave, hoje), lerConexoes(createAdminClient())]);
  const blocoDeOrigem = (
    <Suspense
      fallback={
        <div className="mt-6" role="status" aria-busy="true">
          <span className="sr-only">Carregando a origem anotada</span>
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <BlocoDeOrigem origem={origem} saude={saude} />
    </Suspense>
  );
  return <TelaDeTrafego chave={chave} hoje={hoje} acao={lancarGasto} conexoes={conexoes} blocoDeOrigem={blocoDeOrigem} {...dados} />;
}

async function BlocoDeOrigem({ origem, saude }: { origem: ReturnType<typeof lerOrigemDosPedidos>; saude: ReturnType<typeof lerSaudeDoColetor> }) {
  const [o, sa] = await Promise.all([origem, saude]);
  return <OrigemAnotada origem={o} saude={sa} />;
}
