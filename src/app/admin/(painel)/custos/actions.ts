"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS, type Categoria, type Tipo } from "@/lib/custos/dados";

/** "1.234,56", "1234,56" e "1234.56" viram número. Zero vale (custo que passou a não existir é desativado). */
function dinheiro(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const texto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max) || null;

/**
 * Cria ou altera um custo da empresa. Com `id`, altera; sem, cria.
 *
 * Só administrador: a tela já barra, e a RLS de `despesas` barra de novo quem
 * chamar a ação direto.
 */
export async function salvarDespesa(formData: FormData): Promise<void> {
  const perfil = await requireAdmin();

  const nome = texto(formData.get("nome"), 120);
  const categoria = String(formData.get("categoria") ?? "") as Categoria;
  const tipo = String(formData.get("tipo") ?? "") as Tipo;
  const valor = dinheiro(formData.get("valor"));
  if (!nome || nome.length < 2 || valor === null) return;
  if (!CATEGORIAS.some((c) => c.chave === categoria) || (tipo !== "mensal" && tipo !== "por_pedido")) return;

  const linha = {
    nome,
    categoria,
    tipo,
    valor,
    confirmado: formData.get("confirmado") === "on",
    fonte: texto(formData.get("fonte"), 300),
    observacao: texto(formData.get("observacao"), 500),
    atualizado_por: perfil.id,
    atualizado_em: new Date().toISOString(),
  };

  const db = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await db.from("despesas").update(linha).eq("id", id)
    : await db.from("despesas").insert({ ...linha, criado_por: perfil.id });
  if (error) console.error("[custos] salvarDespesa:", error.message);

  revalidatePath("/admin/custos");
}

/** Desativa ou reativa. Custo não se apaga: o histórico do que a loja já pagou fica. */
export async function ligarDespesa(formData: FormData): Promise<void> {
  const perfil = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = await createClient();
  const { error } = await db
    .from("despesas")
    .update({ ativo: formData.get("ativo") === "sim", atualizado_por: perfil.id, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[custos] ligarDespesa:", error.message);
  revalidatePath("/admin/custos");
}

/**
 * Registra um comprovante que o navegador acabou de subir para o bucket
 * privado. O caminho tem que começar pelo id da despesa: é o que impede
 * pendurar num custo um arquivo enviado para outro.
 */
export async function registrarAnexo(dados: {
  despesaId: string;
  caminho: string;
  nome: string;
  tipo: string;
  tamanho: number;
}): Promise<{ ok: boolean; erro?: string }> {
  const perfil = await requireAdmin();
  if (!dados.despesaId || !dados.caminho.startsWith(`${dados.despesaId}/`)) return { ok: false, erro: "Caminho do arquivo inválido." };

  const db = await createClient();
  const { error } = await db.from("despesa_anexos").insert({
    despesa_id: dados.despesaId,
    caminho: dados.caminho,
    nome: dados.nome.slice(0, 200) || "comprovante",
    tipo: dados.tipo || null,
    tamanho: Number.isFinite(dados.tamanho) ? Math.round(dados.tamanho) : null,
    enviado_por: perfil.id,
  });
  if (error) {
    console.error("[custos] registrarAnexo:", error.message);
    return { ok: false, erro: "O arquivo subiu, mas não deu para registrar. Tente de novo." };
  }
  revalidatePath("/admin/custos");
  return { ok: true };
}
