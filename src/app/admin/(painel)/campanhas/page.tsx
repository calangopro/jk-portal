import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avaliarItens, listarCampanhas, lerCampanha } from "@/lib/campanhas/dados";
import { TelaDeCampanhas } from "./Tela";

export const metadata = { title: "Campanhas" };

/**
 * Campanhas de desconto. A equipe monta, o administrador aprova, e a planilha
 * de promoção sai daqui para a Tray. O alerta de margem aparece para todos
 * (quantos itens passam do limite), mas custo e margem em número, só para o
 * administrador, dentro da campanha.
 */
export default async function CampanhasPage() {
  await requireArea("campanhas");
  const db = await createClient();
  const campanhas = await listarCampanhas(db);

  // Alerta de margem das campanhas que ainda vão para a loja.
  const abertas = campanhas.filter((c) => c.status !== "encerrada" && c.itens > 0);
  const alertas = new Map<string, number>();
  const servico = createAdminClient();
  await Promise.all(
    abertas.map(async (c) => {
      const lida = await lerCampanha(db, c.id);
      if (!lida) return;
      const { porProduto } = await avaliarItens(servico, lida.itens, false);
      alertas.set(c.id, Object.values(porProduto).filter((a) => a.situacao !== "ok").length);
    }),
  );

  return <TelaDeCampanhas campanhas={campanhas} alertas={alertas} />;
}
