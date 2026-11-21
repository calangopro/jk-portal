import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerListaDoBalcao, lerMinhaLoja, lerVendedores } from "@/lib/balcao/dados";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { LOJAS_DO_BALCAO, lojaDaTela } from "./comum";
import { TelaDoBalcao } from "./Tela";

export const metadata = { title: "Balcão da loja" };

/**
 * O balcão da loja física (cartão 71): os pedidos da loja, do que precisa de
 * ação para o que já foi. A conta da loja vê só a dela; gerência e diretoria
 * escolhem a loja. A lista traz os abertos inteiros e os fechados dos últimos
 * 30 dias; a busca por número, cliente, telefone ou peça vai ao banco inteiro.
 * O desenho mora em `Tela.tsx`.
 */
export default async function BalcaoPage({ searchParams }: { searchParams: Promise<{ loja?: string; busca?: string }> }) {
  const quem = await requireArea("balcao");
  const db = await createClient();
  const minhaLoja = await lerMinhaLoja(db);
  const sp = await searchParams;
  const loja = lojaDaTela(minhaLoja, sp.loja);
  const busca = typeof sp.busca === "string" ? sp.busca.slice(0, 60).trim() : "";
  const semLoja = quem.role === "loja" && !minhaLoja;
  const [lista, vendedores] = semLoja ? [[], []] : await Promise.all([lerListaDoBalcao(db, loja, 30, busca || null), lerVendedores(db, loja)]);
  return (
    <TelaDoBalcao
      lista={lista}
      vendedores={vendedores}
      loja={loja}
      minhaLoja={minhaLoja}
      lojas={LOJAS_DO_BALCAO}
      busca={busca}
      semLoja={semLoja}
      hoje={hojeEmSaoPaulo()}
    />
  );
}
