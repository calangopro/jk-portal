import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDasAutomacoes, type DadosDasAutomacoes } from "./Tela";
import { desligarAutomacao, ligarAutomacao, salvarAutomacao } from "./actions";

export const metadata = { title: "Automações da Kommo" };

/**
 * As automações que escrevem na Kommo (cartão 49, 0173): recuperação, pós-venda,
 * SAC e tarefas. Todas nascem desligadas; só a diretoria configura e liga, e a
 * função do banco confere de novo. O desenho mora em `Tela.tsx`.
 */
export default async function AutomacoesDaKommoPage() {
  await requireAdmin();
  const { data } = await (await createClient()).rpc("kommo_automacoes_lista");
  return (
    <TelaDasAutomacoes
      dados={(data ?? null) as DadosDasAutomacoes | null}
      aoSalvar={salvarAutomacao}
      aoLigar={ligarAutomacao}
      aoDesligar={desligarAutomacao}
    />
  );
}
