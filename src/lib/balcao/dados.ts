import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadDoBalcao, PedidoDoBalcao, VendedorDaLoja } from "./regras";

/**
 * As leituras e as escritas do balcão da loja (cartão 71, 0198). Tudo passa
 * pelas funções do banco, com a sessão de quem está logado: elas conferem a
 * área `balcao` e a loja por dentro. A chave de serviço só entra para ASSINAR
 * link de arquivo, depois de o banco dizer que a pessoa pode.
 */

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** A mensagem que o banco escreveu para a pessoa (raise exception com 22023 ou 42501), ou uma frase genérica. */
export function erroDoBanco(e: { message?: string; code?: string } | null, padrao = "Não deu para salvar agora. Tente de novo."): string {
  if (!e) return padrao;
  if ((e.code === "22023" || e.code === "42501" || e.code === "P0001") && e.message) return e.message;
  console.error("[balcao]", e.code, e.message);
  return padrao;
}

export async function lerMinhaLoja(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.rpc("minha_loja");
  if (error) return null;
  return typeof data === "string" && data ? data : null;
}

export async function lerListaDoBalcao(db: SupabaseClient, loja: string | null, dias = 30, busca: string | null = null): Promise<PedidoDoBalcao[] | null> {
  const { data, error } = await db.rpc("balcao_lista", { p_loja: loja, p_dias: dias, p_busca: busca });
  if (error) {
    console.error("[balcao] lista:", error.message);
    return null;
  }
  return (data ?? []) as PedidoDoBalcao[];
}

export async function lerPedidoDoBalcao(db: SupabaseClient, id: string): Promise<PedidoDoBalcao | null> {
  const { data, error } = await db.rpc("balcao_pedido", { p_id: id });
  if (error) {
    console.error("[balcao] pedido:", error.message);
    return null;
  }
  return (data ?? null) as PedidoDoBalcao | null;
}

export async function lerLeadsDoBalcao(db: SupabaseClient, loja: string | null, dias = 30): Promise<LeadDoBalcao[]> {
  const { data, error } = await db.rpc("balcao_leads", { p_loja: loja, p_dias: dias });
  if (error) {
    console.error("[balcao] leads:", error.message);
    return [];
  }
  return (data ?? []) as LeadDoBalcao[];
}

export async function lerVendedores(db: SupabaseClient, loja: string | null): Promise<VendedorDaLoja[]> {
  const { data, error } = await db.rpc("balcao_vendedores", { p_loja: loja });
  if (error) {
    console.error("[balcao] vendedores:", error.message);
    return [];
  }
  return (data ?? []) as VendedorDaLoja[];
}

/** Uma chamada que devolve o pedido montado, com a mensagem do banco no erro. */
export async function chamar(db: SupabaseClient, funcao: string, args: Record<string, unknown>): Promise<Resultado<PedidoDoBalcao>> {
  const { data, error } = await db.rpc(funcao, args);
  if (error) return { ok: false, erro: erroDoBanco(error) };
  return { ok: true, dados: data as PedidoDoBalcao };
}

const FOTO_DA_OS = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
const ARQUIVO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

/**
 * Link de uma hora para ver um arquivo do pedido. A foto do pedido escrito
 * mora no balde da fábrica (é a mesma da OS); o resto, no balde do balcão.
 * A foto que a própria pessoa acabou de tirar (pedido ainda não salvo) está na
 * pasta dela; o resto só abre depois de o banco dizer que é de um pedido que
 * ela vê.
 */
export async function assinarArquivo(db: SupabaseClient, caminho: string): Promise<string | null> {
  if (typeof caminho !== "string" || !ARQUIVO.test(caminho)) return null;
  const admin = createAdminClient();
  const { data: u } = await db.auth.getUser();
  if (u.user && FOTO_DA_OS.test(caminho) && caminho.startsWith(`${u.user.id}/`)) {
    const { data } = await admin.storage.from("fabrica-os").createSignedUrl(caminho, 3600);
    return data?.signedUrl ?? null;
  }
  const { data: pode, error } = await db.rpc("balcao_arquivo_permitido", { p_caminho: caminho });
  if (error || pode !== true) return null;
  for (const balde of ["loja-pedidos", "fabrica-os"]) {
    const { data } = await admin.storage.from(balde).createSignedUrl(caminho, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

const EXTENSOES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const;
export type TipoDeArquivo = keyof typeof EXTENSOES;
export const ehTipoDeArquivo = (t: unknown): t is TipoDeArquivo => typeof t === "string" && t in EXTENSOES;

/**
 * Endereço assinado para o navegador subir um arquivo direto para o balde, na
 * pasta do pedido. O pedido pode ainda não existir (o id nasceu no navegador):
 * é o que deixa anexar o comprovante enquanto preenche. O banco confere o
 * arquivo de novo quando ele é registrado.
 */
export async function enderecoParaSubir(db: SupabaseClient, pedido: string, tipo: TipoDeArquivo): Promise<Resultado<{ caminho: string; token: string }>> {
  if (!/^[0-9a-f-]{36}$/.test(pedido)) return { ok: false, erro: "Pedido inválido. Recarregue a tela." };
  const { data: pode, error } = await db.rpc("balcao_pode_subir", { p_pedido: pedido });
  if (error || pode !== true) return { ok: false, erro: "Seu acesso não anexa neste pedido." };
  const caminho = `${pedido}/${randomUUID()}.${EXTENSOES[tipo]}`;
  const { data, error: e2 } = await createAdminClient().storage.from("loja-pedidos").createSignedUploadUrl(caminho);
  if (e2 || !data?.token) {
    console.error("[balcao] endereço para subir:", e2?.message);
    return { ok: false, erro: "Não deu para preparar o envio do arquivo. Tente de novo." };
  }
  return { ok: true, dados: { caminho, token: data.token } };
}
