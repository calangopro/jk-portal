"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { slugDisponivel, titulosPublicados } from "@/lib/data/admin-contents";
import type { SugestaoIA } from "@/lib/analyzer/ai";
import { analisar, bloqueiosDePublicacao } from "@/lib/analyzer/rules";

export type SalvarPayload = {
  id: string;
  /** updated_at que o editor carregou. Serve para detectar edição concorrente. */
  versao: string;
  /** Salvamento automático não grava revisão nem revalida página pública. */
  automatico?: boolean;
  /** Confirmação explícita de sobrescrever o que outra aba salvou. */
  forcar?: boolean;
  title: string;
  slug: string;
  targetQuery: string;
  searchIntent: string;
  cluster: string;
  pilarId: string;
  excerpt: string;
  answer: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  authorName: string;
  reviewerName: string;
  /** Pessoa cadastrada. Vazio significa "usar o nome em texto livre". */
  authorId: string;
  reviewerId: string;
  faqs: { question: string; answer: string }[];
};

export type SalvarResultado = {
  ok: boolean;
  erro?: string;
  slug?: string;
  salvoEm?: string;
  /** Nova versão, que o editor guarda para o próximo salvamento. */
  versao?: string;
  /** Alguém salvou por cima. O editor pergunta antes de sobrescrever. */
  conflito?: boolean;
};

