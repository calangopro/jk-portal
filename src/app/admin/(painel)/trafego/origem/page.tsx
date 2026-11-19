import { requireArea } from "@/lib/auth/session";
import { lerChegadasPelaBioDoPeriodo, lerPedidosComOrigemDoPeriodo } from "@/lib/origem/dados";
import { createClient } from "@/lib/supabase/server";
import { lerNegociosPorOrigem } from "@/lib/kommo/origem";
import { hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeOrigem } from "./Tela";

export const metadata = { title: "Origem dos pedidos" };

/**
 * De qual anúncio veio cada pedido, com as UTMs como chegaram.
 *
 * A chegada é anotada pela própria loja (o coletor, 0064) e ligada ao pedido
 * pela sessão da Tray. A 0112 liga a UTM à campanha, ao conjunto e ao anúncio:
 * pelo número quando ele vem, e pelo NOME dentro da campanha, que é como os
 * anúncios do Meta mandam o conjunto e o anúncio.
 */
export default async function OrigemPage({ searchParams }: { searchParams: Promise<{ periodo?: string; busca?: string; aba?: string; pagos?: string }> }) {
  await requireArea("trafego");
  const sp = await searchParams;
  // Trinta dias é o padrão: a chegada só existe desde 13/11/2026, e em sete dias há pouco pedido para ler.
  const chave = lerPeriodo(sp.periodo ?? "30d");
  const { de, ate } = intervaloDoPeriodo(chave, hojeEmSaoPaulo());
  const db = await createClient();
  const [pedidos, bio, kommo] = await Promise.all([
    lerPedidosComOrigemDoPeriodo(db, de, ate),
    lerChegadasPelaBioDoPeriodo(db, de, ate),
    // Os negócios da Kommo por origem (0170): anúncio pelo número, UTM, código, sem origem.
    db.rpc("kommo_negocios_por_origem", { p_de: de, p_ate: ate }).then(({ data, error }) => {
      if (error) console.error("[origem] kommo_negocios_por_origem:", error.message);
      return error ? null : lerNegociosPorOrigem(data);
    }),
  ]);
  // `busca`, `aba` e `pagos` chegam do link de um item na tabela de campanhas: a lista já abre nos pedidos dele.
  return (
    <TelaDeOrigem
      pedidos={pedidos}
      bio={bio}
      kommo={kommo}
      de={de}
      ate={ate}
      chave={chave}
      busca={(sp.busca ?? "").slice(0, 120)}
      aba={sp.aba === "pedido" || sp.aba === "conjunto" || sp.aba === "campanha" || sp.aba === "utm" ? sp.aba : "anuncio"}
      soPagos={sp.pagos !== "0"}
    />
  );
}
