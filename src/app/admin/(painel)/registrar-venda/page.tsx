import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerResumoPorFora } from "@/lib/vendas/por-fora";
import { hojeEmSaoPaulo, primeiroDoMes } from "@/lib/vendas/periodo";
import { estornarVenda } from "./actions";
import { TelaDeRegistrarVenda } from "./Tela";

export const metadata = { title: "Registrar venda" };

/**
 * A tela do vendedor: registrar o que fechou fora da loja e ver as próprias
 * vendas do mês.
 *
 * Existe porque perto de um quarto do faturamento do e-commerce era Pix direto
 * e só ficava numa planilha. O vendedor vê só o que é dele (a função do banco
 * roda com os direitos de quem chama); quem tem a área de vendas vê tudo e pode
 * lançar em nome de outra pessoa, para a planilha antiga poder entrar.
 */
export default async function RegistrarVendaPage() {
  const profile = await requireArea("lancar_venda");
  const veTodas = profile.areas.includes("vendas");
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();

  const [mes, vendedores] = await Promise.all([
    lerResumoPorFora(db, primeiroDoMes(hoje), hoje),
    veTodas
      ? db.from("profiles").select("id, full_name, role").eq("is_active", true).in("role", ["vendas", "gerente"]).order("full_name")
      : null,
  ]);

  return (
    <TelaDeRegistrarVenda
      mes={mes}
      veTodas={veTodas}
      hoje={hoje}
      estornar={estornarVenda}
      vendedores={vendedores?.data
        ?.filter((v) => v.id !== profile.id)
        .map((v) => ({ id: v.id as string, nome: (v.full_name as string | null) ?? "Sem nome" }))}
    />
  );
}
