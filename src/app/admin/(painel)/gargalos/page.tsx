import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerGargalosDaTela } from "@/lib/painel/gargalos-dados";
import { hojeEmSaoPaulo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeGargalos } from "./Tela";

export const metadata = { title: "Gargalos" };

/**
 * Gargalos: o mapa de onde o dinheiro vaza, cruzando os pedidos da Tray, o
 * funil da loja no GA4 e as plataformas de anúncio.
 *
 * Quem tem a área de vendas vê. A parte de anúncio depende da área de tráfego,
 * e o banco decide: sem ela, as leituras de gasto e de campanha vêm vazias e a
 * tela mostra só o que sobrou.
 */
export default async function GargalosPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireArea("vendas");
  // Trinta dias é o padrão: em sete, pagamento e anúncio não juntam caso para a regra valer.
  const chave = lerPeriodo((await searchParams).periodo ?? "30d");
  const dados = await lerGargalosDaTela(await createClient(), chave, hojeEmSaoPaulo());
  return <TelaDeGargalos {...dados} chave={chave} />;
}
