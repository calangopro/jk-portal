import "server-only";
import { unstable_cache } from "next/cache";
import { createReadClient } from "@/lib/supabase/read";
import { buscarNaLoja, categoriasDaLoja, type ProdutoPublico } from "@/lib/tray/publico";
import { hojeEmSaoPaulo, precoVigente } from "@/lib/tray/preco";
import type { FonteDaVitrine, ProdutoDaBio } from "./tipos";

/**
 * Produtos da vitrine da bio, com preço AO VIVO da loja.
 *
 * A bio é a porta do Instagram, e na Black o preço muda no meio do dia. A
 * tabela `products` só muda quando alguém sincroniza, então anunciar preço dela
 * aqui seria anunciar o preço de ontem. Tudo sai da busca pública da Tray, com
 * cache curto (`TEMPO_DO_PRECO`), e o preço passa por `precoVigente`, que
 * descarta promoção com a janela vencida.
 *
 * O id é o da Tray porque é o mesmo `item_id` que a loja manda para o GA4 no
 * `view_item` e no `purchase` (conferido na página do Eternal Love: "217"). Com
 * o mesmo id dos dois lados, o relatório de e-commerce liga o clique na bio à
 * venda na loja.
 */

export type { ProdutoDaBio } from "./tipos";

/** Segundos que um preço pode ter de idade na bio. */
const TEMPO_DO_PRECO = 300;
export const TAG_PRODUTOS_DA_BIO = "bio-produtos";

function paraABio(p: ProdutoPublico, hoje: string): ProdutoDaBio | null {
  if (!p.disponivel || !p.imagem || !p.url) return null;
  const preco = precoVigente(
    {
      price: p.preco,
      promotional_price: p.precoPromocional,
      start_promotion: p.bruto.start_promotion as string | undefined,
      end_promotion: p.bruto.end_promotion as string | undefined,
    },
    hoje,
  );
  // Sem preço real, o cartão não entra. Nada de "sob consulta" inventado.
  if (preco.atual == null) return null;

  return {
    id: p.id,
    nome: p.nome,
    imagem: p.imagem,
    href: p.url,
    categoria: p.categoriaNome,
    atual: preco.atual,
    anterior: preco.anterior,
    desconto: preco.desconto,
  };
}

const opcoes = { revalidar: TEMPO_DO_PRECO, tags: [TAG_PRODUTOS_DA_BIO] };

async function porIds(ids: string[]): Promise<ProdutoPublico[]> {
  const listas = await Promise.all(ids.map((id) => buscarNaLoja({ id, limit: "1" }, opcoes)));
  return listas.flat();
}

/**
 * Ranking de vendas, do espelho do catálogo.
 *
 * A busca da loja não ordena por mais vendidos (conferido: não existe campo de
 * ordenação para isso), mas cada produto informa `quantity_sold`, e o espelho
 * guarda esse número. O ranking pode ter um dia de idade sem problema nenhum;
 * o que não pode envelhecer é o preço, e esse vem da loja logo depois.
 */
const rankingDeVendas = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createReadClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("products")
      .select("tray_id, vendidos:raw->>quantity_sold")
      .eq("is_active", true)
      .not("main_image_url", "is", null);
    if (error || !data) return [];

    return (data as { tray_id: string; vendidos: string | null }[])
      .map((l) => ({ id: l.tray_id, vendidos: Number(l.vendidos) || 0 }))
      .filter((l) => l.vendidos > 0)
      .sort((a, b) => b.vendidos - a.vendidos)
      .slice(0, 48)
      .map((l) => l.id);
  },
  ["bio-ranking-de-vendas", "v1"],
  { revalidate: 3600 },
);

async function brutosDaFonte(fonte: FonteDaVitrine, limite: number): Promise<ProdutoPublico[]> {
  // Pede com folga: produto esgotado ou sem foto sai da lista depois.
  const folga = String(Math.min(50, limite * 2));

  switch (fonte.tipo) {
    case "categoria": {
      const slug = fonte.slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
      const categorias = await categoriasDaLoja();
      // Aceita o slug completo (`noivado-e-casamento/aliancas-de-moeda`) e o
      // último pedaço, que é como a pessoa lê o endereço da categoria.
      const categoria =
        categorias.find((c) => c.slug.toLowerCase() === slug) ??
        categorias.find((c) => c.slug.toLowerCase().split("/").pop() === slug);
      if (!categoria || !categoria.ativa) return [];
      return buscarNaLoja({ category_id: categoria.id, limit: folga }, opcoes);
    }
    case "manual":
      return porIds(fonte.ids.slice(0, limite * 2));
    case "mais-vendidos":
      return porIds((await rankingDeVendas()).slice(0, limite + 4));
    case "destaques": {
      const lista = await buscarNaLoja({ sort: "hot_desc", limit: folga }, opcoes);
      return lista.filter((p) => String(p.bruto.hot ?? "0") === "1");
    }
    case "lancamentos":
      return buscarNaLoja({ sort: "release_desc", limit: folga }, opcoes);
  }
}

export async function produtosDaVitrine(
  fonte: FonteDaVitrine,
  limite: number,
): Promise<ProdutoDaBio[]> {
  try {
    const hoje = hojeEmSaoPaulo();
    const vistos = new Set<string>();
    const saida: ProdutoDaBio[] = [];

    for (const bruto of await brutosDaFonte(fonte, limite)) {
      const p = paraABio(bruto, hoje);
      if (!p || vistos.has(p.id)) continue;
      vistos.add(p.id);
      saida.push(p);
      if (saida.length >= limite) break;
    }
    return saida;
  } catch {
    return [];
  }
}
