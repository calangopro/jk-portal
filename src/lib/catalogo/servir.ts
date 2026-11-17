import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeEmSaoPaulo, precoVigente } from "@/lib/tray/preco";
import {
  montarItens,
  xmlDoArquivo,
  type Categoria,
  type DetalheDaLoja,
  type Destino,
  type ProdutoDoArquivo,
} from "./arquivo";

/**
 * Serve o arquivo de catálogo (`/api/catalogo/meta.xml` e `/google.xml`).
 *
 * Quem lê é o Commerce Manager (de hora em hora) e o Google Merchant. A regra
 * que manda aqui é uma: **erro nunca vira arquivo vazio**. Um arquivo sem
 * itens, lido pelo Meta, apaga o catálogo inteiro, e com ele o histórico dos
 * anúncios de catálogo. Por isso qualquer falha de leitura, árvore de
 * categorias vazia ou lista sem item responde 503: o Meta registra a falha da
 * busca e continua com a última versão boa.
 */

const PAGINA = 1000;
/** Quantos códigos por pedido com `in`, para o endereço não passar do limite. */
const LOTE_DE_CODIGOS = 150;

type LinhaDoProduto = {
  tray_id: string;
  url: string | null;
  status: string | null;
  is_active: boolean;
  main_image_url: string | null;
  price: number | string | null;
  promotional_price: number | string | null;
  nome: string | null;
  marca: string | null;
  categoria: string | null;
  curta: string | null;
  inicio: string | null;
  fim: string | null;
};

type LinhaDoDetalhe = {
  tray_id: string;
  encontrado: boolean;
  descricao_html: string | null;
  imagens: string[] | null;
  referencia: string | null;
  modelo: string | null;
  ean: string | null;
  peso: number | string | null;
  comprimento: number | string | null;
  largura: number | string | null;
  altura: number | string | null;
  estoque: number | null;
  modificado_na_loja: string | null;
};

const num = (v: number | string | null): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function detalheDaLinha(l: LinhaDoDetalhe): DetalheDaLoja {
  return {
    encontrado: l.encontrado,
    descricaoHtml: l.descricao_html,
    imagens: l.imagens ?? [],
    referencia: l.referencia,
    modelo: l.modelo,
    ean: l.ean,
    peso: num(l.peso),
    comprimento: num(l.comprimento),
    largura: num(l.largura),
    altura: num(l.altura),
    estoque: l.estoque,
    modificadoNaLoja: l.modificado_na_loja,
  };
}

async function paginas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return linhas;
}

export type ArquivoMontado = {
  xml: string;
  itens: number;
  semDetalhe: number;
  fora: number;
};

/** Lê o banco e monta o arquivo. Lança em qualquer falha: quem chama responde 503. */
export async function montarArquivo(destino: Destino, db: SupabaseClient = createAdminClient()): Promise<ArquivoMontado> {
  const hoje = hojeEmSaoPaulo();

  const [produtos, categorias] = await Promise.all([
    paginas<LinhaDoProduto>((de, ate) =>
      db
        .from("products")
        .select(
          "tray_id, url, status, is_active, main_image_url, price, promotional_price, " +
            "nome:raw->>name, marca:raw->>brand, categoria:raw->>category_id, curta:raw->>description_small, " +
            "inicio:raw->>start_promotion, fim:raw->>end_promotion",
        )
        .eq("is_active", true)
        .eq("status", "available")
        .order("tray_id")
        .range(de, ate),
    ),
    paginas<{ tray_id: string; nome: string; pai: string | null }>((de, ate) =>
      db.from("catalogo_categorias").select("tray_id, nome, pai").order("tray_id").range(de, ate),
    ),
  ]);

  if (categorias.length === 0) throw new Error("A árvore de categorias da loja ainda não foi guardada.");
  const arvore: Categoria[] = categorias.map((c) => ({ id: c.tray_id, nome: c.nome, pai: c.pai }));

  // Os detalhes só de quem pode entrar: a descrição completa pesa, e metade
  // do catálogo nem entra no arquivo.
  const codigos = produtos.map((p) => p.tray_id).filter((id) => /^\d+$/.test(id));
  const lotes: string[][] = [];
  for (let i = 0; i < codigos.length; i += LOTE_DE_CODIGOS) lotes.push(codigos.slice(i, i + LOTE_DE_CODIGOS));
  const respostas = await Promise.all(
    lotes.map((lote) =>
      db
        .from("catalogo_detalhes")
        .select("tray_id, encontrado, descricao_html, imagens, referencia, modelo, ean, peso, comprimento, largura, altura, estoque, modificado_na_loja")
        .in("tray_id", lote),
    ),
  );
  const detalhes = new Map<string, DetalheDaLoja>();
  for (const r of respostas) {
    if (r.error) throw new Error(r.error.message);
    for (const l of (r.data ?? []) as LinhaDoDetalhe[]) detalhes.set(l.tray_id, detalheDaLinha(l));
  }

  const lista: ProdutoDoArquivo[] = produtos
    .filter((p) => /^\d+$/.test(p.tray_id))
    .map((p) => {
      const preco = precoVigente({ price: p.price, promotional_price: p.promotional_price, start_promotion: p.inicio, end_promotion: p.fim }, hoje);
      return {
        trayId: p.tray_id,
        nome: p.nome ?? "",
        url: p.url,
        ativo: p.is_active,
        disponivel: p.status === "available",
        categoriaId: p.categoria,
        marca: p.marca,
        imagemPrincipal: p.main_image_url,
        descricaoCurta: p.curta,
        preco: { atual: preco.atual, anterior: preco.anterior },
        promocao: { inicio: p.inicio, fim: p.fim },
        detalhe: detalhes.get(p.tray_id) ?? null,
      };
    });

  const r = montarItens(lista, arvore, destino, hoje);
  if (r.itens.length === 0) throw new Error("Nenhum produto entrou no arquivo.");
  return { xml: xmlDoArquivo(r.itens), itens: r.itens.length, semDetalhe: r.semDetalhe.length, fora: r.fora.length };
}

/**
 * A resposta da rota. Quinze minutos na CDN da Vercel: o Commerce Manager lê
 * de hora em hora, e o preço no espelho muda de quinze em quinze.
 */
export async function responderArquivo(destino: Destino): Promise<Response> {
  try {
    const a = await montarArquivo(destino);
    const corpo = new TextEncoder().encode(a.xml);
    // Entregue em pedaços: resposta de função inteira acima de 4,5 MB a Vercel
    // recusa, e o catálogo com semijoia passaria perto disso.
    const PEDACO = 256 * 1024;
    const fluxo = new ReadableStream<Uint8Array>({
      start(controle) {
        for (let i = 0; i < corpo.length; i += PEDACO) controle.enqueue(corpo.subarray(i, i + PEDACO));
        controle.close();
      },
    });
    return new Response(fluxo, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
        "X-Catalogo-Itens": String(a.itens),
        "X-Catalogo-Sem-Detalhe": String(a.semDetalhe),
      },
    });
  } catch (e) {
    console.error(`[catalogo:${destino}]`, e);
    return new Response("O arquivo do catálogo não pôde ser montado agora. Tente de novo em alguns minutos.\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "900" },
    });
  }
}
