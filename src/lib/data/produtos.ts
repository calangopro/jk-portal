import { createReadClient } from "@/lib/supabase/read";
import type { ProdutoDaVitrine } from "./vitrine";
import { SITE } from "@/lib/seo/site";
import { hojeEmSaoPaulo, precoVigente } from "@/lib/tray/preco";

/**
 * Produtos para a vitrine da home.
 *
 * O portal NÃO vende: preço, estoque e checkout são da Tray (PROJETO §3). Aqui
 * é espelho de leitura, e todo link sai para a loja oficial.
 *
 * SEM UTM, de propósito. Portal e loja são o mesmo domínio e a mesma
 * propriedade do GA4, então quem chega do Google em /guias continua na MESMA
 * sessão quando clica para a loja. Um `utm_source=portal` no link abria uma
 * sessão nova com origem "portal" e a venda deixava de ser do orgânico, que é
 * justamente o que o portal existe para provar. O clique é medido pelo evento
 * `clique_produto` (ver `RastreioCliques`), não pela URL.
 */

// O tipo e a formatação do preço moram em `data/vitrine.ts`, sem dependência do
// Supabase, para o cartão de produto poder ser desenhado no navegador também.
// Seguem exportados daqui para quem já os importava deste arquivo.
export { precoLegivel, type ProdutoDaVitrine } from "./vitrine";

function linkDaLoja(url: string | null): string {
  return url && url.startsWith("http") ? url : SITE.lojaUrl;
}

export type LinhaDaVitrine = {
  id: string;
  name: string | null;
  url: string | null;
  main_image_url: string | null;
  price: number | null;
  promotional_price: number | null;
  start_promotion: string | null;
  end_promotion: string | null;
};

/**
 * Colunas que todo cartão de produto pede ao banco.
 *
 * As duas datas saem de `raw` porque a Tray não apaga `promotional_price`
 * quando a promoção acaba. Sem a janela, o Kit Forever 3mm saía "de 409,90 por
 * 369,90" em setembro, com uma promoção que terminou em 31/03 e que a loja não
 * pratica mais. Quem decide se a promoção vale é `precoVigente`, nunca a
 * consulta.
 */
const COLUNAS_DO_CARTAO =
  "id, name, url, main_image_url, price, promotional_price, " +
  "start_promotion:raw->>start_promotion, end_promotion:raw->>end_promotion";

/**
 * Toda vitrine abaixo pede `status = available`, e não é detalhe de estoque.
 * A Tray tira do ar a página do produto indisponível: dos cinco conferidos em
 * 24/09/2026, quatro caíam em "sem resultados na busca". Mostrar o cartão era
 * anunciar preço de peça que a loja não vende, com link para página morta.
 */

/**
 * Linha do banco para o cartão, com o preço que a loja cobra HOJE.
 *
 * `precoPromocional` só vem preenchido com a promoção dentro da janela, então
 * os componentes continuam com a regra de sempre ("promoção existe e é menor,
 * risca o cheio") sem precisar saber de data.
 *
 * O dia é lido na hora de montar o cartão, e o cartão vive tanto quanto a
 * página que o carrega. Quem refaz as páginas na virada do dia é a
 * sincronização das 00h00 (`revalidarPrecos`); a hora de ISR fica só de
 * rede de segurança. Cache de dado cru (como o da rota de largura) guarda a
 * LINHA, nunca o cartão, senão a virada do dia não o alcançaria.
 */
function paraCartao(l: LinhaDaVitrine, hoje: string): ProdutoDaVitrine {
  const { atual, anterior } = precoVigente(l, hoje);
  return {
    id: l.id,
    nome: l.name ?? "Produto",
    imagem: l.main_image_url,
    preco: anterior ?? atual,
    precoPromocional: anterior != null ? atual : null,
    href: linkDaLoja(l.url),
  };
}

