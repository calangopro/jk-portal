"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import {
  ehModulo,
  ehStatus,
  type Fato,
  type ModuloDoFato,
  type StatusDoFato,
} from "@/lib/content/fatos";

export type FatosState = { error?: string; success?: string };

type LinhaDoBanco = {
  id: string;
  claim: string;
  detail: string | null;
  module: string;
  source_url: string | null;
  file_url: string | null;
  captured_at: string | null;
  responsible: string | null;
  status: string;
  subject: string | null;
  attribute: string | null;
};

const COLUNAS =
  "id, claim, detail, module, subject, attribute, source_url, file_url, captured_at, responsible, status";

function paraFato(l: LinhaDoBanco): Fato {
  return {
    id: l.id,
    claim: l.claim,
    detail: l.detail,
    module: l.module as ModuloDoFato,
    sourceUrl: l.source_url,
    fileUrl: l.file_url,
    capturedAt: l.captured_at,
    responsible: l.responsible,
    status: l.status as StatusDoFato,
    subject: l.subject,
    attribute: l.attribute,
  };
}

/**
 * Lista com a contagem de uso.
 *
 * A contagem importa: é ela que responde "posso marcar este fato como
 * desatualizado sem quebrar nada" e "quais guias preciso revisar quando a JK
 * corrigir este número".
 */
export async function listarFatos(): Promise<Fato[]> {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: fatos }, { data: usos }] = await Promise.all([
    supabase.from("facts").select(COLUNAS).order("module").order("claim"),
    supabase.from("sources").select("fact_id").not("fact_id", "is", null),
  ]);

  const porFato = new Map<string, number>();
  for (const u of (usos ?? []) as { fact_id: string }[]) {
    porFato.set(u.fact_id, (porFato.get(u.fact_id) ?? 0) + 1);
  }

  return ((fatos ?? []) as LinhaDoBanco[]).map((l) => ({
    ...paraFato(l),
    usos: porFato.get(l.id) ?? 0,
  }));
}

/** Aceita endereço só se for http ou https de verdade. */
function lerUrl(bruto: string): { url: string | null; erro?: string } {
  const t = bruto.trim();
  if (!t) return { url: null };
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    return { url: u.toString() };
  } catch {
    return { url: null, erro: `Endereço inválido: ${t}. Use o endereço completo, começando com https://` };
  }
}

export async function salvarFato(
  _prev: FatosState,
  formData: FormData,
): Promise<FatosState> {
  const perfil = await requireStaff();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const claim = String(formData.get("claim") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const moduleBruto = String(formData.get("module") ?? "empresa").trim();
  const statusBruto = String(formData.get("status") ?? "extraido").trim();
  const capturedAt = String(formData.get("captured_at") ?? "").trim();
  const responsible = String(formData.get("responsible") ?? "").trim();

  if (!claim) return { error: "Escreva a afirmação. É ela que vai ser citada." };
  if (!ehModulo(moduleBruto)) return { error: "Módulo desconhecido." };
  if (!ehStatus(statusBruto)) return { error: "Status desconhecido." };

  const fonte = lerUrl(String(formData.get("source_url") ?? ""));
  if (fonte.erro) return { error: fonte.erro };
  const arquivo = lerUrl(String(formData.get("file_url") ?? ""));
  if (arquivo.erro) return { error: arquivo.erro };

  // A mesma trava que existe no banco, repetida aqui para a mensagem ser
  // legível em vez de virar erro de constraint na cara do editor.
  if (statusBruto === "aprovado" && !fonte.url && !arquivo.url && !detail) {
    return {
      error:
        "Para aprovar, informe de onde veio: um link, um arquivo, ou pelo menos a explicação no campo de contexto. " +
        "Fato sem origem é opinião.",
    };
  }

  const payload = {
    claim,
    detail: detail || null,
    module: moduleBruto,
    source_url: fonte.url,
    file_url: arquivo.url,
    subject: String(formData.get("subject") ?? "").trim().toLowerCase() || null,
    attribute: String(formData.get("attribute") ?? "").trim().toLowerCase() || null,
    captured_at: capturedAt || null,
    responsible: responsible || perfil.fullName || perfil.email || null,
    status: statusBruto,
  };

  const { error } = id
    ? await supabase.from("facts").update(payload).eq("id", id)
    : await supabase.from("facts").insert({ ...payload, created_by: perfil.id });

  if (error) return { error: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/admin/fatos");
  return { success: id ? "Fato atualizado." : "Fato registrado na base." };
}

/**
 * Muda só o status.
 *
 * Não existe apagar. Marcar como desatualizado preserva a rastreabilidade do
 * conteúdo que já citou o fato, que é justamente o motivo de a base existir.
 */
export async function mudarStatusFato(id: string, status: StatusDoFato): Promise<FatosState> {
  await requireStaff();
  if (!ehStatus(status)) return { error: "Status desconhecido." };

  const supabase = await createClient();
  const { error } = await supabase.from("facts").update({ status }).eq("id", id);
  if (error) {
    if (error.code === "23514") {
      return {
        error:
          "Para aprovar, o fato precisa de link, arquivo ou contexto explicando de onde veio. Abra o fato e complete a origem.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/fatos");
  return { success: "Status alterado." };
}

/** Guias que citam este fato, para saber o que revisar quando ele mudar. */
export async function conteudosQueCitam(
  factId: string,
): Promise<{ id: string; title: string; slug: string; status: string }[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sources")
    .select("contents(id, title, slug, status)")
    .eq("fact_id", factId);

  const linhas = (data ?? []) as unknown as {
    contents: { id: string; title: string; slug: string; status: string } | null;
  }[];
  return linhas.map((l) => l.contents).filter((c): c is NonNullable<typeof c> => c !== null);
}
