import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDasFases, type FunisComFases } from "./Tela";
import { confirmarPalpites, salvarFaseDaEtapa } from "./actions";

export const metadata = { title: "Fases da Kommo" };

/**
 * Cada etapa dos funis da Kommo ligada a uma fase padrão (0162, cartão 46).
 * A leitura da Kommo preenche a etapa nova com o palpite pelo nome; aqui a
 * diretoria confirma ou corrige. Só diretoria; a função do banco confere de
 * novo. O desenho mora em `Tela.tsx`.
 */
export default async function FasesDaKommoPage() {
  await requireAdmin();
  const { data } = await (await createClient()).rpc("kommo_fases_lista");
  return <TelaDasFases funis={(data ?? null) as FunisComFases | null} aoSalvar={salvarFaseDaEtapa} aoConfirmar={confirmarPalpites} />;
}
