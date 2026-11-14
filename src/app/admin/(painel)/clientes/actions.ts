"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { buscarClientes, marcarOportunidade, salvarFicha, type CamposDaFicha, type ResumoDoCliente } from "@/lib/clientes/dados";
import { interpretarBusca, lerRef } from "@/lib/clientes/identidade";
import { lerDataParcial, lerFase, lerTipo } from "@/lib/clientes/oportunidades";
import { createClient } from "@/lib/supabase/server";

/**
 * As ações da ficha do cliente e das oportunidades.
 *
 * A área é conferida aqui e de novo dentro de cada função do banco, que é quem
 * lê, grava e guarda o nome de quem alterou.
 *
 * A BUSCA É AÇÃO, e não endereço com `?q=`, de propósito: o que se digita ali é
 * nome, telefone ou e-mail de cliente, e endereço fica no histórico do
 * navegador e no registro do servidor.
 */

export type Gravacao = { ok: true } | { ok: false; erro: string };

/** `null`: não deu para ler. Lista vazia: ninguém casou com a busca. */
export async function buscar(q: string): Promise<ResumoDoCliente[] | null> {
  await requireArea("lancar_venda");
  const busca = interpretarBusca(String(q ?? ""));
  if (!busca) return [];
  return buscarClientes(await createClient(), busca);
}

const DATAS = ["aniversario", "aniversario_par", "data_namoro", "data_casamento"] as const;

/**
 * Grava só os campos que vierem. Tudo é conferido de novo aqui, porque o que
 * chega de um componente de cliente é o que o navegador quiser mandar.
 */
export async function salvar(ref: string, campos: CamposDaFicha): Promise<Gravacao> {
  await requireArea("lancar_venda");
  if (!lerRef(ref)) return { ok: false, erro: "Não achei este cliente. Volte para a busca e abra a ficha de novo." };

  const limpo: CamposDaFicha = {};
  if ("fase" in campos) {
    const fase = lerFase(campos.fase);
    if (!fase) return { ok: false, erro: "Escolha uma das fases da lista." };
    limpo.fase = fase;
  }
  for (const campo of DATAS) {
    if (!(campo in campos)) continue;
    const v = campos[campo] ?? null;
    if (v !== null && !lerDataParcial(v)) return { ok: false, erro: "Uma das datas não existe no calendário. Escreva como 12/06 ou 12/06/2024." };
    limpo[campo] = v;
  }
  if ("recusar_data" in campos) {
    if (!lerDataParcial(campos.recusar_data)) return { ok: false, erro: "Não deu para recusar esta data." };
    limpo.recusar_data = campos.recusar_data;
  }
  if ("par_nome" in campos) limpo.par_nome = String(campos.par_nome ?? "").trim().slice(0, 120) || null;
  if ("anotacoes" in campos) limpo.anotacoes = String(campos.anotacoes ?? "").trim().slice(0, 2000) || null;
  if ("responsavel_id" in campos) limpo.responsavel_id = campos.responsavel_id ? String(campos.responsavel_id) : null;
  if (Object.keys(limpo).length === 0) return { ok: true };

  const r = await salvarFicha(await createClient(), ref, limpo);
  if (r.ok) {
    revalidatePath(`/admin/clientes/${ref}`);
    revalidatePath("/admin/clientes");
    revalidatePath("/admin/oportunidades");
    revalidatePath("/admin");
  }
  return r;
}

/** "Já falei", "não vale" ou desfazer (reabrir) uma ocorrência de oportunidade. */
export async function marcar(ref: string, tipo: string, ocorrencia: string, decisao: string): Promise<Gravacao> {
  await requireArea("lancar_venda");
  const t = lerTipo(tipo);
  if (!lerRef(ref) || !t || !/^\d{4}-\d{2}-\d{2}$/.test(ocorrencia) || (decisao !== "falei" && decisao !== "nao_vale" && decisao !== "reaberta")) {
    return { ok: false, erro: "Não deu para marcar: os dados da oportunidade chegaram incompletos." };
  }
  const r = await marcarOportunidade(await createClient(), { ref, tipo: t, ocorrencia, decisao });
  if (r.ok) {
    revalidatePath("/admin/oportunidades");
    revalidatePath(`/admin/clientes/${ref}`);
    revalidatePath("/admin");
  }
  return r;
}
