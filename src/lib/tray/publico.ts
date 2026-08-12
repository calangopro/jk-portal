import "server-only";

/**
 * Leitura do catálogo pela API pública de busca da Tray.
 *
 *   GET https://LOJA/web_api/search
 *
 * Este caminho NÃO precisa de credencial, aplicativo aprovado nem instalação.
 * É o mesmo endpoint que o tema da loja usa para buscar produtos, e devolve
 * nome, preço, disponibilidade, imagens, categoria e propriedades.
 *
 * Continua valendo a regra do projeto: a Tray é a fonte de verdade de preço,
 * estoque e checkout. Aqui só espelhamos para ligar conteúdo a produto e para
 * emitir dados estruturados com informação real.
 *
 * Limite da casa: 50 itens por página (maxLimit informado pela própria API).
 */

export type ProdutoPublico = {
  id: string;
  nome: string;
  referencia: string | null;
  slug: string | null;
  url: string | null;
  preco: number | null;
  precoPromocional: number | null;
  disponivel: boolean;
  prazo: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  descricao: string | null;
  marca: string | null;
  imagem: string | null;
  temVariacao: boolean;
  propriedades: Record<string, string[]>;
  bruto: Record<string, unknown>;
};

const POR_PAGINA = 50;

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** Endereço da loja, sem barra no fim. Configurável por ambiente. */
export function urlDaLoja(): string {
  return (process.env.TRAY_STORE_URL ?? "https://www.jkaliancas.com.br").replace(/\/+$/, "");
}

function mapear(bruto: Record<string, unknown>): ProdutoPublico | null {
  const p = (bruto.Product ?? bruto) as Record<string, unknown>;
  const id = texto(p.id);
  if (!id) return null;

  const url = (p.url ?? {}) as Record<string, unknown>;
  const imagens = (p.ProductImage ?? []) as Record<string, unknown>[];
  const categoria = (p.Category ?? {}) as Record<string, unknown>;

  // Properties chega como { "Largura": ["3mm"], "Acabamento": ["Trabalhada"] }.
  const propriedades: Record<string, string[]> = {};
  const props = (p.Properties ?? {}) as Record<string, unknown>;
  for (const [chave, valor] of Object.entries(props)) {
    if (Array.isArray(valor)) {
      const limpos = valor.map((v) => String(v).trim()).filter(Boolean);
      if (limpos.length > 0) propriedades[chave] = limpos;
    }
  }

  return {
    id,
    nome: texto(p.name) ?? "Sem nome",
    referencia: texto(p.slug),
    slug: texto(p.shortcut),
    url: texto(url.https ?? url.http),
    preco: numeroOuNulo(p.price),
    precoPromocional: numeroOuNulo(p.promotional_price),
    disponivel: String(p.available ?? "0") === "1",
    prazo: texto(p.availability),
    categoriaId: texto(p.category_id ?? categoria.id),
    categoriaNome: texto(categoria.name),
    descricao: texto(p.description_small),
    marca: texto(p.brand),
    imagem: texto(imagens[0]?.https ?? imagens[0]?.http),
    temVariacao: String(p.has_variation ?? "0") === "1",
    propriedades,
    bruto: p,
  };
}

/** Lê o catálogo inteiro, paginando até acabar. */
export async function lerCatalogoPublico(
  limitePaginas = 60,
): Promise<{ produtos: ProdutoPublico[]; total: number }> {
  const base = urlDaLoja();
  const produtos: ProdutoPublico[] = [];
  let total = 0;

  for (let pagina = 1; pagina <= limitePaginas; pagina++) {
    const url = new URL(`${base}/web_api/search`);
    url.searchParams.set("limit", String(POR_PAGINA));
    url.searchParams.set("page", String(pagina));

    const resp = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      throw new Error(
        `A loja respondeu ${resp.status} ao listar produtos. Confira o endereço em TRAY_STORE_URL.`,
      );
    }

    // A resposta vem em ISO-8859-1, então decodificamos na mão para não
    // transformar acento em caractere quebrado.
    const buffer = await resp.arrayBuffer();
    const tipo = resp.headers.get("content-type") ?? "";
    const codificacao = /iso-8859-1|latin1/i.test(tipo) ? "iso-8859-1" : "utf-8";
    const cru = new TextDecoder(codificacao).decode(buffer);

    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(cru) as Record<string, unknown>;
    } catch {
      throw new Error("A loja devolveu uma resposta que não é JSON válido.");
    }

    const paging = (dados.paging ?? {}) as Record<string, unknown>;
    total = Number(paging.total ?? 0) || total;

    const lista = (dados.Products ?? []) as Record<string, unknown>[];
    if (!Array.isArray(lista) || lista.length === 0) break;

    for (const item of lista) {
      const p = mapear(item);
      if (p) produtos.push(p);
    }

    if (lista.length < POR_PAGINA) break;
    if (total > 0 && produtos.length >= total) break;
  }

  return { produtos, total: total || produtos.length };
}

/** Categorias deduzidas dos produtos, já que a busca não expõe a árvore. */
export function categoriasDoCatalogo(
  produtos: ProdutoPublico[],
): { id: string; nome: string }[] {
  const mapa = new Map<string, string>();
  for (const p of produtos) {
    if (p.categoriaId && p.categoriaNome) mapa.set(p.categoriaId, p.categoriaNome);
  }
  return [...mapa.entries()].map(([id, nome]) => ({ id, nome }));
}
