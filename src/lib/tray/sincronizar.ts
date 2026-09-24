import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerCatalogoPublico, categoriasDoCatalogo, type ProdutoPublico } from "./publico";
import { hojeEmSaoPaulo } from "./preco";

/**
 * Sincronização do catálogo da Tray para o Supabase. Somente leitura na loja.
 *
 * Usa a API pública de busca (/web_api/search), que não exige credencial,
 * aplicativo aprovado nem instalação. Isso permite ter o catálogo no portal
 * hoje. Quando as credenciais da API autenticada existirem, dá para
 * complementar com variações por SKU (ver src/lib/tray/cliente.ts).
 *
 * Regras que valem sempre:
 * - Gravação por upsert em `tray_id`, então reimportar nunca duplica.
 * - Payload bruto preservado em `raw`, separado dos campos normalizados.
 * - Produto que sumiu da loja é DESATIVADO, nunca apagado, para não perder
 *   histórico nem quebrar link em conteúdo publicado.
 * - Preço e disponibilidade são espelho. Quem manda é a Tray.
 *
 * ## Por que em lotes e só o que mudou
 *
 * A primeira versão gravava produto por produto, duas idas ao banco por peça.
 * Com 1.162 produtos isso passava de dois minutos, e a função da Vercel morria
 * no meio: em 24/09/2026 ficaram 740 produtos com preço do dia e o resto com
 * preço de agosto, sem nenhuma linha em `sync_logs`, porque o registro só era
 * feito no fim. O passo de desativar o que sumiu nunca chegava a rodar.
 *
 * Agora a rodada lê a loja inteira, lê o espelho inteiro, e grava em lotes só
 * as linhas cuja impressão (`sync_hash`) mudou. É o que deixa rodar de quinze
 * em quinze minutos pelo `pg_cron` (migration 0040) sem reescrever o catálogo
 * todo a cada vez.
 */

export type ResultadoSync = {
  ok: boolean;
  categorias: number;
  /** Produtos que a loja devolveu e que o espelho confere. */
  produtos: number;
  /** Produtos gravados nesta rodada porque algo neles mudou na loja. */
  alterados: number;
  desativados: number;
  /** Quantos produtos a loja devolveu mas não conseguimos gravar. */
  falhas: number;
  /** Primeiro erro de gravação, para dar pista do que investigar. */
  primeiroErro?: string | null;
  /** O que a rodada decidiu NÃO fazer por segurança, e por quê. */
  aviso?: string | null;
  erro?: string;
  /**
   * As páginas que mostram preço precisam ser refeitas. Vale quando algo que
   * aparece na tela mudou, e também na primeira rodada do dia em São Paulo:
   * promoção começa e acaba na virada do dia sem nada mudar no banco.
   */
  revalidar: boolean;
  duracaoMs: number;
};

/** Linhas por ida ao banco. Com `raw`, um lote de 200 fica perto de 600 kB. */
const LOTE = 200;

/** O PostgREST entrega no máximo mil linhas por pedido. */
const PAGINA_DO_BANCO = 1000;

/**
 * Acima desta fração dos ativos, sumir de uma vez parece leitura incompleta da
 * loja, e não catálogo que encolheu. Nesse caso nada é desativado e o aviso
 * fica no resultado: desativar 400 produtos por uma resposta cortada tiraria
 * as vitrines do ar até a próxima rodada.
 */
const TETO_DE_DESATIVACAO = 0.1;

/** O que o espelho precisa ter à mão para decidir se o produto mudou. */
type NoEspelho = {
  id: string;
  tray_id: string;
  is_active: boolean;
  sync_hash: string | null;
  name: string | null;
  url: string | null;
  main_image_url: string | null;
  status: string | null;
  price: number | null;
  promotional_price: number | null;
  availability_text: string | null;
  start_promotion: string | null;
  end_promotion: string | null;
};

type Linha = Record<string, unknown>;

