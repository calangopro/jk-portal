import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { miniaturaDaTray } from "@/lib/catalogo/fotos";
import {
  abaixoDoMinimo,
  custoDoProduto,
  descontoMaximo,
  margemNoPreco,
  precoComDesconto,
  terminadoEm90ParaCima,
  type CustoGravado,
  type Material,
} from "@/lib/margem/calculo";
import { lerFamilias, lerParametros } from "@/lib/margem/dados";

/**
 * Campanhas de desconto: a equipe monta, o administrador aprova, e a planilha
 * de promoção vai para a Tray. Quem garante que campanha aprovada não muda e
 * que só administrador aprova são os gatilhos da 0049/0050; aqui as funções
 * só dizem o que deu errado de um jeito legível.
 *
 * A campanha guarda o PREÇO de cada item, que é o que vai para a loja. O
 * desconto é conta, sempre sobre o preço cheio do espelho.
 */

export class ErroDeCampanha extends Error {}

import { ROTULO_DO_STATUS, STATUS, type StatusDaCampanha } from "./estados";
export { ROTULO_DO_STATUS, STATUS, type StatusDaCampanha };

export type Campanha = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  status: StatusDaCampanha;
  nota: string | null;
  criadaPor: string | null;
  enviadaEm: string | null;
  decididaPor: string | null;
  decididaEm: string | null;
  exportadaEm: string | null;
  itens: number;
};

export type ItemDaCampanha = {
  productId: string;
  trayId: string;
  nome: string;
  categoria: string;
  url: string | null;
  miniatura: string | null;
  disponivel: boolean;
  precoCheio: number | null;
  precoCampanha: number;
  desconto: number | null;
};

/**
 * O que cada item da campanha faz com a margem. O administrador recebe tudo;
 * os outros, só `situacao` (a tela de um editor nunca vê custo).
 */
export type Avaliacao = {
  situacao: "ok" | "passa" | "sem_custo";
  custo?: number;
  margem?: number;
  margemReais?: number;
  descontoMaximo?: number;
  precoMinimo?: number;
};

const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function nomes(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unicos.length) return new Map();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unicos);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email || "Alguém da equipe"]));
}

const COLUNAS =
  "id, nome, inicio, fim, status, nota, criada_por, enviada_em, decidida_por, decidida_em, exportada_em, itens:campanha_itens(count)";

type Linha = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  status: StatusDaCampanha;
  nota: string | null;
  criada_por: string | null;
  enviada_em: string | null;
  decidida_por: string | null;
  decidida_em: string | null;
  exportada_em: string | null;
  itens: { count: number }[] | { count: number } | null;
};

function paraCampanha(l: Linha, quem: Map<string, string>): Campanha {
  return {
    id: l.id,
    nome: l.nome,
    inicio: l.inicio,
    fim: l.fim,
    status: l.status,
    nota: l.nota,
    criadaPor: l.criada_por ? (quem.get(l.criada_por) ?? null) : null,
    enviadaEm: l.enviada_em,
    decididaPor: l.decidida_por ? (quem.get(l.decidida_por) ?? null) : null,
    decididaEm: l.decidida_em,
    exportadaEm: l.exportada_em,
    itens: um(l.itens)?.count ?? 0,
  };
}

export async function listarCampanhas(db: SupabaseClient): Promise<Campanha[]> {
  const { data, error } = await db.from("campanhas").select(COLUNAS).order("inicio", { ascending: false }).limit(200);
  if (error) throw new ErroDeCampanha(error.message);
  const linhas = (data ?? []) as unknown as Linha[];
  const quem = await nomes(db, linhas.flatMap((l) => [l.criada_por, l.decidida_por]));
  return linhas.map((l) => paraCampanha(l, quem));
}

