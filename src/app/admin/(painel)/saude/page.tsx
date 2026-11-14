import { requireAdmin } from "@/lib/auth/session";
import { lerSaude } from "@/lib/painel/saude-dados";
import { createClient } from "@/lib/supabase/server";
import { TelaDaSaude } from "./Tela";

export const metadata = { title: "Saúde das ligações" };

/**
 * Saúde das ligações: as rotinas agendadas e os destinos dos contatos, com o
 * estado de agora. Só administrador, dono e GM (a função do banco confere de
 * novo). O desenho mora em `Tela.tsx`.
 */
export default async function SaudePage() {
  await requireAdmin();
  return <TelaDaSaude ligacoes={await lerSaude(await createClient())} />;
}
