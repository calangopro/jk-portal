import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaLoja } from "@/lib/tray/lojas";
import { urlDaLoja } from "@/lib/tray/publico";
import {
  DETALHE_NAO_ENCONTRADO,
  categoriasDaArvore,
  detalheDaApi,
  quemLer,
  type Categoria,
  type DetalheDaLoja,
} from "./arquivo";

/**
 * A leitura dos detalhes dos produtos pela API da Tray, para o arquivo de
 * catálogo do Meta e do Google (migration 0130, `docs/catalogo-pelo-painel.md`).
 *
 * Um produto por chamada (`GET /products/{id}`, rota homologada), devagar de
 * propósito: o limite da Tray é de 180 chamadas por minuto e 10 mil por dia
 * por loja, e a leitura de pedidos divide esse limite. A rodada lê no máximo
 * `maximo` produtos e para antes de 45 segundos, que é o que cabe na função da
 * Vercel com folga.
 *
 * Só lê: nenhuma escrita na loja passa por aqui (quem escreve na loja é
 * `lib/loja/alterar.ts`).
 */

export type ResultadoDosDetalhes = {
  ok: boolean;
  lidos: number;
  naoEncontrados: number;
  falhas: number;
  /** Quantos ainda estavam na fila quando a rodada terminou. */
  pendentes: number;
  categorias: number;
  aviso: string | null;
  erro?: string;
  duracaoMs: number;
};

/**
 * Pausa entre uma chamada e outra. Com a resposta da Tray em perto de 100 ms,
 * dá umas 100 chamadas por minuto (medido em 17/11/2026: com 250 ms eram 165,
 * perto demais do limite de 180 que a leitura de pedidos divide).
 */
const PAUSA_MS = 500;
const TEMPO_MAXIMO_MS = 45_000;
const PAGINA = 1000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Árvore de categorias da loja pela rota pública. `[]` quando a loja não respondeu. */
async function lerArvore(): Promise<Categoria[]> {
  try {
    const resp = await fetch(`${urlDaLoja()}/web_api/categories/tree`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!resp.ok) return [];
    const tipo = resp.headers.get("content-type") ?? "";
    const texto = new TextDecoder(/iso-8859-1|latin1/i.test(tipo) ? "iso-8859-1" : "utf-8").decode(await resp.arrayBuffer());
    return categoriasDaArvore(JSON.parse(texto));
  } catch {
    return [];
  }
}

/**
 * Regrava a árvore inteira. Categoria que saiu da loja sai daqui também, mas
 * só quando a leitura veio com conteúdo: resposta vazia nunca apaga a árvore.
 */
async function guardarArvore(db: SupabaseClient, categorias: Categoria[]): Promise<string | null> {
  if (categorias.length === 0) return "A árvore de categorias da loja não respondeu; ficou a última guardada.";
  const agora = new Date().toISOString();
  const { error } = await db
    .from("catalogo_categorias")
    .upsert(categorias.map((c) => ({ tray_id: c.id, nome: c.nome, pai: c.pai, ativa: true, lida_em: agora })), { onConflict: "tray_id" });
  if (error) return `Não foi possível guardar a árvore de categorias: ${error.message}`;
  await db.from("catalogo_categorias").delete().lt("lida_em", agora);
  return null;
}

async function todasAsLinhas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
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

function linhaDoDetalhe(trayId: string, d: DetalheDaLoja, agora: string) {
  return {
    tray_id: trayId,
    encontrado: d.encontrado,
    descricao_html: d.descricaoHtml,
    imagens: d.imagens,
    referencia: d.referencia,
    modelo: d.modelo,
    ean: d.ean,
    peso: d.peso,
    comprimento: d.comprimento,
    largura: d.largura,
    altura: d.altura,
    estoque: d.estoque,
    modificado_na_loja: d.modificadoNaLoja,
    lido_em: agora,
  };
}

