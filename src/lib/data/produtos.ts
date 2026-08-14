import { createReadClient } from "@/lib/supabase/read";
import { SITE } from "@/lib/seo/site";

/**
 * Produtos para a vitrine da home.
 *
 * O portal NÃO vende: preço, estoque e checkout são da Tray (PROJETO §3). Aqui
 * é espelho de leitura, e todo link sai para a loja oficial com UTM, para dar
 * para medir quanto o conteúdo empurra para a venda.
 */

export type ProdutoDaVitrine = {
  id: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  precoPromocional: number | null;
  href: string;
};

/** "R$ 1.234,56". Devolve nulo quando não há preço real, nunca "sob consulta". */
export function precoLegivel(valor: number | null): string | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function comUtm(url: string | null, id: string): string {
  const base = url && url.startsWith("http") ? url : SITE.lojaUrl;
  const separador = base.includes("?") ? "&" : "?";
  return `${base}${separador}utm_source=portal&utm_medium=vitrine&utm_campaign=home&utm_content=${id}`;
}

type Linha = {
  id: string;
  name: string | null;
  url: string | null;
  main_image_url: string | null;
  price: number | null;
  promotional_price: number | null;
};

/**
 * Amostra variada do catálogo.
 *
 * A variação vem de um deslocamento aleatório na consulta, e não de
 * `order by random()`, que obrigaria o Postgres a ordenar as 1.110 linhas a
 * cada carga só para escolher seis.
 *
 * Como a home é estática com ISR de uma hora, a vitrine troca de hora em hora,
 * e não a cada visita. É o preço de servir HTML pronto, e vale: a alternativa
 * seria tornar a home dinâmica e perder o tempo de resposta.
 */
export async function produtosParaVitrine(limite = 8): Promise<ProdutoDaVitrine[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .not("main_image_url", "is", null);

    const total = count ?? 0;
    if (total === 0) return [];

    // Janela larga e sorteio dentro dela, em vez de pegar `limite` linhas
    // seguidas. O catálogo está ordenado por nome, e nome de aliança repete
    // muito ("Par de Alianças de Casamento Banhada a Ouro 18k Tradicional"),
    // então uma faixa contígua devolvia o mesmo produto três vezes seguidas.
    const janela = Math.min(total, Math.max(limite * 6, 48));
    const inicio = total > janela ? Math.floor(Math.random() * (total - janela)) : 0;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, url, main_image_url, price, promotional_price")
      .eq("is_active", true)
      .not("main_image_url", "is", null)
      .order("name", { ascending: true })
      .range(inicio, inicio + janela - 1);

    if (error || !data) return [];

    const candidatos = (data as Linha[]).filter((l) => l.name && l.main_image_url);

    // Embaralha (Fisher-Yates) e descarta nome repetido, para a vitrine não
    // mostrar a mesma peça em três cartões lado a lado.
    for (let i = candidatos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]];
    }

    const vistos = new Set<string>();
    const escolhidos: Linha[] = [];
    for (const l of candidatos) {
      const chave = (l.name ?? "").trim().toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      escolhidos.push(l);
      if (escolhidos.length >= limite) break;
    }

    return escolhidos
      .map((l) => ({
        id: l.id,
        nome: l.name as string,
        imagem: l.main_image_url,
        preco: l.price,
        precoPromocional: l.promotional_price,
        href: comUtm(l.url, l.id),
      }));
  } catch {
    return [];
  }
}

/**
 * Produtos que existem naquela largura, para a ferramenta ter saída de verdade.
 *
 * Só produto ativo e com preço sincronizado: a régua do projeto é nunca
 * anunciar preço velho nem produto que sumiu do catálogo. A largura vem de
 * `product_variants.width_mm`, preenchida pela sincronização a partir das
 * propriedades da Tray.
 */
export async function produtosPorLargura(
  larguraMm: number,
  limite = 4,
): Promise<ProdutoDaVitrine[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_variants")
    .select(
      "products!inner(id, name, url, main_image_url, price, promotional_price, is_active)",
    )
    .eq("width_mm", larguraMm)
    .eq("products.is_active", true)
    .not("products.price", "is", null)
    // Pede folga porque o mesmo produto pode ter várias variações na largura.
    .limit(limite * 4);

  const vistos = new Set<string>();
  const achados: ProdutoDaVitrine[] = [];

  for (const linha of (data ?? []) as unknown as { products: Linha | null }[]) {
    const p = linha.products;
    // Repetir o mesmo card faria o catálogo parecer menor do que é.
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);

    achados.push({
      id: p.id,
      nome: p.name ?? "Produto",
      imagem: p.main_image_url,
      preco: p.price,
      precoPromocional: p.promotional_price,
      href: comUtm(p.url, p.id),
    });

    if (achados.length >= limite) break;
  }

  return achados;
}