export async function salvarConteudo(p: SalvarPayload): Promise<SalvarResultado> {
  const perfil = await requireStaff();
  const supabase = await createClient();

  const slugLimpo = p.slug.trim();
  if (!slugLimpo) return { ok: false, erro: "O endereço da página não pode ficar vazio." };

  // Conflito: outra aba, ou outra pessoa, salvou depois que este editor abriu.
  // Sobrescrever em silêncio apaga trabalho alheio, então aqui a gente para e
  // pergunta.
  if (!p.forcar) {
    const { data: atual } = await supabase
      .from("contents")
      .select("updated_at")
      .eq("id", p.id)
      .maybeSingle();
    if (atual?.updated_at && p.versao && atual.updated_at !== p.versao) {
      return {
        ok: false,
        conflito: true,
        erro: "Esta página foi salva em outro lugar depois que você abriu o editor.",
      };
    }
  }

  const slugFinal = await slugDisponivel(slugLimpo, p.id);

  const { data: salvo, error } = await supabase
    .from("contents")
    .update({
      title: p.title.trim() || "Sem título",
      slug: slugFinal,
      target_query: p.targetQuery.trim() || null,
      search_intent: p.searchIntent.trim() || null,
      cluster: p.cluster.trim() || null,
      // String vazia não pode virar uuid, e "sem pilar" é justamente o caso do
      // próprio pilar do cluster.
      pillar_id: p.pilarId || null,
      excerpt: p.excerpt.trim() || null,
      answer: p.answer.trim() || null,
      body_html: p.bodyHtml,
      meta_title: p.metaTitle.trim() || null,
      meta_description: p.metaDescription.trim() || null,
      author_name: p.authorName.trim() || null,
      reviewer_name: p.reviewerName.trim() || null,
      author_id: p.authorId || null,
      reviewer_id: p.reviewerId || null,
      faqs: p.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    })
    .eq("id", p.id)
    .select("updated_at")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };

  // Histórico só no salvamento manual. O automático roda a cada poucos
  // segundos e encheria a tabela de versões quase iguais, o que torna o
  // histórico inútil justamente quando alguém precisa restaurar.
  if (!p.automatico) {
    await supabase.from("revisions").insert({
      content_id: p.id,
      editor_id: perfil.id,
      snapshot: p as unknown as Record<string, unknown>,
    });
    revalidatePath("/admin/conteudos");
    revalidatePath(`/guia/${slugFinal}`);
  }

  return {
    ok: true,
    slug: slugFinal,
    versao: salvo?.updated_at ?? undefined,
    salvoEm: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export type AnaliseResultado =
  | { ok: true; dados: SugestaoIA }
  | { ok: false; erro: string };

/** Análise com IA, sob demanda. A pessoa decide o que aceitar. */
export async function analisarIA(p: {
  id: string;
  titulo: string;
  consultaAlvo: string;
  intencao: string;
  resposta: string;
  texto: string;
  metaDescription: string;
}): Promise<AnaliseResultado> {
  await requireStaff();

  try {
    const { analisarComIA } = await import("@/lib/analyzer/ai");
    const jaPublicados = await titulosPublicados(p.id);
    const dados = await analisarComIA({
      titulo: p.titulo,
      consultaAlvo: p.consultaAlvo,
      intencao: p.intencao,
      resposta: p.resposta,
      texto: p.texto,
      metaDescription: p.metaDescription,
      jaPublicados,
    });
    return { ok: true, dados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na análise.";
    return { ok: false, erro: msg };
  }
}

/* ---------------------------------------------------------------- fontes */

export type Fonte = {
  id: string;
  source_url: string | null;
  evidence: string | null;
  captured_at: string | null;
  responsible: string | null;
};

export async function listarFontes(contentId: string): Promise<Fonte[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sources")
    .select("id, source_url, evidence, captured_at, responsible")
    .eq("content_id", contentId)
    .order("created_at");
  return (data ?? []) as Fonte[];
}

export async function adicionarFonte(
  contentId: string,
  f: { url: string; evidencia: string },
): Promise<{ ok: boolean; erro?: string; fonte?: Fonte }> {
  const perfil = await requireStaff();
  if (!f.evidencia.trim()) {
    return { ok: false, erro: "Escreva o que esta fonte comprova. Sem isso ela não serve para nada." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .insert({
      content_id: contentId,
      source_url: f.url.trim() || null,
      evidence: f.evidencia.trim(),
      captured_at: new Date().toISOString().slice(0, 10),
      responsible: perfil.fullName ?? perfil.email ?? null,
    })
    .select("id, source_url, evidence, captured_at, responsible")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  return { ok: true, fonte: data as Fonte };
}

export async function removerFonte(id: string): Promise<{ ok: boolean }> {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("sources").delete().eq("id", id);
  return { ok: true };
}

/* ------------------------------------------------------------- publicação */

/** Texto puro a partir do HTML do editor, para as regras que contam palavras. */
function textoDoHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Confere as regras bloqueantes e devolve a mensagem, ou null quando passa.
 *
 * A mensagem lista exatamente o que corrigir. Recusar com um texto genérico
 * transformaria a trava num muro, e a pessoa não saberia o que fazer.
 */
async function conferirAntesDePublicar(id: string): Promise<string | null> {
  const supabase = await createClient();

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
    faqs: linha.faqs ?? [],
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

export async function publicarConteudo(id: string): Promise<{ ok: boolean; erro?: string }> {
  await requireStaff();
  const supabase = await createClient();

  // Trava de fonte. A regra fundadora do projeto diz que toda afirmação factual
  // precisa de fonte registrada, e uma regra que ninguém verifica não é regra.
  // Conteúdo que de fato não afirma nada externo registra uma fonte dizendo
  // isso, o que deixa a decisão consciente e conferível depois.
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

  // Trava do analisador. Os erros objetivos, os que não dependem de julgamento
  // editorial, deixam de ser conselho e passam a barrar a publicação. O
  // REGRAS.md já pedia "analisador no verde" no checklist, e um checklist que o
  // sistema não verifica é uma sugestão.
  //
  // Roda no SERVIDOR, com a mesma função que roda no navegador enquanto a
  // pessoa digita. Duas implementações divergiriam, e aí a tela diria uma coisa
  // e a trava outra.
  const bloqueio = await conferirAntesDePublicar(id);
  if (bloqueio) return { ok: false, erro: bloqueio };

  const { data, error } = await supabase
    .from("contents")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };

  await revalidarTudo(data?.slug);
  return { ok: true };
}

/**
 * Refaz tudo que muda quando uma página entra ou sai do ar.
 *
 * O sitemap e o llms.txt são gerados com cache: sem isto, conteúdo novo levava
 * até uma hora para aparecer neles, e é justamente nas primeiras horas que
 * interessa o Google descobrir a página.
 */
async function revalidarTudo(slug?: string | null) {
  revalidatePath("/admin/conteudos");
  revalidatePath("/");
  revalidatePath("/guia");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  if (slug) {
    revalidatePath(`/guia/${slug}`);
    const { avisarIndexNow } = await import("@/lib/seo/indexnow");
    await avisarIndexNow([`/guia/${slug}`]);
  }
}

export async function voltarParaRascunho(id: string): Promise<{ ok: boolean }> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .update({ status: "draft" })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  // Sem IndexNow ao despublicar: avisar buscador para revisitar uma página que
  // acabou de sumir só antecipa um 404. O sitemap sair na hora já basta.
  revalidatePath("/admin/conteudos");
  revalidatePath("/");
  revalidatePath("/guia");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  if (data?.slug) revalidatePath(`/guia/${data.slug}`);
  return { ok: true };
}

/** Link de preview do rascunho, assinado. Só a equipe consegue gerar. */
export async function linkDePreview(id: string): Promise<string> {
  await requireStaff();
  const { tokenDePreview } = await import("@/lib/editor/preview");
  return `/preview/${tokenDePreview(id)}`;
}

/* --------------------------------------------------------- assistente IA */

export type AjudaResultado =
  | { ok: true; sugestao: string; explicacao: string; passos: string[] }
  | { ok: false; erro: string };

type Ctx = {
  titulo: string;
  consultaAlvo: string;
  resposta: string;
  texto: string;
  metaDescription: string;
};

/** Ajuda a resolver UM item apontado pelo analisador. */
export async function ajudarComItem(
  item: { id: string; titulo: string; dica?: string },
  ctx: Ctx,
): Promise<AjudaResultado> {
  await requireStaff();
  try {
    const { resolverItem } = await import("@/lib/analyzer/assistente");
    const r = await resolverItem(item, ctx);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao consultar a IA." };
  }
}

/** Escreve ou melhora um trecho a partir de um pedido em linguagem natural. */
export async function ajudarAEscrever(
  pedido: string,
  ctx: Ctx,
  trechoAtual?: string,
): Promise<AjudaResultado> {
  await requireStaff();
  try {
    const { escreverTrecho } = await import("@/lib/analyzer/assistente");
    const r = await escreverTrecho(pedido, ctx, trechoAtual);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao consultar a IA." };
  }
}

/* ------------------------------------------------------ produtos da loja */

export type ProdutoResumo = {
  id: string;
  nome: string;
  url: string | null;
  imagem: string | null;
  disponivel: boolean;
  preco: number | null;
  precoPromocional: number | null;
  prazo: string | null;
};

/** Busca produtos sincronizados da Tray, para inserir no conteúdo. */
export async function buscarProdutos(termo: string): Promise<ProdutoResumo[]> {
  await requireStaff();
  const supabase = await createClient();

  let q = supabase
    .from("products")
    .select("id, name, url, main_image_url, status, price, promotional_price, availability_text")
    .eq("is_active", true)
    .order("name")
    .limit(20);

  if (termo.trim()) q = q.ilike("name", `%${termo.trim()}%`);

  const { data } = await q;
  return (data ?? []).map((p: {
    id: string; name: string; url: string | null; main_image_url: string | null;
    status: string | null; price: number | null; promotional_price: number | null;
    availability_text: string | null;
  }) => ({
    id: p.id,
    nome: p.name,
    url: p.url,
    imagem: p.main_image_url,
    disponivel: p.status === "available",
    preco: p.price,
    precoPromocional: p.promotional_price,
    prazo: p.availability_text,
  }));
}

/* ---------------------------------------------------------- links internos */

export type AlvoDeLink = {
  id: string;
  title: string;
  slug: string;
  status: string;
  targetQuery: string | null;
};

/** Conteúdos que podem receber link, buscados por título ou consulta alvo. */
export async function buscarAlvosDeLink(termo: string, exceto: string): Promise<AlvoDeLink[]> {
  await requireStaff();
  const supabase = await createClient();

  let q = supabase
    .from("contents")
    .select("id, title, slug, status, target_query")
    .neq("id", exceto)
    .neq("status", "archived")
    .order("status")
    .limit(25);

  const t = termo.trim();
  if (t) q = q.or(`title.ilike.%${t}%,target_query.ilike.%${t}%`);

  const { data } = await q;
  return (data ?? []).map((r: {
    id: string; title: string; slug: string; status: string; target_query: string | null;
  }) => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, targetQuery: r.target_query }));
}

/**
 * Registra o link no grafo.
 *
 * O HTML do corpo já carrega o link, então isto pode parecer repetição. Não é:
 * é do grafo que saem os relacionados no fim do artigo, o relatório de página
 * órfã e a leitura de qual página recebe autoridade de quais outras. Ler isso
 * de dentro do HTML toda vez seria caro e frágil.
 */
export async function registrarLink(
  contentId: string,
  alvo: { targetContentId?: string; targetUrl?: string; anchor: string; rel?: string },
) {
  await requireStaff();
  const supabase = await createClient();

  const linha = {
    source_content_id: contentId,
    target_content_id: alvo.targetContentId ?? null,
    target_url: alvo.targetUrl ?? null,
    target_kind: alvo.targetContentId ? "content" : "external",
    anchor: alvo.anchor.slice(0, 200),
    rel: alvo.rel ?? null,
  };

  // Sem upsert de propósito: como uma das duas colunas de destino é sempre
  // nula, o Postgres trata cada linha como distinta e o upsert duplicaria em
  // vez de atualizar. Procurar antes é explícito e sempre certo.
  let busca = supabase
    .from("content_links")
    .select("id")
    .eq("source_content_id", contentId)
    .limit(1);
  busca = alvo.targetContentId
    ? busca.eq("target_content_id", alvo.targetContentId)
    : busca.eq("target_url", alvo.targetUrl ?? "");

  const { data: existente } = await busca.maybeSingle();
  if (existente?.id) await supabase.from("content_links").update(linha).eq("id", existente.id);
  else await supabase.from("content_links").insert(linha);
}

/* ------------------------------------------------------ biblioteca de mídia */

export type ImagemDaBiblioteca = {
  id: string;
  url: string;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
};

/** Imagens já enviadas, para reaproveitar em vez de subir a mesma foto de novo. */
export async function buscarImagens(termo: string): Promise<ImagemDaBiblioteca[]> {
  await requireStaff();
  const supabase = await createClient();

  let q = supabase
    .from("media")
    .select("id, url, alt, caption, credit, width, height")
    .is("deactivated_at", null)
    .not("url", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);

  // Busca pelo alt porque é o texto que descreve a imagem, e é o que a pessoa
  // lembra. O caminho do arquivo não diz nada para quem escreve.
  if (termo.trim()) q = q.ilike("alt", `%${termo.trim()}%`);

  const { data } = await q;
  return (data ?? []) as ImagemDaBiblioteca[];
}

/**
 * Registra que esta imagem é usada neste conteúdo.
 * É o que permite saber depois onde uma foto aparece, antes de desativá-la.
 */
export async function vincularImagem(contentId: string, mediaId: string, papel = "inline") {
  await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("content_media")
    .upsert({ content_id: contentId, media_id: mediaId, role: papel }, { onConflict: "content_id,media_id,role" });
}

/** Liga um produto ao conteúdo, para o schema e para medir o clique. */
export async function vincularProduto(contentId: string, productId: string, relacao = "related") {
  await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("content_products")
    .upsert({ content_id: contentId, product_id: productId, relation: relacao }, { onConflict: "content_id,product_id" });
}

/* ----------------------------------------------------------------- capa */

/**
 * Capa do conteúdo (o vínculo `content_media` com papel `hero`).
 *
 * A tabela existe desde a migration 0004 e ficou anos sem ninguém escrever
 * nela: não havia campo no admin, então a redação não tinha como definir capa.
 */
export async function capaAtual(contentId: string): Promise<ImagemDaBiblioteca | null> {
  await requireStaff();
  const supabase = await createClient();

  const { data } = await supabase
    .from("content_media")
    .select("media:media_id (id, url, alt, caption, credit, width, height)")
    .eq("content_id", contentId)
    .eq("role", "hero")
    .maybeSingle();

  const m = (data as { media: ImagemDaBiblioteca | null } | null)?.media;
  return m?.url ? m : null;
}

/**
 * Define a capa. Troca a anterior em vez de acumular: o índice único de
 * `content_media` é (conteúdo, mídia, papel), então dois heroes diferentes
 * conviveriam sem conflito e a página escolheria um deles por sorte.
 */
export async function definirCapa(
  contentId: string,
  mediaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await requireStaff();
  const supabase = await createClient();

  // Capa sem alt não entra: é a única imagem que representa a página inteira,
  // e alt é exigência de publicação no REGRAS.md.
  const { data: midia } = await supabase
    .from("media")
    .select("alt, width, height")
    .eq("id", mediaId)
    .maybeSingle();

  const m = midia as { alt: string | null; width: number | null; height: number | null } | null;
  if (!m?.alt?.trim()) {
    return { ok: false, erro: "Esta imagem está sem texto alternativo. Corrija em Mídia antes de usar como capa." };
  }
  if (!m.width || !m.height) {
    return { ok: false, erro: "Esta imagem está sem dimensão registrada, e sem isso a página pula quando ela carrega." };
  }

  await supabase.from("content_media").delete().eq("content_id", contentId).eq("role", "hero");
  const { error } = await supabase
    .from("content_media")
    .insert({ content_id: contentId, media_id: mediaId, role: "hero", position: 0 });

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** Tira a capa. O arquivo continua na biblioteca, só o vínculo sai. */
export async function removerCapa(contentId: string): Promise<{ ok: boolean }> {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("content_media").delete().eq("content_id", contentId).eq("role", "hero");
  return { ok: true };
}
