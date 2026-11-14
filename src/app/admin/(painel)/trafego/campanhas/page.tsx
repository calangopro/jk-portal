import { requireArea } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerCampanhasDaTela } from "@/lib/trafego/dados";
import { hojeEmSaoPaulo, lerPeriodo } from "@/lib/vendas/periodo";
import { TelaDeCampanhas } from "./Tela";

export const metadata = { title: "Campanhas e anúncios" };

/**
 * Campanhas, conjuntos e anúncios do Meta ou do Google Ads, com o veredito de
 * cada um contra a média da conta.
 *
 * Os números vêm de `anuncios_itens` (0061), lidos de hora em hora. São o que
 * a plataforma informa, não venda paga: a Tray não guarda a campanha do pedido.
 * A tela abre dizendo isso, com o valor que a loja recebeu ao lado.
 */
export default async function CampanhasPage({ searchParams }: { searchParams: Promise<{ periodo?: string; plataforma?: string }> }) {
  await requireArea("trafego");
  const sp = await searchParams;
  const plataforma = sp.plataforma === "google" ? "google" : "meta";
  // Trinta dias é o padrão aqui: em sete, anúncio pequeno não junta dado para ser julgado.
  const chave = lerPeriodo(sp.periodo ?? "30d");

  const [dados, leitura] = await Promise.all([
    lerCampanhasDaTela(await createClient(), plataforma, chave, hojeEmSaoPaulo()),
    createAdminClient()
      .from("sync_logs")
      .select("finished_at")
      .eq("source", `anuncios_itens_${plataforma}`)
      .in("status", ["success", "partial"])
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return <TelaDeCampanhas {...dados} chave={chave} lidaEm={(leitura.data?.finished_at as string | undefined) ?? null} />;
}
