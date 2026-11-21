import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerPedidoDoBalcao, lerVendedores } from "@/lib/balcao/dados";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { PRODUCAO_VAZIA } from "@/lib/vendas/producao";
import type { RascunhoDoBalcao } from "@/lib/balcao/regras";
import { LOJAS_DO_BALCAO, produtosDoFormulario } from "../../comum";
import { FormularioDoBalcao } from "../../Formulario";

export const metadata = { title: "Editar pedido" };

/**
 * Editar um pedido do balcão: reabre o formulário como a loja deixou. Na
 * fábrica, peças e entrega ficam travadas (vira pedido de alteração).
 */
export default async function EditarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("balcao");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const p = await lerPedidoDoBalcao(db, id);
  if (!p || p.cancelado_em) notFound();
  const [vendedores, produtos] = await Promise.all([lerVendedores(db, p.loja), produtosDoFormulario(db, hoje)]);
  const f = p.formulario;
  // O que está no pedido salvo manda sobre o formulário guardado (o banco pode ter ajustado).
  const inicial: RascunhoDoBalcao = {
    id: p.id,
    loja: p.loja,
    vendedor: p.vendedor,
    cliente_nome: p.cliente_nome,
    cliente_telefone: p.cliente_telefone,
    cliente_email: p.cliente_email ?? "",
    motivo: p.motivo ?? "",
    data_especial: p.data_especial ?? "",
    producao: f?.producao ?? { ...PRODUCAO_VAZIA, loja: p.loja },
    prazo: p.prazo ?? "",
    total: String(p.total).replace(".", ","),
    observacao: p.observacao ?? "",
    numero_papel: p.numero_papel ?? "",
    fotos: p.fotos ?? [],
    transcricao: p.transcricao ?? "",
    pagamento: null,
    anexos: [],
    mexido_em: p.atualizado_em,
  };
  return (
    <FormularioDoBalcao
      inicial={inicial}
      editando={{ id: p.id, numero: p.numero, naFabrica: Boolean(p.fabrica_em) }}
      minhaLoja={p.loja}
      lojas={LOJAS_DO_BALCAO}
      vendedores={vendedores}
      produtos={produtos}
      hoje={hoje}
    />
  );
}