function textoOuNulo(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Propriedades da Tray (Largura, Acabamento, Conforto) viram variação única. */
function resumoDasPropriedades(p: ProdutoPublico) {
  const pegar = (...nomes: string[]) => {
    for (const n of nomes) {
      const chave = Object.keys(p.propriedades).find(
        (k) => k.toLowerCase() === n.toLowerCase(),
      );
      if (chave) return p.propriedades[chave][0] ?? null;
    }
    return null;
  };

  const largura = pegar("Largura");
  const larguraMm = largura ? Number(largura.replace(/[^\d.,]/g, "").replace(",", ".")) : null;

  return {
    largura_mm: Number.isFinite(larguraMm as number) ? larguraMm : null,
    material: pegar("Material", "Metal"),
    acabamento: pegar("Acabamento"),
  };
}

function linhaDoProduto(p: ProdutoPublico, mapaCategoria: Map<string, string>) {
  return {
    tray_id: p.id,
    name: p.nome,
    slug: p.slug ? slugificar(p.slug) : slugificar(p.nome),
    url: p.url,
    category_id: p.categoriaId ? (mapaCategoria.get(p.categoriaId) ?? null) : null,
    status: p.disponivel ? "available" : "unavailable",
    main_image_url: p.imagem,
    description: p.descricao,
    brand: p.marca ?? "JK Alianças",
    price: p.preco,
    // Espelho fiel da Tray, mesmo com a promoção fora da janela. Zerar aqui
    // apagaria também a promoção AGENDADA, que a loja liga sozinha no primeiro
    // dia. Quem decide se o valor vale é `precoVigente`, na hora de servir.
    promotional_price: p.precoPromocional,
    availability_text: p.prazo,
    is_active: true,
    raw: p.bruto,
  };
}

function linhaDaVariacao(p: ProdutoPublico) {
  const resumo = resumoDasPropriedades(p);
  return {
    tray_variant_id: `pub-${p.id}`,
    sku: p.referencia,
    material: resumo.material,
    width_mm: resumo.largura_mm,
    // Preço de tabela. A promoção depende do dia e mora em `products`, onde
    // `precoVigente` resolve na hora de servir. Nenhuma tela lê este campo.
    price: p.preco,
    is_active: p.disponivel,
    raw: { propriedades: p.propriedades, prazo: p.prazo, acabamento: resumo.acabamento },
  };
}

/** JSON com as chaves em ordem, para a mesma linha dar sempre a mesma impressão. */
function estavel(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  const o = v as Linha;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${estavel(o[k])}`)
    .join(",")}}`;
}

function impressao(v: unknown): string {
  return createHash("sha1").update(estavel(v)).digest("hex");
}

/** Preço comparado em centavos, porque o banco guarda `numeric(12,2)`. */
function centavos(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Mudou alguma coisa que aparece na tela? É o que decide refazer as páginas.
 *
 * Conferido campo a campo, e não só pela impressão, para o preço nunca
 * depender de a impressão gravada estar certa: se alguém mexer na linha por
 * outro caminho, a diferença de preço aparece aqui do mesmo jeito.
 */
function mudouNaTela(atual: NoEspelho, novo: ReturnType<typeof linhaDoProduto>): boolean {
  return (
    !atual.is_active ||
    atual.name !== novo.name ||
    atual.url !== novo.url ||
    atual.main_image_url !== novo.main_image_url ||
    atual.status !== novo.status ||
    atual.availability_text !== novo.availability_text ||
    centavos(atual.price) !== centavos(novo.price) ||
    centavos(atual.promotional_price) !== centavos(novo.promotional_price) ||
    atual.start_promotion !== textoOuNulo(novo.raw.start_promotion) ||
    atual.end_promotion !== textoOuNulo(novo.raw.end_promotion)
  );
}

/** O espelho inteiro, ativo e inativo, paginado. */
async function lerEspelho(supabase: SupabaseClient): Promise<NoEspelho[]> {
  const linhas: NoEspelho[] = [];
  for (let de = 0; ; de += PAGINA_DO_BANCO) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, tray_id, is_active, sync_hash, name, url, main_image_url, status, price, " +
          "promotional_price, availability_text, " +
          "start_promotion:raw->>start_promotion, end_promotion:raw->>end_promotion",
      )
      .order("id")
      .range(de, de + PAGINA_DO_BANCO - 1);
    // Sem o espelho completo não dá para saber o que mudou nem o que sumiu.
    if (error) throw new Error(`Não foi possível ler os produtos do portal: ${error.message}`);
    const pagina = (data ?? []) as unknown as NoEspelho[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA_DO_BANCO) break;
  }
  return linhas;
}

