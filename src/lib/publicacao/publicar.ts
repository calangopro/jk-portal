import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analisar, bloqueiosDePublicacao } from "@/lib/analyzer/rules";
import { faqsDoHtml, faqsUnidas } from "@/lib/content/faq-html";

/**
 * O ato de publicar, separado de quem mandou publicar.
 *
 * Existem três portas para o mesmo ato: o botão do editor, o botão da lista de
 * conteúdos e, agora, a publicação agendada. As duas primeiras têm uma pessoa
 * logada; a terceira não tem ninguém, é o relógio.
 *
 * Se cada porta tivesse a sua própria verificação, a regra morreria pela porta
 * mais nova: bastaria agendar para o conteúdo entrar no ar sem fonte e sem
 * passar pelo analisador. Por isso as travas moram aqui, e as três portas
 * chamam esta função.
 *
 * Recebe o cliente do Supabase de fora de propósito. O editor usa o cliente da
 * sessão, e o agendamento usa o cliente de serviço, porque não há sessão às
 * 6 da manhã.
 */

export type ResultadoDaPublicacao = { ok: boolean; erro?: string; slug?: string | null };

/** Texto puro a partir do HTML do editor, para as regras que contam palavras. */
export function textoDoHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Roda o analisador no servidor, com a MESMA função que roda no navegador
 * enquanto a pessoa digita. Duas implementações divergiriam, e aí a tela diria
 * uma coisa e a trava outra.
 */
export async function conferirAntesDePublicar(
  supabase: SupabaseClient,
  id: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("contents")
    .select(
      "title, slug, meta_title, meta_description, answer, body_html, faqs, target_query, author_name, reviewer_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return "Conteúdo não encontrado.";

  const linha = data as {
    title: string | null;
    slug: string | null;
    meta_title: string | null;
    meta_description: string | null;
    answer: string | null;
    body_html: string | null;
    faqs: { question: string; answer: string }[] | null;
    target_query: string | null;
    author_name: string | null;
    reviewer_name: string | null;
  };

  const html = linha.body_html ?? "";
  const resultado = analisar({
    titulo: linha.title ?? "",
    slug: linha.slug ?? "",
    metaTitle: linha.meta_title ?? "",
    metaDescription: linha.meta_description ?? "",
    resposta: linha.answer ?? "",
    texto: textoDoHtml(html),
    html,
    // A FAQ escrita no corpo conta igual à do formulário, senão a trava
    // acusaria "menos de 2 perguntas" num texto cheio de perguntas.
    faqs: faqsUnidas(faqsDoHtml(html), linha.faqs),
    consultaAlvo: linha.target_query ?? "",
    autor: linha.author_name ?? "",
    revisor: linha.reviewer_name ?? "",
  });

  const bloqueios = bloqueiosDePublicacao(resultado);
  if (bloqueios.length === 0) return null;

  const lista = bloqueios.map((b) => `${b.titulo}${b.dica ? `. ${b.dica}` : ""}`);
  return (
    `Não dá para publicar ainda. ${
      lista.length === 1 ? "Falta corrigir:" : `Faltam ${lista.length} correções:`
    } ` + lista.join(" ")
  );
}

/**
 * Põe a busca em dia depois de publicar, despublicar ou arquivar.
 *
 * Import dinâmico para a service_role não entrar no pacote das telas.
 *
 * Falha aqui NUNCA derruba a publicação: o índice é dado derivado, e a página
 * no ar vale mais que a busca atualizada.
 */
export async function reindexarBusca(id: string) {
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
}

/**
 * Refaz tudo que muda quando uma página entra no ar.
 *
 * O sitemap e o llms.txt são gerados com cache: sem isto, conteúdo novo levava
 * até uma hora para aparecer neles, e é justamente nas primeiras horas que
 * interessa o Google descobrir a página.
 */
export async function revalidarTudo(slug?: string | null) {
  revalidatePath("/admin/conteudos");
  revalidatePath("/");
  revalidatePath("/dicas");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  if (slug) {
    revalidatePath(`/${slug}`);
    const { avisarIndexNow } = await import("@/lib/seo/indexnow");
    await avisarIndexNow([`/${slug}`]);
  }
}

/**
 * Publica, com as travas. Serve o editor, a lista e o agendamento.
 */
export async function publicarNoBanco(
  supabase: SupabaseClient,
  id: string,
): Promise<ResultadoDaPublicacao> {
  // Trava de fonte. A regra fundadora do projeto diz que toda afirmação factual
  // precisa de fonte registrada, e uma regra que ninguém verifica não é regra.
  const { count } = await supabase
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("content_id", id);
  if (!count) {
    return {
      ok: false,
      erro: "Registre pelo menos uma fonte antes de publicar. Se o texto não faz afirmação que precise de fonte, registre uma anotação dizendo isso.",
    };
  }

  const bloqueio = await conferirAntesDePublicar(supabase, id);
  if (bloqueio) return { ok: false, erro: bloqueio };

  const { data, error } = await supabase
    .from("contents")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      // Sai da fila de agendamento: já entrou no ar, e agendamento pendente
      // numa página publicada faria o cron tentar de novo para sempre.
      scheduled_at: null,
      scheduled_error: null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };

  // A pauta que gerou este conteúdo fecha junto. Fila que precisa ser fechada
  // à mão desanda em uma semana, e aí ninguém confia mais no que ela mostra.
  await supabase.from("briefings").update({ status: "publicada" }).eq("content_id", id);

  await revalidarTudo(data?.slug);
  await reindexarBusca(id);
  revalidatePath("/admin/pautas");
  revalidatePath("/admin/calendario");

  return { ok: true, slug: data?.slug ?? null };
}
