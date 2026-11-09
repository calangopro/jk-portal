import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avaliarItens, lerCampanha } from "@/lib/campanhas/dados";
import { listarCatalogo } from "@/lib/catalogo/fotos";
import { EditorDeCampanha, type ProdutoParaAdicionar } from "./EditorDeCampanha";

export const metadata = { title: "Campanha" };

/**
 * Uma campanha. A avaliação de margem usa o cliente de serviço, porque custo
 * é só de administrador no banco, e devolve o número só para administrador:
 * para o editor, cada item diz apenas se passa do limite.
 */
export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await requireStaff();
  const admin = perfil.role === "admin";
  const db = await createClient();

  const lida = await lerCampanha(db, id).catch(() => null);
  if (!lida) notFound();

  const [{ porProduto, margemMinima }, catalogo] = await Promise.all([
    avaliarItens(createAdminClient(), lida.itens, admin),
    listarCatalogo(db),
  ]);

  const naCampanha = new Set(lida.itens.map((i) => i.productId));
  const paraAdicionar: ProdutoParaAdicionar[] = catalogo
    .filter((p) => p.disponivel && !naCampanha.has(p.id))
    .map((p) => ({
      id: p.id,
      trayId: p.trayId,
      nome: p.nome,
      categoria: p.categoria,
      precoCheio: p.precoAntes ?? p.preco,
      vendidos: p.vendidos,
    }));

  return (
    <EditorDeCampanha
      campanha={lida.campanha}
      itens={lida.itens}
      avaliacao={porProduto}
      margemMinima={admin ? margemMinima : null}
      admin={admin}
      paraAdicionar={paraAdicionar}
    />
  );
}