/** Já houve rodada hoje, no relógio da loja? Na dúvida, responde que não. */
async function houveRodadaHoje(supabase: SupabaseClient, hoje: string): Promise<boolean> {
  const { data } = await supabase
    .from("sync_logs")
    .select("started_at")
    .eq("source", "tray")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const inicio = (data as { started_at: string | null } | null)?.started_at;
  return Boolean(inicio) && hojeEmSaoPaulo(new Date(inicio as string)) === hoje;
}

/**
 * Upsert em lotes. Uma linha ruim derruba o lote inteiro no Postgres, então o
 * lote que falha é refeito linha a linha: as boas entram e a ruim fica
 * registrada com o motivo, em vez de sumir em silêncio.
 */
async function gravarEmLotes(
  supabase: SupabaseClient,
  tabela: string,
  linhas: Linha[],
  onConflict: string,
  colunas: string,
): Promise<{ gravadas: Linha[]; falhas: { linha: Linha; erro: string }[] }> {
  const gravadas: Linha[] = [];
  const falhas: { linha: Linha; erro: string }[] = [];

  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE);
    const { data, error } = await supabase.from(tabela).upsert(lote, { onConflict }).select(colunas);
    if (!error) {
      gravadas.push(...((data ?? []) as unknown as Linha[]));
      continue;
    }
    for (const linha of lote) {
      const r = await supabase.from(tabela).upsert(linha, { onConflict }).select(colunas);
      if (r.error) falhas.push({ linha, erro: r.error.message });
      else gravadas.push(...((r.data ?? []) as unknown as Linha[]));
    }
  }

  return { gravadas, falhas };
}

