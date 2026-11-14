"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { conferirResposta, lerEstado, lerTema, type RascunhoDeResposta } from "@/lib/time/biblioteca";
import { definirEstadoDaResposta, editarResposta, sugerirResposta, type TextosDaResposta } from "@/lib/time/dados";

type Feito = { ok: true } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, teto: number): string => (typeof v === "string" ? v.trim().slice(0, teto) : "");

/** O que veio do navegador, conferido. Devolve a mensagem para a pessoa quando falta alguma coisa. */
function ler(r: RascunhoDeResposta): { textos: TextosDaResposta } | { erro: string } {
  const limpo = {
    tema: texto(r?.tema, 40),
    pergunta: texto(r?.pergunta, 300),
    explicacao: texto(r?.explicacao, 4000),
    frase: texto(r?.frase, 2000),
    origem: texto(r?.origem, 300),
  };
  const erro = conferirResposta(limpo);
  const tema = lerTema(limpo.tema);
  if (erro || !tema) return { erro: erro ?? "Escolha o tema da resposta." };
  return { textos: { ...limpo, tema } };
}

/**
 * Sugere uma resposta para a biblioteca. Qualquer pessoa ativa pode: ela entra
 * como "a confirmar". A área é conferida aqui e de novo dentro da função do
 * banco, que é quem grava e quem guarda o autor.
 */
export async function sugerir(r: RascunhoDeResposta): Promise<Feito> {
  await requireArea("time");
  const lido = ler(r);
  if ("erro" in lido) return { ok: false, erro: lido.erro };
  const feito = await sugerirResposta(await createClient(), lido.textos);
  if (!feito.ok) return feito;
  revalidatePath("/admin/biblioteca");
  return { ok: true };
}

/**
 * Edita uma resposta. Quem pode é decisão do banco: a diretoria edita qualquer
 * uma, e quem sugeriu edita a própria enquanto ela está "a confirmar".
 */
export async function editar(id: string, r: RascunhoDeResposta): Promise<Feito> {
  await requireArea("time");
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, erro: "Resposta inválida." };
  const lido = ler(r);
  if ("erro" in lido) return { ok: false, erro: lido.erro };
  const feito = await editarResposta(await createClient(), id, lido.textos);
  if (feito.ok) revalidatePath("/admin/biblioteca");
  return feito;
}

/** Confirma, arquiva ou devolve para "a confirmar". Só administrador, dono e GM, aqui e no banco. */
export async function definirEstado(id: string, estado: string): Promise<Feito> {
  const perfil = await requireArea("time");
  if (!ehAdmin(perfil.role)) return { ok: false, erro: "Só administrador, dono ou GM confirma ou arquiva uma resposta." };
  const destino = lerEstado(estado);
  if (typeof id !== "string" || !UUID.test(id) || !destino) return { ok: false, erro: "Resposta ou estado inválidos." };
  const feito = await definirEstadoDaResposta(await createClient(), id, destino);
  if (feito.ok) revalidatePath("/admin/biblioteca");
  return feito;
}
