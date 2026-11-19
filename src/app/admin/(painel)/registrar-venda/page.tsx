import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerLojasDaConsulta, lerProdutosDaConsulta } from "@/lib/consulta/dados";
import { lerEtapasDasVendas, lerLancadasAgora, lerResumoPorFora } from "@/lib/vendas/por-fora";
import { hojeEmSaoPaulo, primeiroDoMes, somarDias } from "@/lib/vendas/periodo";
import { estornarVenda } from "./actions";
import { TelaDeRegistrarVenda } from "./Tela";
import type { VendaParaCompletar } from "./CompletarProducao";
import type { ProducaoDoFormulario } from "@/lib/vendas/producao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export default async function RegistrarVendaPage({ searchParams }: { searchParams: Promise<{ producao?: string }> }) {
  const profile = await requireArea("lancar_venda");
  // `?producao=<venda>`: completar a produção da venda que veio da Kommo (cartão 51). A função confere quem pode.
  const { producao: vendaParaCompletar } = await searchParams;
  const veTodas = profile.areas.includes("vendas");
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();

  const [mes, lancadas, vendedores, produtos, lojas] = await Promise.all([
    lerResumoPorFora(db, primeiroDoMes(hoje), hoje),
    // O que foi lançado hoje e ontem, pelo dia em que foi lançado: é o que o vendedor ainda pode estornar.
    lerLancadasAgora(db, somarDias(hoje, -1)),
    veTodas
      ? db.from("profiles").select("id, full_name, role").eq("is_active", true).in("role", ["vendas", "gerente"]).order("full_name")
      : null,
    // O catálogo e as lojas são os mesmos da Consulta: é deles que sai a peça e a loja de retirada da venda que vai para a fábrica.
    lerProdutosDaConsulta(db, hoje),
    lerLojasDaConsulta(db),
  ]);
  const naFabrica = await lerEtapasDasVendas(db, (mes?.ultimas ?? []).map((v) => v.id));
  let completar: VendaParaCompletar | null = null;
  if (vendaParaCompletar && UUID.test(vendaParaCompletar)) {
    const { data, error } = await db.rpc("kommo_fabrica_formulario", { p_venda: vendaParaCompletar });
    if (error) console.error("[vendas] kommo_fabrica_formulario:", error.message);
    const d = (data ?? null) as { venda_id?: string; negocio_id?: number; cliente?: string | null; dia?: string | null; motivos?: unknown; formulario?: ProducaoDoFormulario | null; ja_na_fabrica?: boolean } | null;
    if (d?.venda_id && !d.ja_na_fabrica) {
      completar = {
        vendaId: d.venda_id,
        negocioId: Number(d.negocio_id),
        cliente: d.cliente ?? null,
        dia: d.dia ?? null,
        motivos: Array.isArray(d.motivos) ? d.motivos.map(String) : [],
        formulario: d.formulario && Array.isArray(d.formulario.pecas) && d.formulario.pecas.length ? d.formulario : null,
      };
    }
  }

  return (
    <TelaDeRegistrarVenda
      mes={mes}
      lancadas={lancadas}
      veTodas={veTodas}
      hoje={hoje}
      estornar={estornarVenda}
      naFabrica={naFabrica}
      completar={completar}
      completarSumiu={Boolean(vendaParaCompletar) && !completar}
      // Só o que o formulário usa: mandar o produto inteiro para o navegador seria peso à toa.
      produtos={(produtos ?? []).map((x) => ({ codigo: x.codigo, nome: x.nome, miniatura: x.miniatura }))}
      lojas={lojas.map((l) => l.shopping ?? l.nome)}
      vendedores={vendedores?.data
        ?.filter((v) => v.id !== profile.id)
        .map((v) => ({ id: v.id as string, nome: (v.full_name as string | null) ?? "Sem nome" }))}
    />
  );
}