export async function lerCampanha(db: SupabaseClient, id: string): Promise<{ campanha: Campanha; itens: ItemDaCampanha[] } | null> {
  const { data, error } = await db.from("campanhas").select(COLUNAS).eq("id", id).maybeSingle();
  if (error) throw new ErroDeCampanha(error.message);
  if (!data) return null;
  const l = data as unknown as Linha;
  const quem = await nomes(db, [l.criada_por, l.decidida_por]);

  const { data: itens, error: e2 } = await db
    .from("campanha_itens")
    .select(
      "product_id, preco_campanha, produto:products!inner(tray_id, name, url, status, price, main_image_url, categoria:categories!products_category_id_fkey(name))",
    )
    .eq("campanha_id", id);
  if (e2) throw new ErroDeCampanha(e2.message);

  return {
    campanha: paraCampanha(l, quem),
    itens: (itens ?? [])
      .map((i) => {
        const p = um(i.produto as unknown as {
          tray_id: string;
          name: string;
          url: string | null;
          status: string | null;
          price: number | null;
          main_image_url: string | null;
          categoria: { name: string } | { name: string }[] | null;
        });
        if (!p) return null;
        const cheio = num(p.price);
        const preco = Number(i.preco_campanha);
        return {
          productId: i.product_id,
          trayId: p.tray_id,
          nome: p.name,
          categoria: um(p.categoria)?.name ?? "Sem categoria",
          url: p.url,
          miniatura: miniaturaDaTray(p.main_image_url),
          disponivel: p.status === "available",
          precoCheio: cheio,
          precoCampanha: preco,
          desconto: cheio ? 1 - preco / cheio : null,
        } satisfies ItemDaCampanha;
      })
      .filter((x): x is ItemDaCampanha => x !== null)
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

// ------------------------------------------------------------------ avaliação

/**
 * Margem de cada item no preço da campanha. Recebe o cliente de SERVIÇO
 * (custo é só de administrador no banco) e devolve o detalhe só quando
 * `completo`, que a página liga apenas para administrador.
 */
export async function avaliarItens(
  servico: SupabaseClient,
  itens: Pick<ItemDaCampanha, "productId" | "precoCheio" | "precoCampanha">[],
  completo: boolean,
): Promise<{ porProduto: Record<string, Avaliacao>; margemMinima: number | null }> {
  if (!itens.length) return { porProduto: {}, margemMinima: null };
  const [parametros, familias, { data: custos }] = await Promise.all([
    lerParametros(servico),
    lerFamilias(servico),
    servico
      .from("produto_custos")
      .select("product_id, material, familia, gramas, resto, custo_fixo")
      .in("product_id", itens.map((i) => i.productId)),
  ]);
  const mapaFamilias = new Map(familias.map((f) => [f.codigo, f]));
  const porId = new Map(
    (custos ?? []).map((c) => [
      c.product_id,
      {
        material: c.material as Material | null,
        familia: c.familia,
        gramas: num(c.gramas),
        resto: num(c.resto),
        custoFixo: num(c.custo_fixo),
      } satisfies CustoGravado,
    ]),
  );

  const porProduto: Record<string, Avaliacao> = {};
  for (const i of itens) {
    const c = custoDoProduto(porId.get(i.productId) ?? null, mapaFamilias, parametros);
    if (c.valor === null || !i.precoCheio) {
      porProduto[i.productId] = { situacao: "sem_custo" };
      continue;
    }
    const m = margemNoPreco(i.precoCampanha, c.valor, parametros);
    const max = descontoMaximo(i.precoCheio, c.valor, parametros);
    const situacao = abaixoDoMinimo(m.fracao, parametros) ? "passa" : "ok";
    porProduto[i.productId] = completo
      ? {
          situacao,
          custo: c.valor,
          margem: m.fracao,
          margemReais: m.reais,
          descontoMaximo: max,
          precoMinimo: terminadoEm90ParaCima(i.precoCheio * (1 - max)),
        }
      : { situacao };
  }
  return { porProduto, margemMinima: parametros.margemMinima };
}

// ------------------------------------------------------------------ escrita

/** O gatilho do banco recusa com 42501; aqui vira frase. */
function traduzir(e: { message: string; code?: string } | null): never | void {
  if (!e) return;
  throw new ErroDeCampanha(e.code === "42501" ? e.message.replace(/^.*?: /, "") : e.message);
}

function conferirDatas(inicio: string, fim: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) throw new ErroDeCampanha("Datas inválidas.");
  if (fim < inicio) throw new ErroDeCampanha("A campanha termina antes de começar.");
}

export async function criarCampanha(db: SupabaseClient, a: { nome: string; inicio: string; fim: string }, quem: string) {
  const nome = a.nome.trim();
  if (nome.length < 2) throw new ErroDeCampanha("Dê um nome à campanha.");
  conferirDatas(a.inicio, a.fim);
  const { data, error } = await db
    .from("campanhas")
    .insert({ nome: nome.slice(0, 80), inicio: a.inicio, fim: a.fim, criada_por: quem })
    .select("id")
    .single();
  traduzir(error);
  return data!.id as string;
}

export async function editarCampanha(db: SupabaseClient, id: string, a: { nome: string; inicio: string; fim: string }) {
  conferirDatas(a.inicio, a.fim);
  const { error } = await db.from("campanhas").update({ nome: a.nome.trim().slice(0, 80), inicio: a.inicio, fim: a.fim }).eq("id", id);
  traduzir(error);
}

async function precosCheios(db: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("products").select("id, price").in("id", ids.slice(i, i + 300));
    for (const p of data ?? []) if (p.price) mapa.set(p.id, Number(p.price));
  }
  return mapa;
}

