import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDasAutomacoes, type DadosDasAutomacoes } from "./Tela";
import { desligarAutomacao, ligarAutomacao, salvarAutomacao, salvarLigacaoDoBalcao } from "./actions";
import type { ConfigDoBalcao } from "./BalcaoNaKommo";
import { lerChaves } from "@/lib/leads/chaves";
import { clienteDaKommo } from "@/lib/kommo/cliente";
import { lerDefinicoes } from "@/lib/kommo/automacoes-regra";
import { LOJAS_DO_BALCAO } from "../../balcao/comum";

export const metadata = { title: "Automações da Kommo" };

/**
 * As automações que escrevem na Kommo (cartão 49, 0173): recuperação, pós-venda,
 * SAC e tarefas. Todas nascem desligadas; só a diretoria configura e liga, e a
 * função do banco confere de novo. O desenho mora em `Tela.tsx`.
 */
export default async function AutomacoesDaKommoPage() {
  await requireAdmin();
  const db = await createClient();
  const [{ data }, { data: balcao }, opcoesDeLoja] = await Promise.all([db.rpc("kommo_automacoes_lista"), db.rpc("balcao_kommo_config"), opcoesDoCampoLoja(db)]);
  return (
    <TelaDasAutomacoes
      dados={(data ?? null) as DadosDasAutomacoes | null}
      aoSalvar={salvarAutomacao}
      aoLigar={ligarAutomacao}
      aoDesligar={desligarAutomacao}
      balcao={{ config: (balcao ?? null) as ConfigDoBalcao | null, lojas: LOJAS_DO_BALCAO, opcoesDeLoja, aoSalvar: salvarLigacaoDoBalcao }}
    />
  );
}

/** As opções do campo "Loja" dos negócios, lidas na Kommo (só leitura). Sem chave ou com erro: lista vazia, e a tela deixa o campo vazio. */
async function opcoesDoCampoLoja(db: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  try {
    const chave = (await lerChaves(db)).kommo;
    if (!chave) return [];
    const defs = lerDefinicoes(await clienteDaKommo(chave)<unknown>("/api/v4/leads/custom_fields", { busca: new URLSearchParams({ limit: "250" }) }));
    return defs.find((d) => d.nome.trim().toLowerCase() === "loja")?.opcoes.map((o) => o.valor) ?? [];
  } catch (e) {
    console.error("[kommo/automacoes] campo Loja:", e instanceof Error ? e.message : e);
    return [];
  }
}
