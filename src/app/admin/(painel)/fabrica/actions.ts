"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import {
  REF_DA_FABRICA, darCienciaNaFabrica, marcarTrabalhoDaFabrica, moverPedidoDaFabrica, moverPedidosDaFabrica, salvarEtapasDaFabrica,
} from "@/lib/fabrica/dados";
import { PRIORIDADES, TIPOS, lerEtapa, type Prioridade, type TipoDeTrabalho } from "@/lib/fabrica/etapas";
import { emitirGarantia } from "@/lib/garantia/dados";
import { assinarFoto } from "@/lib/fabrica/foto-do-pedido";
import { createClient } from "@/lib/supabase/server";

/**
 * As ações da fila da fábrica: mover, anotar, marcar tipo, prioridade e prazo,
 * e editar as etapas.
 *
 * A área é conferida aqui e de novo dentro da função do banco, que é quem
 * grava e quem guarda o nome de quem mexeu.
 */
export async function moverPedido(
  ref: string,
  etapa: string,
  extras: { rastreio?: string; nota?: string } = {},
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  const destino = lerEtapa(etapa);
  if (!destino || typeof ref !== "string" || !REF_DA_FABRICA.test(ref)) return { ok: false, erro: "Pedido ou etapa inválidos." };
  const r = await moverPedidoDaFabrica(await createClient(), {
    ref,
    etapa: destino,
    rastreio: extras.rastreio?.slice(0, 80),
    nota: extras.nota?.slice(0, 500),
  });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

/** O máximo de pedidos numa leva. É o mesmo teto da função do banco. */
const TETO_DA_LEVA = 200;

/**
 * Move vários pedidos de uma vez para a mesma etapa. Feito para pôr a fila em
 * dia (marcar como enviado o que já saiu) sem abrir pedido por pedido. Não
 * mexe em rastreio nem em anotação.
 */
export async function moverVarios(
  refs: string[],
  etapa: string,
): Promise<{ ok: true; movidos: number; fora: number } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  const destino = lerEtapa(etapa);
  const lista = [...new Set(Array.isArray(refs) ? refs : [])].filter((r) => typeof r === "string" && REF_DA_FABRICA.test(r));
  if (!destino || lista.length === 0) return { ok: false, erro: "Escolha pelo menos um pedido e a etapa." };
  if (lista.length > TETO_DA_LEVA) return { ok: false, erro: `Dá para mover até ${TETO_DA_LEVA} pedidos por vez.` };
  const r = await moverPedidosDaFabrica(await createClient(), { refs: lista, etapa: destino });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Tipo, prioridade e prazo de um trabalho. Prazo vazio apaga. */
export async function marcarTrabalho(
  ref: string,
  a: { tipo: string; prioridade: string; prazo: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  if (typeof ref !== "string" || !REF_DA_FABRICA.test(ref)) return { ok: false, erro: "Pedido inválido." };
  const tipo = TIPOS.find((t) => t.chave === a?.tipo)?.chave as TipoDeTrabalho | undefined;
  const prioridade = PRIORIDADES.find((p) => p.chave === a?.prioridade)?.chave as Prioridade | undefined;
  if (!tipo || !prioridade) return { ok: false, erro: "Escolha o tipo e a prioridade." };
  const prazo = typeof a.prazo === "string" && DIA.test(a.prazo) ? a.prazo : undefined;
  const r = await marcarTrabalhoDaFabrica(await createClient(), { ref, tipo, prioridade, prazo, semPrazo: !prazo });
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

export type EtapaParaSalvar = { chave: string | null; nome: string; frase: string | null; cor: string; ativa: boolean };

/**
 * Grava a lista inteira de etapas, na ordem. Diretoria e gerente; a função do
 * banco confere de novo e diz o que está errado (entrada fora do começo,
 * etapa com trabalho sendo desligada).
 */
export async function salvarEtapas(etapas: EtapaParaSalvar[]): Promise<{ ok: true } | { ok: false; erro: string }> {
  const quem = await requireArea("fabrica");
  if (!ehAdmin(quem.role) && quem.role !== "gerente") return { ok: false, erro: "Só a diretoria e o gerente mudam as etapas." };
  if (!Array.isArray(etapas) || etapas.length < 2 || etapas.length > 20) return { ok: false, erro: "Mande de 2 a 20 etapas." };
  const lista = etapas.map((e) => ({
    chave: typeof e?.chave === "string" && lerEtapa(e.chave) ? e.chave : null,
    nome: String(e?.nome ?? "").trim().slice(0, 40),
    frase: typeof e?.frase === "string" && e.frase.trim() ? e.frase.trim().slice(0, 120) : null,
    cor: typeof e?.cor === "string" && /^#[0-9a-f]{6}$/i.test(e.cor) ? e.cor.toLowerCase() : "#5b6472",
    ativa: e?.ativa !== false,
  }));
  if (lista.some((e) => /[—–]/.test(e.nome) || /[—–]/.test(e.frase ?? ""))) return { ok: false, erro: "Sem travessão no nome nem na frase da etapa." };
  const r = await salvarEtapasDaFabrica(await createClient(), lista);
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

/** A fábrica viu o pedido de alteração do cliente (0192). */
export async function darCiencia(id: number): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, erro: "Alteração inválida." };
  const r = await darCienciaNaFabrica(await createClient(), id);
  if (r.ok) revalidatePath("/admin/fabrica");
  return r;
}

/** Emite (ou devolve) a garantia digital do trabalho (0194) e diz o código para o cartão. */
export async function emitirGarantiaNaFabrica(ref: string): Promise<{ ok: true; codigo: string } | { ok: false; erro: string }> {
  await requireArea("fabrica");
  if (typeof ref !== "string" || !REF_DA_FABRICA.test(ref)) return { ok: false, erro: "Pedido inválido." };
  return emitirGarantia(await createClient(), ref);
}

/** Link de uma hora para ver a foto do pedido escrito (0195). */
export async function verFotoNaFabrica(caminho: string): Promise<string | null> {
  await requireArea("fabrica");
  if (typeof caminho !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(caminho)) return null;
  return assinarFoto(await createClient(), caminho);
}