/** Várias linhas de uma vez, todas com o MESMO dia. */
export function paraVitrine(
  linhas: LinhaDaVitrine[],
  hoje: string = hojeEmSaoPaulo(),
): ProdutoDaVitrine[] {
  return linhas.map((l) => paraCartao(l, hoje));
}

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
      .eq("status", "available")
      .not("main_image_url", "is", null)
      .like("categories.slug", CATEGORIA_DE_ALIANCA);

    const total = count ?? 0;
    if (total === 0) return [];

    const janela = Math.min(total, Math.max(limite * 6, 48));
    const inicio = total > janela ? Math.floor(Math.random() * (total - janela)) : 0;

    const { data, error } = await supabase
      .from("products")
      .select(`${COLUNAS_DO_CARTAO}, ${VINCULO_DE_CATEGORIA}`)
      .eq("is_active", true)
      .eq("status", "available")
      .not("main_image_url", "is", null)
      .like("categories.slug", CATEGORIA_DE_ALIANCA)
      .order("id", { ascending: true })
      .range(inicio, inicio + janela - 1);

    if (error || !data) return [];

    const candidatos = (data as unknown as LinhaDaVitrine[]).filter(
      (l) => l.name && l.main_image_url,
    );

    // Embaralha (Fisher-Yates) e descarta nome repetido, para a vitrine não
    // mostrar a mesma peça em três cartões lado a lado. O nome repete muito
    // ("Par de Alianças de Casamento Banhada a Ouro 18k Tradicional").
    for (let i = candidatos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]];
    }

    const vistos = new Set<string>();
    const escolhidos: LinhaDaVitrine[] = [];
    for (const l of candidatos) {
      const chave = (l.name ?? "").trim().toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      escolhidos.push(l);
      if (escolhidos.length >= limite) break;
    }

    return paraVitrine(escolhidos);
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
 *
 * Devolve a linha CRUA, sem o preço do dia resolvido, porque a rota
 * `/api/produtos/largura` guarda o resultado em cache por uma hora. Se o
 * cartão pronto entrasse no cache, a promoção que acabou à meia-noite seguiria
 * anunciada até a entrada vencer. Quem quer o cartão chama `produtosPorLargura`.
 */
export async function linhasPorLargura(
  larguraMm: number,
  limite = 4,
): Promise<LinhaDaVitrine[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_variants")
    .select(`products!inner(${COLUNAS_DO_CARTAO}, is_active)`)
    .eq("width_mm", larguraMm)
    .eq("products.is_active", true)
    .eq("products.status", "available")
    .not("products.price", "is", null)
    // Pede folga porque o mesmo produto pode ter várias variações na largura.
    .limit(limite * 4);

  const vistos = new Set<string>();
  const achados: LinhaDaVitrine[] = [];

  for (const linha of (data ?? []) as unknown as { products: LinhaDaVitrine | null }[]) {
    const p = linha.products;
    // Repetir o mesmo card faria o catálogo parecer menor do que é.
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);
    achados.push(p);
    if (achados.length >= limite) break;
  }

  return achados;
}

export async function produtosPorLargura(
  larguraMm: number,
  limite = 4,
): Promise<ProdutoDaVitrine[]> {
  return paraVitrine(await linhasPorLargura(larguraMm, limite));
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
      .select(`products!inner(${COLUNAS_DO_CARTAO}, is_active)`)
      .eq("content_id", contentId)
      .eq("products.is_active", true)
      .eq("products.status", "available")
      .limit(limite * 2);

    if (error || !data) return [];

    const vistos = new Set<string>();
    const achados: LinhaDaVitrine[] = [];

    for (const linha of (data ?? []) as unknown as { products: LinhaDaVitrine | null }[]) {
      const p = linha.products;
      if (!p || !p.name || vistos.has(p.id)) continue;
      vistos.add(p.id);
      achados.push(p);
      if (achados.length >= limite) break;
    }

    return paraVitrine(achados);
  } catch {
    return [];
  }
}
