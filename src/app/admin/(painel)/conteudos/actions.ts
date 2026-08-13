"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { gerarSlug, slugDisponivel, obterConteudo } from "@/lib/data/admin-contents";
import { acharModelo } from "@/lib/editor/modelos";

/** Cria um rascunho e abre o editor. Com modelo, já vem estruturado. */
export async function criarConteudo(formData?: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const modelo = acharModelo(String(formData?.get("modelo") ?? ""));
  const titulo = modelo?.titulo ?? "Novo guia";
  const slug = await slugDisponivel(gerarSlug(titulo));

  const { data, error } = await supabase
    .from("contents")
    .insert({
      type: "guia",
      title: titulo,
      slug,
      status: "draft",
      search_intent: modelo?.intencao ?? null,
      answer: modelo?.resposta ?? null,
      body_html: modelo?.bodyHtml ?? null,
      faqs: modelo?.faqs ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar.");
  revalidatePath("/admin/conteudos");
  redirect(`/admin/conteudos/${data.id}`);
}

/** Duplica em rascunho, com slug novo, sem tocar no original. */
export async function duplicarConteudo(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const original = await obterConteudo(id);
  if (!original) return;

  const supabase = await createClient();
  const slug = await slugDisponivel(gerarSlug(`${original.title} copia`));

  await supabase.from("contents").insert({
    type: original.type,
    title: `${original.title} (cópia)`,
    slug,
    status: "draft",
    excerpt: original.excerpt,
    answer: original.answer,
    body_html: original.body_html,
    meta_title: original.meta_title,
    meta_description: original.meta_description,
    target_query: original.target_query,
    search_intent: original.search_intent,
    author_name: original.author_name,
    reviewer_name: original.reviewer_name,
    faqs: original.faqs,
  });

  revalidatePath("/admin/conteudos");
}

/** Muda o status. Arquivar é o nosso apagar: preserva o histórico. */
export async function mudarStatus(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "in_review", "published", "archived"].includes(status)) return;

  // Publicar pela lista é o mesmo ato que publicar pelo editor, então passa
  // pela mesma trava de fonte. Duas portas para a mesma coisa com regras
  // diferentes é como a regra morre.
  if (status === "published") {
    const { publicarConteudo } = await import("./[id]/actions");
    const r = await publicarConteudo(id);
    revalidatePath("/admin/conteudos");
    // O botão da lista é um form simples, sem estado no cliente. Sem isto, a
    // recusa da trava sumia: a pessoa clicava em Publicar, nada acontecia e ela
    // não tinha como saber por quê.
    if (!r.ok && r.erro) {
      redirect(`/admin/conteudos?erro=${encodeURIComponent(r.erro)}`);
    }
    return;
  }

  const supabase = await createClient();
  await supabase.from("contents").update({ status }).eq("id", id);

  // Sair de "publicado" (para revisão, rascunho ou arquivo) tem que tirar da
  // busca também. Resultado que leva a uma página fora do ar é pior que
  // resultado nenhum.
  try {
    const [{ getConteudoPorId }, { indexarGuia }] = await Promise.all([
      import("@/lib/data/contents"),
      import("@/lib/busca/indexar"),
    ]);
    const guia = await getConteudoPorId(id);
    if (guia) await indexarGuia(guia);
  } catch (e) {
    console.error("[busca] não consegui reindexar o conteúdo", id, e);
  }

  revalidatePath("/admin/conteudos");
  revalidatePath("/");
  revalidatePath("/guia");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}

/** Remoção definitiva. Só admin, e só a partir de conteúdo já arquivado. */
export async function apagarDefinitivo(formData: FormData) {
  const perfil = await requireStaff();
  if (perfil.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const atual = await obterConteudo(id);
  if (!atual || atual.status !== "archived") return;

  const supabase = await createClient();
  await supabase.from("contents").delete().eq("id", id);
  revalidatePath("/admin/conteudos");
}
