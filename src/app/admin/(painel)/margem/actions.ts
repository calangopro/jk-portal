"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  ErroDeMargem,
  importarCustos,
  salvarCustoDoProduto,
  salvarFamilia,
  salvarParametros,
  type ResultadoDaImportacao,
} from "@/lib/margem/dados";
import type { Parametros } from "@/lib/margem/calculo";
import type { ImportacaoDeCustos } from "@/lib/margem/planilha-do-dono";

type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

async function tentar<T extends object>(fn: () => Promise<T>): Promise<Resposta<T>> {
  try {
    const r = await fn();
    revalidatePath("/admin/margem");
    revalidatePath("/admin/produtos");
    revalidatePath("/admin/campanhas", "layout");
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroDeMargem || e instanceof Error ? e.message : "Algo deu errado." };
  }
}

const finito = (v: unknown) => (v === null ? null : typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function salvarParametrosDeCusto(p: Partial<Parametros>): Promise<Resposta> {
  const perfil = await requireAdmin();
  return tentar(async () => {
    const limpo: Partial<Parametros> = {};
    for (const [k, v] of Object.entries(p) as [keyof Parametros, unknown][]) {
      const n = finito(v);
      if (n === undefined) throw new ErroDeMargem("Valor inválido.");
      limpo[k] = n;
    }
    await salvarParametros(await createClient(), limpo, perfil.id);
    return {};
  });
}

export async function salvarFamiliaDeOuro(
  codigo: string,
  v: { gramas: number | null; arosReferencia: string | null; resto: number | null },
): Promise<Resposta> {
  const perfil = await requireAdmin();
  return tentar(async () => {
    await salvarFamilia(await createClient(), codigo, v, perfil.id);
    return {};
  });
}

export async function salvarCustoDeProduto(
  productId: string,
  patch: { gramas?: number | null; resto?: number | null; custoFixo?: number | null },
): Promise<Resposta> {
  const perfil = await requireAdmin();
  return tentar(async () => {
    await salvarCustoDoProduto(await createClient(), productId, patch, perfil.id);
    return {};
  });
}

/**
 * Recebe a planilha JÁ LIDA no navegador (o .xlsx passa de 1 MB, teto da
 * Server Action): só os números que o dono digitou.
 */
export async function importarPlanilhaDeCustos(d: ImportacaoDeCustos): Promise<Resposta<ResultadoDaImportacao>> {
  const perfil = await requireAdmin();
  return tentar(async () => {
    if (d.familias.length > 500 || d.ouro.length > 3000 || d.fixos.length > 3000) {
      throw new ErroDeMargem("A planilha veio grande demais para ser a de custos da JK.");
    }
    return importarCustos(await createClient(), d, perfil.id);
  });
}
