import { createReadClient } from "@/lib/supabase/read";
import type { ProdutoDaVitrine } from "./vitrine";
import { SITE } from "@/lib/seo/site";

/**
 * Produtos para a vitrine da home.
 *
 * O portal NÃO vende: preço, estoque e checkout são da Tray (PROJETO §3). Aqui
 * é espelho de leitura, e todo link sai para a loja oficial com UTM, para dar
 * para medir quanto o conteúdo empurra para a venda.
 */

// O tipo e a formatação do preço moram em `data/vitrine.ts`, sem dependência do
// Supabase, para o cartão de produto poder ser desenhado no navegador também.
// Seguem exportados daqui para quem já os importava deste arquivo.
export { precoLegivel, type ProdutoDaVitrine } from "./vitrine";

function comUtm(url: string | null, id: string, medium = "vitrine", campanha = "home"): string {
  const base = url && url.startsWith("http") ? url : SITE.lojaUrl;
  const separador = base.includes("?") ? "&" : "?";
  return `${base}${separador}utm_source=portal&utm_medium=${medium}&utm_campaign=${campanha}&utm_content=${id}`;
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
 * Recorte de aliança dentro do catálogo.
 *
 * O portal fala de aliança, então a vitrine da home mostra aliança. Sem este
 * filtro ela puxava o catálogo inteiro, e quem chegava por "aliança de namoro"
 * via dez anéis de formatura.
 *
 * O recorte é por PADRÃO de slug, não por lista de nomes. As categorias vêm da
 * Tray e a família cresce ("Alianças de Prata 950" e o que mais vier); uma
 * lista fixa deixaria a categoria nova de fora em silêncio, que é justamente o
 * tipo de erro que ninguém vê até alguém reclamar. Hoje o padrão pega sete
 * categorias e 639 produtos ativos com foto, sem nenhum "formatura" no meio.
 */
const CATEGORIA_DE_ALIANCA = "alianca%";

/**
 * O caminho de `products` até `categories`, escrito por extenso.
 *
 * Existem DOIS caminhos entre as duas tabelas: a chave estrangeira
 * `products.category_id` e a tabela de ligação `product_categories`. Pedir só
 * `categories(...)` deixa o PostgREST sem saber qual usar e ele recusa a
 * consulta inteira com `PGRST201`, o que aqui virava vitrine vazia, porque o
 * erro é engolido pelo `return []`. A ligação `product_categories` está vazia
 * no banco, então é a chave estrangeira que vale.
 */
const VINCULO_DE_CATEGORIA = "categories!products_category_id_fkey!inner(slug)";

/**
 * Amostra variada de alianças do catálogo.
 *
 * A variação vem de um deslocamento aleatório na consulta, e não de
 * `order by random()`, que obrigaria o Postgres a ordenar as 1.110 linhas a
 * cada carga só para escolher seis.
 *
 * A ordem é por `id`, e isso é o que faz o sorteio funcionar. Antes era por
 * `name`: como a janela é uma faixa CONTÍGUA, sortear o começo dela devolvia
 * sempre uma vizinhança alfabética, ou seja, dez produtos com o mesmo prefixo
 * de nome. O `id` é uuid, não tem relação com o nome, então a faixa contígua já
 * sai misturada.
 *
 * Como a home é estática com ISR de uma hora, a vitrine troca de hora em hora,
 * e não a cada visita. É o preço de servir HTML pronto, e vale: a alternativa
 * seria tornar a home dinâmica e perder o tempo de resposta.
 */
export async function produtosParaVitrine(limite = 8): Promise<ProdutoDaVitrine[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    // O `!inner` é o que transforma o vínculo com `categories` em filtro, e não
    // só em campo trazido junto. A contagem precisa do MESMO recorte da busca,
    // senão o deslocamento sorteado cai fora da faixa que existe.
    const { count } = await supabase
      .from("products")
      .select(`id, ${VINCULO_DE_CATEGORIA}`, { count: "exact", head: true })
      .eq("is_active", true)
      .not("main_image_url", "is", null)
      .like("categories.slug", CATEGORIA_DE_ALIANCA);

    const total = count ?? 0;
    if (total === 0) return [];

    const janela = Math.min(total, Math.max(limite * 6, 48));
    const inicio = total > janela ? Math.floor(Math.random() * (total - janela)) : 0;

    const { data, error } = await supabase
      .from("products")
      .select(`id, name, url, main_image_url, price, promotional_price, ${VINCULO_DE_CATEGORIA}`)
      .eq("is_active", true)
      .not("main_image_url", "is", null)
      .like("categories.slug", CATEGORIA_DE_ALIANCA)
      .order("id", { ascending: true })
      .range(inicio, inicio + janela - 1);

    if (error || !data) return [];

    const candidatos = (data as Linha[]).filter((l) => l.name && l.main_image_url);

    // Embaralha (Fisher-Yates) e descarta nome repetido, para a vitrine não
    // mostrar a mesma peça em três cartões lado a lado. O nome repete muito
    // ("Par de Alianças de Casamento Banhada a Ouro 18k Tradicional").
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

/**
 * Produtos que o editor amarrou a um guia, para o fim do artigo.
 *
 * Existe ao lado de `produtosDoConteudo` (em `data/contents.ts`) de propósito, e
 * não no lugar dela: aquela alimenta o JSON-LD e zera o preço por decisão
 * declarada, porque preço errado dentro de `Product` é problema com o Google.
 * Esta aqui é para a TELA, então lê o preço espelhado da Tray, o mesmo que a
 * vitrine da home mostra e com a mesma idade, porque as duas páginas revalidam
 * de hora em hora.
 *
 * O UTM sai como `artigo` para dar para separar, no relatório, a venda que veio
 * do texto da venda que veio da vitrine.
 */
export async function produtosParaOArtigo(
  contentId: string,
  limite = 3,
): Promise<ProdutoDaVitrine[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("content_products")
      .select(
        "products!inner(id, name, url, main_image_url, price, promotional_price, is_active)",
      )
      .eq("content_id", contentId)
      .eq("products.is_active", true)
      .limit(limite * 2);

    if (error || !data) return [];

    const vistos = new Set<string>();
    const achados: ProdutoDaVitrine[] = [];

    for (const linha of (data ?? []) as unknown as { products: Linha | null }[]) {
      const p = linha.products;
      if (!p || !p.name || vistos.has(p.id)) continue;
      vistos.add(p.id);
      achados.push({
        id: p.id,
        nome: p.name,
        imagem: p.main_image_url,
        preco: p.price,
        precoPromocional: p.promotional_price,
        href: comUtm(p.url, p.id, "artigo", contentId),
      });
      if (achados.length >= limite) break;
    }

    return achados;
  } catch {
    return [];
  }
}
