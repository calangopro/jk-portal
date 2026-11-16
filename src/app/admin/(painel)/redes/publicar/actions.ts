"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { conferirSubida, prepararEnvio, type EnvioPreparado } from "@/lib/redes/armazenamento";
import { processarFila } from "@/lib/redes/fila";
import { apagarPost, cancelarPost, criarPost, liberarPost, salvarPost, type DadosDoPost } from "@/lib/redes/posts";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As ações da tela de publicar. Todas pedem a área `redes` e chamam o núcleo
 * (`lib/redes/posts.ts`), que é onde moram as travas: a tela não confere nada
 * que o núcleo não confira de novo.
 *
 * Publicar e agendar gravam QUEM mandou. Nada sai sem esse clique.
 */

export type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

function atualizar() {
  revalidatePath("/admin/redes", "layout");
}

/** Prepara a subida de um arquivo: devolve o endereço assinado para o navegador mandar direto ao armazenamento. */
export async function prepararSubida(arquivo: { mime: string; tamanho: number }): Promise<Resposta<{ envio: EnvioPreparado }>> {
  await requireArea("redes");
  const r = await prepararEnvio(createAdminClient(), { mime: String(arquivo?.mime ?? ""), tamanho: Number(arquivo?.tamanho) || 0 });
  return "erro" in r ? { ok: false, erro: r.erro } : { ok: true, envio: r };
}

/** Confere que o arquivo chegou ao armazenamento e devolve o tamanho medido lá. */
export async function confirmarSubida(urlPublica: string): Promise<Resposta<{ tamanho: number }>> {
  await requireArea("redes");
  const r = await conferirSubida(String(urlPublica ?? ""));
  return r ? { ok: true, tamanho: r.tamanho } : { ok: false, erro: "O arquivo não chegou ao armazenamento. Envie de novo." };
}

/** Salva o rascunho. Sem `id`, cria. */
export async function salvarRascunho(id: string | null, dados: DadosDoPost): Promise<Resposta<{ id: string }>> {
  const perfil = await requireArea("redes");
  const db = createAdminClient();
  if (!id) {
    const r = await criarPost(db, { id: perfil.id, origem: "painel" }, dados);
    if (r.ok) atualizar();
    return r;
  }
  const r = await salvarPost(db, id, dados);
  if (!r.ok) return r;
  atualizar();
  return { ok: true, id };
}

/**
 * Salva e LIBERA: sai agora (`quando` nulo) ou na hora marcada. É o ato que
 * põe o post na rua, e fica gravado quem fez.
 *
 * "Agora" não espera o relógio: a fila deste post roda logo depois da
 * resposta. Se essa rodada falhar por qualquer motivo, o relógio pega no
 * minuto seguinte.
 */
export async function salvarELiberar(
  id: string | null,
  dados: DadosDoPost,
  quando: string | null,
): Promise<{ ok: true; id: string; quando: string; contas: string[] } | { ok: false; erro: string; id?: string }> {
  const perfil = await requireArea("redes");
  const db = createAdminClient();
  const quem = { id: perfil.id, origem: "painel" as const };

  let postId = id;
  if (!postId) {
    const criado = await criarPost(db, quem, dados);
    if (!criado.ok) return criado;
    postId = criado.id;
  } else {
    const salvo = await salvarPost(db, postId, dados);
    if (!salvo.ok) return salvo;
  }

  const hora = quando ? new Date(quando) : null;
  const r = await liberarPost(db, quem, postId, hora);
  atualizar();
  // O rascunho já está salvo mesmo se a liberação for recusada: a pessoa conserta e manda de novo. O id volta
  // junto, senão a tela, que ainda não o conhece, criaria OUTRO rascunho na tentativa seguinte.
  if (!r.ok) return { ok: false, erro: r.erro, id: postId };
  if (!hora) {
    const post = postId;
    after(async () => {
      await processarFila(db, { postId: post }).catch((e) => console.error("[redes] publicar agora:", e));
    });
  }
  return { ok: true, id: postId, quando: r.quando, contas: r.contas };
}

/** Libera um post que já está salvo (rascunho ou com erro), sem mexer no conteúdo. */
export async function liberar(id: string, quando: string | null): Promise<Resposta<{ quando: string; contas: string[] }>> {
  const perfil = await requireArea("redes");
  const db = createAdminClient();
  const hora = quando ? new Date(quando) : null;
  const r = await liberarPost(db, { id: perfil.id, origem: "painel" }, String(id ?? ""), hora);
  atualizar();
  if (!r.ok) return r;
  if (!hora) {
    after(async () => {
      await processarFila(db, { postId: id }).catch((e) => console.error("[redes] publicar agora:", e));
    });
  }
  return r;
}

/** Tira o post da fila. O que já saiu numa rede continua lá. */
export async function cancelar(id: string): Promise<Resposta<{ cancelados: number }>> {
  await requireArea("redes");
  const r = await cancelarPost(createAdminClient(), String(id ?? ""));
  atualizar();
  return r;
}

/** Apaga um post que nunca saiu, com as mídias dele. */
export async function apagar(id: string): Promise<Resposta> {
  await requireArea("redes");
  const r = await apagarPost(createAdminClient(), String(id ?? ""));
  atualizar();
  return r;
}