/** Entra com o desconto pedido, já em ,90. Produto que já está fica com o preço novo. */
export async function adicionarProdutos(db: SupabaseClient, id: string, productIds: string[], desconto: number, quem: string) {
  if (!(desconto >= 0 && desconto < 0.95)) throw new ErroDeCampanha("Desconto entre 0% e 95%.");
  const cheios = await precosCheios(db, productIds);
  const linhas = productIds
    .filter((p) => cheios.has(p))
    .map((p) => ({
      campanha_id: id,
      product_id: p,
      preco_campanha: precoComDesconto(cheios.get(p)!, desconto),
      adicionado_por: quem,
    }));
  for (let i = 0; i < linhas.length; i += 300) {
    const { error } = await db.from("campanha_itens").upsert(linhas.slice(i, i + 300), { onConflict: "campanha_id,product_id" });
    traduzir(error);
  }
  return linhas.length;
}

export async function definirPreco(db: SupabaseClient, id: string, productId: string, preco: number) {
  if (!(preco > 0)) throw new ErroDeCampanha("Preço inválido.");
  const { error } = await db
    .from("campanha_itens")
    .update({ preco_campanha: Math.round(preco * 100) / 100 })
    .eq("campanha_id", id)
    .eq("product_id", productId);
  traduzir(error);
}

/** Muda vários preços de uma vez (desconto para todos, ajustar ao máximo). */
export async function definirPrecos(db: SupabaseClient, id: string, precos: { productId: string; preco: number }[]) {
  const linhas = precos.map((p) => ({ campanha_id: id, product_id: p.productId, preco_campanha: Math.round(p.preco * 100) / 100 }));
  for (let i = 0; i < linhas.length; i += 300) {
    const { error } = await db.from("campanha_itens").upsert(linhas.slice(i, i + 300), { onConflict: "campanha_id,product_id" });
    traduzir(error);
  }
}

export async function aplicarDesconto(db: SupabaseClient, id: string, desconto: number) {
  if (!(desconto >= 0 && desconto < 0.95)) throw new ErroDeCampanha("Desconto entre 0% e 95%.");
  const { data } = await db.from("campanha_itens").select("product_id").eq("campanha_id", id);
  const ids = (data ?? []).map((d) => d.product_id);
  const cheios = await precosCheios(db, ids);
  await definirPrecos(
    db,
    id,
    ids.filter((p) => cheios.has(p)).map((p) => ({ productId: p, preco: precoComDesconto(cheios.get(p)!, desconto) })),
  );
}

export async function removerProdutos(db: SupabaseClient, id: string, productIds: string[]) {
  const { error } = await db.from("campanha_itens").delete().eq("campanha_id", id).in("product_id", productIds);
  traduzir(error);
}

/**
 * Muda o estado. O banco barra o que não é permitido (aprovar e reabrir são
 * de administrador); aqui só se preenchem as datas e quem decidiu.
 */
export async function mudarStatus(
  db: SupabaseClient,
  id: string,
  para: StatusDaCampanha,
  quem: string,
  nota?: string | null,
) {
  const agora = new Date().toISOString();
  const linha: Record<string, unknown> = { status: para };
  if (nota !== undefined) linha.nota = nota?.trim().slice(0, 1000) || null;
  if (para === "em_aprovacao") linha.enviada_em = agora;
  if (para === "aprovada" || (para === "rascunho" && nota)) {
    linha.decidida_por = quem;
    linha.decidida_em = agora;
  }
  const { error } = await db.from("campanhas").update(linha).eq("id", id);
  traduzir(error);
}

export async function marcarExportada(db: SupabaseClient, id: string) {
  const { error } = await db.from("campanhas").update({ exportada_em: new Date().toISOString() }).eq("id", id);
  traduzir(error);
}
