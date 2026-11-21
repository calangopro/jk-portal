import { redirect } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerMinhaLoja, lerVendedores } from "@/lib/balcao/dados";
import { lojaDaTela } from "../comum";
import { LeadDoBalcaoNaTela } from "./Lead";

export const metadata = { title: "Lead do balcão" };

/** O lead do balcão (cartão 72): quem visitou e não comprou. O desenho mora em `Lead.tsx`. */
export default async function LeadDoBalcaoPage({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const quem = await requireArea("balcao");
  const db = await createClient();
  const minhaLoja = await lerMinhaLoja(db);
  const loja = lojaDaTela(minhaLoja, (await searchParams).loja);
  if (!loja || (quem.role === "loja" && !minhaLoja)) redirect("/admin/balcao");
  // Só para a frase "indo para a Kommo": a automação ligada é um sim ou não, lido com a chave de serviço.
  const [vendedores, auto] = await Promise.all([
    lerVendedores(db, loja),
    createAdminClient().from("kommo_automacoes").select("ativa").eq("id", "balcao_lead").maybeSingle(),
  ]);
  return <LeadDoBalcaoNaTela loja={loja} vendedores={vendedores} kommoLigada={Boolean(auto.data?.ativa)} />;
}
