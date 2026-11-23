import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listarCatalogo } from "@/lib/catalogo/fotos";
import { margensDoCatalogo } from "@/lib/margem/dados";
import { hojeEmSaoPaulo, somarDias } from "@/lib/vendas/periodo";
import { sobraDoPeriodo } from "@/lib/vendas/sobra";
import { CpaIdealDoPeriodo } from "../vendas/SobraDoPeriodo";
import { PainelDeAnuncios, type LinhaDeAnuncio } from "./PainelDeAnuncios";

export const metadata = { title: "Anúncios" };

/**
 * Quanto cada produto aguenta pagar de anúncio por venda.
 *
 * É a margem vista pelo lado de quem compra mídia: o CPA máximo é o que dá
 * para gastar por venda e ainda ficar com a margem mínima, e o ROAS mínimo é
 * o retorno que o anúncio precisa dar para isso. Só administrador, porque o
 * CPA máximo, junto do preço, entrega o custo.
 *
 * O custo vai para o navegador e a conta roda lá, para o cenário de desconto
 * ("e se a Black for 20%?") responder na hora, sem ida ao servidor.
 */
export default async function AnunciosPage() {
  await requireAdmin();
  const db = await createClient();
  const itens = (await listarCatalogo(db)).filter((p) => p.disponivel);
  const hoje = hojeEmSaoPaulo();
  const [{ efetivos, porProduto }, geral] = await Promise.all([
    margensDoCatalogo(db, itens),
    // O CPA ideal do negócio inteiro, dos últimos 30 dias (cartão 81). Se a leitura falhar, a tela segue só com o CPA por produto.
    sobraDoPeriodo(somarDias(hoje, -29), hoje).catch((e) => {
      console.error("[anuncios] cpa geral:", e instanceof Error ? e.message : e);
      return null;
    }),
  ]);

  const linhas: LinhaDeAnuncio[] = itens.map((p) => ({
    id: p.id,
    trayId: p.trayId,
    nome: p.nome,
    categoria: p.categoria,
    vendidos: p.vendidos,
    precoCheio: p.precoAntes ?? p.preco,
    precoHoje: p.preco,
    custo: porProduto[p.id]?.custo ?? null,
    falta: porProduto[p.id]?.falta ?? "Sem custo",
  }));

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Anúncios</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quanto cada produto aguenta pagar de anúncio por venda sem ficar abaixo da margem mínima. É o número para o
          lance de custo por resultado no Meta e no Google. Usa o custo e os parâmetros de{" "}
          <Link href="/admin/margem" className="font-semibold text-brand-nav hover:underline">
            Margem
          </Link>
          .
        </p>
      </header>
      {geral?.cpa ? <CpaIdealDoPeriodo cpa={geral.cpa} /> : null}
      <PainelDeAnuncios linhas={linhas} parametros={efetivos} />
    </div>
  );
}
