import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_DO_CHAT } from "@/lib/time/dados";
import { SEM_RESUMO_DO_SUPORTE, lerLista, lerResumoDoSuporte, type ListaDoSuporte, type ResumoDoSuporte } from "./casos";

/**
 * O suporte pós-venda NO SERVIDOR: a primeira leitura da tela, o número do
 * menu e o link assinado do print.
 *
 * Tudo passa por função do banco chamada com o cliente da SESSÃO, que confere
 * a área por dentro (0102). A ÚNICA coisa feita com a chave de serviço é
 * assinar o link do print, e só depois de `suporte_imagens` devolver o
 * caminho para a sessão de quem pediu: o bucket não tem policy de leitura
 * para o print dos outros, de propósito (é o mesmo bucket do chat).
 */

/** Link assinado vale uma hora: dá para abrir o print, não para guardar o endereço. */
const VALIDADE_DO_LINK_S = 3600;

export async function lerResumoDoSuporteNoServidor(db: SupabaseClient): Promise<ResumoDoSuporte> {
  const { data, error } = await db.rpc("suporte_resumo");
  if (error) {
    console.error("[suporte] resumo:", error.message);
    return SEM_RESUMO_DO_SUPORTE;
  }
  return lerResumoDoSuporte(data);
}

export async function lerListaDoSuporte(db: SupabaseClient): Promise<ListaDoSuporte | null> {
  const { data, error } = await db.rpc("suporte_lista");
  if (error) {
    console.error("[suporte] lista:", error.message);
    return null;
  }
  return lerLista(data);
}

/** Os links assinados dos prints de um caso, na ordem em que foram mandados. Vazio quando a sessão não pode ver o caso. */
export async function linksDosPrints(db: SupabaseClient, caso: number): Promise<string[]> {
  const { data, error } = await db.rpc("suporte_imagens", { p_caso: caso });
  if (error) {
    console.error("[suporte] imagens:", error.message);
    return [];
  }
  const caminhos = (Array.isArray(data) ? data : []).filter((c): c is string => typeof c === "string");
  if (caminhos.length === 0) return [];
  const { data: assinados, error: erroAoAssinar } = await createAdminClient().storage.from(BUCKET_DO_CHAT).createSignedUrls(caminhos, VALIDADE_DO_LINK_S);
  if (erroAoAssinar || !assinados) {
    console.error("[suporte] assinar:", erroAoAssinar?.message);
    return [];
  }
  return assinados.map((a) => a.signedUrl).filter((u): u is string => typeof u === "string" && u.length > 0);
}
