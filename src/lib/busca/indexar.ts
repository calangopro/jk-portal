import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Content, Location } from "@/lib/content/types";
import { trechosDaLoja, trechosDoGuia, type Trecho } from "./trechos";
import { comContexto, gerarEmbeddings, paraVetorSql } from "./embeddings";

/**
 * Mantém o índice da busca em dia.
 *
 * Usa a service_role de propósito: a indexação roda dentro da publicação, e
 * uma falha de permissão aqui deixaria a busca em silêncio desatualizada, que é
 * o pior defeito possível numa busca (ela responde, só que errado).
 */

export type ResultadoIndexacao = {
  gravados: number;
  reaproveitados: number;
  /** Embedding não foi gerado. A busca continua funcionando por texto. */
  semVetor: boolean;
};

type Alvo =
  | { tipo: "guia"; contentId: string; slug: string; titulo: string }
  | { tipo: "loja"; locationId: string; slug: string; titulo: string };

async function gravar(alvo: Alvo, trechos: Trecho[]): Promise<ResultadoIndexacao> {
  const supabase = createAdminClient();
  const coluna = alvo.tipo === "guia" ? "content_id" : "location_id";
  const id = alvo.tipo === "guia" ? alvo.contentId : alvo.locationId;

  // Nada a indexar: limpa o que existia e sai. É o caminho de despublicar.
  if (trechos.length === 0) {
    await supabase.from("search_chunks").delete().eq(coluna, id);
    return { gravados: 0, reaproveitados: 0, semVetor: false };
  }

  // O que já está gravado, para não pagar embedding de trecho que não mudou.
  // Numa republicação típica muda uma ou duas seções de quinze.
  const { data: existentes } = await supabase
    .from("search_chunks")
    .select("hash, embedding")
    .eq(coluna, id);

  const jaTem = new Map<string, unknown>();
  for (const linha of (existentes ?? []) as { hash: string; embedding: unknown }[]) {
    if (linha.embedding) jaTem.set(linha.hash, linha.embedding);
  }

  const novos = trechos.filter((t) => !jaTem.has(t.hash));
  const vetoresNovos = await gerarEmbeddings(
    novos.map((t) => comContexto(alvo.titulo, t.secao, t.texto)),
  );
  const semVetor = vetoresNovos === null;

  const porHash = new Map<string, string>();
  if (vetoresNovos) {
    novos.forEach((t, i) => {
      const v = vetoresNovos[i];
      if (v) porHash.set(t.hash, paraVetorSql(v));
    });
  }

  const linhas = trechos.map((t) => ({
    [coluna]: id,
    tipo: alvo.tipo,
    slug: alvo.slug,
    titulo: alvo.titulo,
    secao: t.secao,
    ancora: t.ancora,
    origem: t.origem,
    ordem: t.ordem,
    texto: t.texto,
    hash: t.hash,
    embedding: porHash.get(t.hash) ?? (jaTem.get(t.hash) as string | undefined) ?? null,
  }));

  // Troca em bloco: apaga e regrava. A alternativa seria casar por `ordem`, mas
  // uma seção inserida no meio deslocaria todas as seguintes e o `upsert` daria
  // conflito. O índice é derivado, reconstruir é barato e não perde nada.
  const { error: erroApagar } = await supabase.from("search_chunks").delete().eq(coluna, id);
  if (erroApagar) throw new Error(`Não consegui limpar o índice: ${erroApagar.message}`);

  const { error } = await supabase.from("search_chunks").insert(linhas);
  if (error) throw new Error(`Não consegui gravar o índice: ${error.message}`);

  return { gravados: linhas.length, reaproveitados: linhas.length - novos.length, semVetor };
}

export async function indexarGuia(guia: Content): Promise<ResultadoIndexacao> {
  // Só conteúdo publicado entra. Rascunho no índice vazaria texto não revisado
  // para a busca pública, e o filtro por status dentro da varredura vetorial é
  // justamente o que faz o pgvector abandonar o índice.
  if (guia.status !== "published") {
    return gravar({ tipo: "guia", contentId: guia.id, slug: guia.slug, titulo: guia.title }, []);
  }
  return gravar(
    { tipo: "guia", contentId: guia.id, slug: guia.slug, titulo: guia.title },
    trechosDoGuia(guia),
  );
}

export async function indexarLoja(loja: Location): Promise<ResultadoIndexacao> {
  const alvo: Alvo = { tipo: "loja", locationId: loja.id, slug: loja.slug, titulo: loja.name };
  if (loja.status !== "published") return gravar(alvo, []);
  return gravar(alvo, trechosDaLoja(loja));
}

/** Tira do índice o que deixou de ser público, sem depender de quem apagou. */
export async function removerDoIndice(tipo: "guia" | "loja", id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("search_chunks")
    .delete()
    .eq(tipo === "guia" ? "content_id" : "location_id", id);
}
