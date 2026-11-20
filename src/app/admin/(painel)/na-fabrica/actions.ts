"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { REF_DA_FABRICA, abrirOsDaFabrica, pedirAlteracaoNaFabrica } from "@/lib/fabrica/dados";
import { PRIORIDADES, TIPOS, type Prioridade, type TipoDeTrabalho } from "@/lib/fabrica/etapas";
import { lerProducao } from "@/lib/vendas/producao";
import { createClient } from "@/lib/supabase/server";

/**
 * As ações de quem vende na fábrica (cartão 63): abrir OS de troca, refazer,
 * ajuste, upgrade, polimento ou serviço, e pedir alteração num pedido que já
 * está lá. Mover continua sendo só da fábrica. A área é conferida aqui e de
 * novo nas funções do banco.
 */

const texto = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export type AbrirOs = (dados: FormData) => Promise<{ ok: true; os: number } | { ok: false; erro: string }>;

export async function abrirOs(dados: FormData): Promise<{ ok: true; os: number } | { ok: false; erro: string }> {
  await requireArea("lancar_venda");
  const tipo = TIPOS.find((t) => t.chave === dados.get("tipo"))?.chave as TipoDeTrabalho | undefined;
  const prioridade = PRIORIDADES.find((p) => p.chave === dados.get("prioridade"))?.chave as Prioridade | undefined;
  if (!tipo || !prioridade) return { ok: false, erro: "Escolha o tipo e a prioridade." };
  const prazo = texto(dados.get("prazo"), 10);
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return { ok: false, erro: "Prazo inválido." };
  const origemCru = texto(dados.get("pedido_origem"), 12);
  if (origemCru && !/^[0-9]{1,12}$/.test(origemCru)) return { ok: false, erro: "O pedido de origem é só o número." };
  let producaoCrua: unknown = null;
  try {
    producaoCrua = JSON.parse(String(dados.get("producao") ?? ""));
  } catch {
    return { ok: false, erro: "Diga pelo menos uma peça para a fábrica." };
  }
  const lida = lerProducao(producaoCrua);
  if (!lida.ok) return lida;
  const p = lida.producao;
  const r = await abrirOsDaFabrica(await createClient(), {
    tipo,
    prioridade,
    prazo,
    pedidoOrigem: origemCru ? Number(origemCru) : null,
    clienteNome: texto(dados.get("cliente_nome"), 120),
    clienteTelefone: texto(dados.get("cliente_telefone"), 30),
    relato: texto(dados.get("relato"), 1000),
    pecas: p.pecas,
    entrega: p.entrega,
    endereco: p.endereco,
    cidade: p.cidade,
    uf: p.uf,
    numeroPapel: texto(dados.get("numero_papel"), 30),
  });
  if (!r.ok) return r;
  revalidatePath("/admin/na-fabrica");
  revalidatePath("/admin/fabrica");
  return { ok: true, os: r.os };
}

export type PedirAlteracao = (ref: string, texto: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

export async function pedirAlteracao(ref: string, pedido: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("lancar_venda");
  if (typeof ref !== "string" || !REF_DA_FABRICA.test(ref)) return { ok: false, erro: "Pedido inválido." };
  const t = typeof pedido === "string" ? pedido.trim() : "";
  if (t.length < 3 || t.length > 500) return { ok: false, erro: "Escreva a alteração em até 500 letras." };
  if (/[—–]/.test(t)) return { ok: false, erro: "Sem travessão no texto." };
  const r = await pedirAlteracaoNaFabrica(await createClient(), ref, t);
  if (r.ok) {
    revalidatePath("/admin/na-fabrica");
    revalidatePath("/admin/fabrica");
  }
  return r;
}