export async function sincronizarCatalogo(): Promise<ResultadoSync> {
  const inicio = Date.now();
  const vazio: ResultadoSync = {
    ok: false, categorias: 0, produtos: 0, alterados: 0, desativados: 0, falhas: 0,
    revalidar: false, duracaoMs: 0,
  };

  const supabase = createAdminClient();

  // Lido ANTES de registrar esta rodada, senão ela mesma responderia que sim.
  const primeiraDoDia = !(await houveRodadaHoje(supabase, hojeEmSaoPaulo()));

  const registrar = async (r: Partial<ResultadoSync> & { status: string; erro?: string }) => {
    await supabase.from("sync_logs").insert({
      source: "tray",
      operation: "catalogo_publico",
      status: r.status,
      attempted: (r.produtos ?? 0) + (r.categorias ?? 0),
      succeeded: (r.produtos ?? 0) + (r.categorias ?? 0),
      failed: r.falhas ?? (r.status === "error" ? 1 : 0),
      error: r.erro ?? r.primeiroErro ?? r.aviso ?? null,
      started_at: new Date(inicio).toISOString(),
      finished_at: new Date().toISOString(),
      payload: {
        categorias: r.categorias ?? 0,
        produtos: r.produtos ?? 0,
        alterados: r.alterados ?? 0,
        desativados: r.desativados ?? 0,
        falhas: r.falhas ?? 0,
      },
    });
  };

  try {
    const { produtos: lidos } = await lerCatalogoPublico();
    if (lidos.length === 0) {
      const erro = "A loja não devolveu nenhum produto.";
      await registrar({ status: "error", erro });
      return { ...vazio, erro, revalidar: primeiraDoDia, duracaoMs: Date.now() - inicio };
    }

    // O mesmo produto em duas páginas (a loja mudou a ordem no meio da
    // leitura) faria o Postgres recusar o lote inteiro por linha repetida.
    const produtos = Array.from(new Map(lidos.map((p) => [p.id, p])).values());

    const agora = new Date().toISOString();

    /* ------------------------------------------------------- categorias */
    const categorias = categoriasDoCatalogo(produtos);
    const { gravadas: categoriasGravadas } = await gravarEmLotes(
      supabase,
      "categories",
      categorias.map((c) => ({
        tray_id: c.id,
        name: c.nome,
        canonical_name: c.nome,
        slug: slugificar(c.nome),
        is_active: true,
        last_synced_at: agora,
      })),
      "tray_id",
      "id, tray_id",
    );
    const mapaCategoria = new Map(
      categoriasGravadas.map((c) => [String(c.tray_id), String(c.id)]),
    );

    /* ---------------------------------------------------------- produtos */
    const espelho = await lerEspelho(supabase);
    const porTrayId = new Map(espelho.map((l) => [l.tray_id, l]));

    let telaMudou = false;
    const paraGravar: { trayId: string; produto: Linha; variacao: Linha }[] = [];

    for (const p of produtos) {
      const produto = linhaDoProduto(p, mapaCategoria);
      const variacao = linhaDaVariacao(p);
      const hash = impressao({ produto, variacao });
      const atual = porTrayId.get(p.id);

      const naTela = !atual || mudouNaTela(atual, produto);
      if (!naTela && atual?.sync_hash === hash) continue;
      if (naTela) telaMudou = true;

      paraGravar.push({
        trayId: p.id,
        produto: { ...produto, sync_hash: hash, last_synced_at: agora },
        variacao,
      });
    }

    const { gravadas, falhas: falhasDeProduto } = await gravarEmLotes(
      supabase,
      "products",
      paraGravar.map((x) => x.produto),
      "tray_id",
      "id, tray_id",
    );
    const idPorTrayId = new Map(gravadas.map((g) => [String(g.tray_id), String(g.id)]));

    /* ---------------------------------------------------------- variações */
    const { falhas: falhasDeVariacao } = await gravarEmLotes(
      supabase,
      "product_variants",
      paraGravar
        .filter((x) => idPorTrayId.has(x.trayId))
        .map((x) => ({ ...x.variacao, product_id: idPorTrayId.get(x.trayId), last_synced_at: agora })),
      "tray_variant_id",
      "id",
    );

    // Variação que não gravou deixa o produto sem impressão, senão a próxima
    // rodada acharia que está tudo em dia e nunca tentaria de novo.
    if (falhasDeVariacao.length > 0) {
      const semVariacao = falhasDeVariacao
        .map((f) => String(f.linha.tray_variant_id).replace(/^pub-/, ""))
        .filter(Boolean);
      await supabase.from("products").update({ sync_hash: null }).in("tray_id", semVariacao);
    }

    /* ------------------------------------------- desativar o que sumiu */
    const vistos = new Set(produtos.map((p) => p.id));
    const ativos = espelho.filter((l) => l.is_active);
    const sumidos = ativos.filter((l) => !vistos.has(l.tray_id));

    let desativados = 0;
    let aviso: string | null = null;

    if (sumidos.length > Math.max(20, Math.round(ativos.length * TETO_DE_DESATIVACAO))) {
      aviso =
        `A loja devolveu ${produtos.length} produtos e o portal tem ${ativos.length} ativos. ` +
        `Desativar ${sumidos.length} de uma vez parece leitura incompleta, então nada foi desativado.`;
    } else {
      for (let i = 0; i < sumidos.length; i += 100) {
        const ids = sumidos.slice(i, i + 100).map((l) => l.id);
        const { error } = await supabase
          .from("products")
          // Sem impressão, o produto que voltar para a loja é regravado inteiro.
          .update({ is_active: false, sync_hash: null, last_synced_at: agora })
          .in("id", ids);
        if (!error) desativados += ids.length;
      }
    }

    const falhas = falhasDeProduto.length;
    const primeiroErro =
      falhasDeProduto[0]
        ? `${String(falhasDeProduto[0].linha.name)}: ${falhasDeProduto[0].erro}`
        : falhasDeVariacao[0]
          ? `Variação ${String(falhasDeVariacao[0].linha.tray_variant_id)}: ${falhasDeVariacao[0].erro}`
          : null;

    const resultado: ResultadoSync = {
      ok: true,
      categorias: categorias.length,
      produtos: produtos.length - falhas,
      alterados: gravadas.length,
      desativados,
      falhas,
      primeiroErro,
      aviso,
      revalidar: telaMudou || desativados > 0 || primeiraDoDia,
      duracaoMs: Date.now() - inicio,
    };
    await registrar({ ...resultado, status: "success" });
    return resultado;
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha desconhecida na sincronização.";
    await registrar({ status: "error", erro });
    // A virada do dia não depende da loja responder: a promoção que acabou à
    // meia-noite sai da tela mesmo com a Tray fora do ar.
    return { ...vazio, erro, revalidar: primeiraDoDia, duracaoMs: Date.now() - inicio };
  }
}
