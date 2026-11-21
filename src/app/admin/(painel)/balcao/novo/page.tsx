import { redirect } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerMinhaLoja, lerVendedores } from "@/lib/balcao/dados";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { LOJAS_DO_BALCAO, lojaDaTela, produtosDoFormulario } from "../comum";
import { FormularioDoBalcao } from "../Formulario";

export const metadata = { title: "Pedido novo" };

/** O pedido novo do balcão (cartão 71). O formulário mora em `Formulario.tsx`. */
export default async function PedidoNovoPage({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const quem = await requireArea("balcao");
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const minhaLoja = await lerMinhaLoja(db);
  if (quem.role === "loja" && !minhaLoja) redirect("/admin/balcao");
  const loja = lojaDaTela(minhaLoja, (await searchParams).loja);
  // Sem loja fixa (gerência, diretoria), todos os vendedores: o formulário filtra pela loja escolhida.
  const [vendedores, produtos] = await Promise.all([lerVendedores(db, minhaLoja ?? null), produtosDoFormulario(db, hoje)]);
  return (
    <FormularioDoBalcao
      key={loja ?? "sem-loja"}
      minhaLoja={minhaLoja ?? loja}
      lojas={LOJAS_DO_BALCAO}
      vendedores={vendedores}
      produtos={produtos}
      hoje={hoje}
    />
  );
}