export async function lerDetalhesDaLoja(opcoes: { maximo?: number } = {}): Promise<ResultadoDosDetalhes> {
  const inicio = Date.now();
  const maximo = Math.min(Math.max(1, Math.trunc(opcoes.maximo ?? 40)), 200);
  const vazio = { lidos: 0, naoEncontrados: 0, falhas: 0, pendentes: 0, categorias: 0 };
  const db = createAdminClient();

  const cliente = await clienteDaLoja(db, "jk");
  if (!cliente) {
    return { ok: false, ...vazio, aviso: null, erro: "A loja da JK não está autorizada no painel (cartão da Tray em Integrações).", duracaoMs: Date.now() - inicio };
  }

  const arvore = await lerArvore();
  const avisoDaArvore = await guardarArvore(db, arvore);

  let produtos: { tray_id: string; main_image_url: string | null }[];
  let detalhes: { tray_id: string; imagens: string[] | null; lido_em: string; encontrado: boolean }[];
  try {
    [produtos, detalhes] = await Promise.all([
      todasAsLinhas<{ tray_id: string; main_image_url: string | null }>((de, ate) =>
        db.from("products").select("tray_id, main_image_url").eq("is_active", true).order("tray_id").range(de, ate),
      ),
      todasAsLinhas<{ tray_id: string; imagens: string[] | null; lido_em: string; encontrado: boolean }>((de, ate) =>
        db.from("catalogo_detalhes").select("tray_id, imagens, lido_em, encontrado").order("tray_id").range(de, ate),
      ),
    ]);
  } catch (e) {
    return { ok: false, ...vazio, aviso: avisoDaArvore, erro: `Não foi possível ler o espelho: ${(e as Error).message}`, duracaoMs: Date.now() - inicio };
  }

  const fila = quemLer(
    produtos.filter((p) => /^\d+$/.test(p.tray_id)).map((p) => ({ trayId: p.tray_id, imagemPrincipal: p.main_image_url })),
    detalhes.map((d) => ({ trayId: d.tray_id, primeiraImagem: d.imagens?.[0] ?? null, lidoEm: d.lido_em, encontrado: d.encontrado })),
    new Date(),
    Number.MAX_SAFE_INTEGER,
  );

  const linhas: ReturnType<typeof linhaDoDetalhe>[] = [];
  let falhas = 0;
  let seguidas = 0;
  let aviso: string | null = avisoDaArvore;
  let feitos = 0;

  for (const { trayId } of fila.slice(0, maximo)) {
    if (Date.now() - inicio > TEMPO_MAXIMO_MS) break;
    feitos++;
    try {
      const cru = await cliente.produto(trayId);
      linhas.push(linhaDoDetalhe(trayId, cru ? detalheDaApi(cru) : DETALHE_NAO_ENCONTRADO, new Date().toISOString()));
      seguidas = 0;
    } catch (e) {
      falhas++;
      seguidas++;
      const msg = (e as Error).message;
      if (/\b429\b/.test(msg)) {
        aviso = "A Tray pediu para ir mais devagar (429). O resto fica para a próxima rodada.";
        break;
      }
      if (seguidas >= 3) {
        aviso = `Três falhas seguidas, a rodada parou: ${msg}`;
        break;
      }
    }
    await esperar(PAUSA_MS);
  }

  if (linhas.length > 0) {
    const { error } = await db.from("catalogo_detalhes").upsert(linhas, { onConflict: "tray_id" });
    if (error) {
      return { ok: false, ...vazio, falhas, categorias: arvore.length, aviso, erro: `Não foi possível gravar os detalhes: ${error.message}`, duracaoMs: Date.now() - inicio };
    }
  }

  return {
    ok: falhas === 0 || linhas.length > 0,
    lidos: linhas.filter((l) => l.encontrado).length,
    naoEncontrados: linhas.filter((l) => !l.encontrado).length,
    falhas,
    pendentes: Math.max(0, fila.length - feitos),
    categorias: arvore.length,
    aviso,
    duracaoMs: Date.now() - inicio,
  };
}
