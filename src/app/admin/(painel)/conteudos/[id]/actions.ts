"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { slugDisponivel, titulosPublicados } from "@/lib/data/admin-contents";
import type { SugestaoIA } from "@/lib/analyzer/ai";
import { publicarNoBanco, reindexarBusca } from "@/lib/publicacao/publicar";
import { evidenciaDoFato, type Fato, type ModuloDoFato } from "@/lib/content/fatos";

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

  // Estado atual, lido ANTES do update. Traz duas coisas: o `updated_at` que
  // detecta edição concorrente e o slug antigo, que precisa ser invalidado
  // quando o endereço muda (senão a URL velha continua servindo HTML velho
  // até o ISR expirar).
  const { data: atual } = await supabase
    .from("contents")
    .select("updated_at, slug")
    .eq("id", p.id)
    .maybeSingle();

  // Conflito: outra aba, ou outra pessoa, salvou depois que este editor abriu.
  // Sobrescrever em silêncio apaga trabalho alheio, então aqui a gente para e
  // pergunta.
  if (!p.forcar && atual?.updated_at && p.versao && atual.updated_at !== p.versao) {
    return {
      ok: false,
      conflito: true,
      erro: "Esta página foi salva em outro lugar depois que você abriu o editor.",
    };
  }

  const slugAntigo = atual?.slug ?? null;

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
    // Endereço trocado: sem isto a página antiga segue no ar com o conteúdo
    // antigo, e quem chega por link ou pela busca do Google vê a versão velha.
    if (slugAntigo && slugAntigo !== slugFinal) {
      revalidatePath(`/guia/${slugAntigo}`);
    }
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
  /** Preenchido quando a fonte veio da base de fatos, e não foi digitada aqui. */
  fact_id: string | null;
};

/** Uma lista só, para a fonte devolvida ter sempre o mesmo formato. */
const COLUNAS_DA_FONTE = "id, source_url, evidence, captured_at, responsible, fact_id";

export async function listarFontes(contentId: string): Promise<Fonte[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sources")
    .select(COLUNAS_DA_FONTE)
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
    .select(COLUNAS_DA_FONTE)
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

/* ----------------------------------------------------------------- fatos */

/**
 * Fatos que o editor pode citar agora.
 *
 * Só o que está aprovado aparece. Fato ainda por validar é rascunho de
 * evidência, e rascunho de evidência não pode virar afirmação publicada.
 */
export async function fatosParaCitar(): Promise<Fato[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("facts")
    .select(
      "id, claim, detail, module, subject, attribute, source_url, file_url, captured_at, responsible, status",
    )
    .eq("status", "aprovado")
    .order("module")
    .order("claim");

  return ((data ?? []) as {
    id: string;
    claim: string;
    detail: string | null;
    module: string;
    source_url: string | null;
    file_url: string | null;
    captured_at: string | null;
    responsible: string | null;
    subject: string | null;
    attribute: string | null;
  }[]).map((f) => ({
    id: f.id,
    claim: f.claim,
    detail: f.detail,
    module: f.module as ModuloDoFato,
    sourceUrl: f.source_url,
    fileUrl: f.file_url,
    capturedAt: f.captured_at,
    responsible: f.responsible,
    status: "aprovado" as const,
    subject: f.subject,
    attribute: f.attribute,
  }));
}

/**
 * Cita um fato neste conteúdo: grava a fonte apontando para ele.
 *
 * É o ponto inteiro da base de fatos. Antes, registrar fonte era um formulário
 * separado que a pessoa preenchia (ou não) no fim, e a tabela `sources` ficou
 * zerada mesmo com a trava de publicação valendo. Agora a fonte nasce do gesto
 * de usar o fato no texto.
 *
 * Citar duas vezes o mesmo fato no mesmo conteúdo não duplica: o índice único
 * parcial cuida disso, e aqui devolvemos a fonte que já existia.
 */
export async function citarFato(
  contentId: string,
  factId: string,
): Promise<{ ok: boolean; erro?: string; fonte?: Fonte; jaCitado?: boolean }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: fato } = await supabase
    .from("facts")
    .select("id, claim, detail, source_url, file_url, captured_at, responsible, status")
    .eq("id", factId)
    .maybeSingle();

  if (!fato) return { ok: false, erro: "Fato não encontrado na base." };
  if (fato.status !== "aprovado") {
    return { ok: false, erro: "Só fato aprovado pode ser citado. Este ainda está esperando validação." };
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      content_id: contentId,
      fact_id: factId,
      source_url: fato.source_url,
      file_url: fato.file_url,
      evidence: evidenciaDoFato(fato),
      captured_at: fato.captured_at,
      responsible: fato.responsible,
      validation_status: "validated",
    })
    .select(COLUNAS_DA_FONTE)
    .maybeSingle();

  if (error) {
    // 23505: o índice único parcial pegou. Não é erro para quem está escrevendo,
    // é a resposta certa, então devolvemos a fonte que já estava lá.
    if (error.code === "23505") {
      const { data: existente } = await supabase
        .from("sources")
        .select(COLUNAS_DA_FONTE)
        .eq("content_id", contentId)
        .eq("fact_id", factId)
        .maybeSingle();
      return { ok: true, jaCitado: true, fonte: (existente ?? undefined) as Fonte | undefined };
    }
    return { ok: false, erro: error.message };
  }

  return { ok: true, fonte: data as Fonte };
}

/* ------------------------------------------------------------- histórico */

export type Revisao = {
  id: string;
  criadaEm: string;
  autor: string | null;
  nota: string | null;
  /** Resumo do que estava gravado naquela versão. */
  titulo: string;
  slug: string;
  tamanhoDoCorpo: number;
  /** Campos diferentes do que está no editor agora. */
  diferencas: string[];
};

/** Os campos que a restauração escreve de volta, e o rótulo de cada um. */
const CAMPOS_DA_REVISAO: { chave: keyof SalvarPayload; coluna: string; label: string }[] = [
  { chave: "title", coluna: "title", label: "título" },
  { chave: "slug", coluna: "slug", label: "endereço" },
  { chave: "targetQuery", coluna: "target_query", label: "consulta alvo" },
  { chave: "searchIntent", coluna: "search_intent", label: "intenção" },
  { chave: "cluster", coluna: "cluster", label: "cluster" },
  { chave: "excerpt", coluna: "excerpt", label: "resumo" },
  { chave: "answer", coluna: "answer", label: "resposta rápida" },
  { chave: "bodyHtml", coluna: "body_html", label: "corpo do texto" },
  { chave: "metaTitle", coluna: "meta_title", label: "título de busca" },
  { chave: "metaDescription", coluna: "meta_description", label: "meta description" },
  { chave: "authorName", coluna: "author_name", label: "autor" },
  { chave: "reviewerName", coluna: "reviewer_name", label: "revisor" },
];

/**
 * Versões gravadas deste conteúdo.
 *
 * A tabela `revisions` já recebia um retrato a cada salvamento manual, e não
 * existia nenhuma tela para ver ou voltar. Guardar histórico que ninguém
 * consegue abrir é o mesmo que não guardar: a pessoa escreve com medo de mexer,
 * e escrever com medo é lento.
 *
 * A comparação é por campo, não palavra a palavra. Saber que mudou o corpo e a
 * resposta rápida é o que decide se vale restaurar; o diff fino de texto é
 * ruído numa lista.
 */
export async function listarRevisoes(contentId: string): Promise<Revisao[]> {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: linhas }, { data: atual }, { data: pessoas }] = await Promise.all([
    supabase
      .from("revisions")
      .select("id, created_at, editor_id, snapshot, note")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("contents")
      .select(CAMPOS_DA_REVISAO.map((c) => c.coluna).join(", "))
      .eq("id", contentId)
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const nomes = new Map<string, string>();
  for (const p of (pessoas ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    nomes.set(p.id, p.full_name || p.email || "equipe");
  }

  const agora = (atual ?? {}) as unknown as Record<string, unknown>;

  return ((linhas ?? []) as {
    id: string;
    created_at: string;
    editor_id: string | null;
    snapshot: Record<string, unknown>;
    note: string | null;
  }[]).map((l) => {
    const s = l.snapshot ?? {};
    const diferencas: string[] = [];
    for (const c of CAMPOS_DA_REVISAO) {
      // Retrato antigo não tem os campos que nasceram depois (cluster, autor
      // cadastrado). Ausente não é diferença, é campo que ainda não existia, e
      // tratar como diferença acusaria mudança em toda versão antiga.
      if (!(c.chave in s)) continue;
      const naVersao = (s[c.chave] ?? "") as string;
      const noAtual = (agora[c.coluna] ?? "") as string;
      if (String(naVersao) !== String(noAtual)) diferencas.push(c.label);
    }

    return {
      id: l.id,
      criadaEm: l.created_at,
      autor: l.editor_id ? nomes.get(l.editor_id) ?? null : null,
      nota: l.note,
      titulo: String(s.title ?? "sem título"),
      slug: String(s.slug ?? ""),
      tamanhoDoCorpo: String(s.bodyHtml ?? "").length,
      diferencas,
    };
  });
}

/**
 * Volta o conteúdo para uma versão anterior.
 *
 * Restaurar NÃO apaga nada: grava mais uma revisão, agora com a nota dizendo de
 * onde veio. Assim voltar é reversível, e "restaurei sem querer" deixa de ser
 * um problema sem saída.
 *
 * O status e a data de publicação ficam de fora de propósito. Restaurar texto é
 * uma coisa; republicar ou despublicar é outra, e misturar as duas faria uma
 * página voltar ao ar por causa de um clique em Restaurar.
 */
export async function restaurarRevisao(
  revisionId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const perfil = await requireStaff();
  const supabase = await createClient();

  const { data: revisao } = await supabase
    .from("revisions")
    .select("id, content_id, created_at, snapshot")
    .eq("id", revisionId)
    .maybeSingle();

  if (!revisao) return { ok: false, erro: "Versão não encontrada." };

  const s = (revisao.snapshot ?? {}) as Record<string, unknown>;
  const contentId = revisao.content_id as string;

  const { data: atualLinha } = await supabase
    .from("contents")
    .select("slug")
    .eq("id", contentId)
    .maybeSingle();
  const slugAntigo = (atualLinha?.slug ?? null) as string | null;

  // Só volta o que o retrato guardou. Retrato antigo não tem `authorId` nem
  // `cluster`, porque esses campos nasceram depois, e escrever null neles
  // apagaria a autoria de hoje em nome de uma versão que nunca teve autoria.
  const payload: Record<string, unknown> = {};
  for (const c of CAMPOS_DA_REVISAO) {
    if (!(c.chave in s)) continue;
    const v = s[c.chave];
    payload[c.coluna] = typeof v === "string" ? v : v ?? null;
  }
  if ("faqs" in s) payload.faqs = Array.isArray(s.faqs) ? s.faqs : [];
  if ("authorId" in s) payload.author_id = (s.authorId as string) || null;
  if ("reviewerId" in s) payload.reviewer_id = (s.reviewerId as string) || null;
  if ("pilarId" in s) payload.pillar_id = (s.pilarId as string) || null;

  if (Object.keys(payload).length === 0) {
    return { ok: false, erro: "Esta versão está vazia, não há o que restaurar." };
  }

  // O endereço pode ter sido tomado por outra página desde então. Sem isto, a
  // restauração morreria num erro de chave única sem explicação.
  const slugPedido = String(payload.slug ?? "");
  if (slugPedido) payload.slug = await slugDisponivel(slugPedido, contentId);
  const slugFinal = String(payload.slug ?? slugAntigo ?? "");

  const { error } = await supabase.from("contents").update(payload).eq("id", contentId);
  if (error) return { ok: false, erro: error.message };

  await supabase.from("revisions").insert({
    content_id: contentId,
    editor_id: perfil.id,
    snapshot: { ...s, id: contentId, slug: slugFinal },
    note: `Restaurado da versão de ${new Date(revisao.created_at as string).toLocaleString("pt-BR")}`,
  });

  revalidatePath("/admin/conteudos");
  revalidatePath(`/admin/conteudos/${contentId}`);
  if (slugFinal) revalidatePath(`/guia/${slugFinal}`);
  if (slugAntigo && slugAntigo !== slugFinal) revalidatePath(`/guia/${slugAntigo}`);

  return { ok: true };
}

/* ------------------------------------------------------------- publicação */

export async function publicarConteudo(id: string): Promise<{ ok: boolean; erro?: string }> {
  await requireStaff();
  const supabase = await createClient();
  // As travas de fonte e de analisador moram em `publicarNoBanco`, junto com a
  // revalidação e o IndexNow. O agendamento publica sem ninguém logado e passa
  // exatamente pelas mesmas: regra que existe em duas cópias morre pela cópia
  // mais nova, e a cópia mais nova aqui seria o relógio.
  const r = await publicarNoBanco(supabase, id);
  return { ok: r.ok, erro: r.erro };
}

/**
 * Marca ou desmarca a hora de publicar.
 *
 * O horário chega como instante, já convertido no navegador a partir do fuso de
 * São Paulo, porque a decisão editorial é "sexta de manhã" e não "13:00 UTC".
 * Aqui só conferimos que a hora ainda não passou.
 */
export async function agendarPublicacao(
  id: string,
  quando: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await requireStaff();
  const supabase = await createClient();

  if (quando) {
    const instante = new Date(quando);
    if (Number.isNaN(instante.getTime())) return { ok: false, erro: "Data inválida." };
    // Um minuto de folga: relógio do navegador e do servidor nunca batem exato,
    // e recusar "agora" por três segundos de diferença seria irritante.
    if (instante.getTime() < Date.now() - 60_000) {
      return { ok: false, erro: "Essa hora já passou. Escolha um horário à frente." };
    }
  }

  const { error } = await supabase
    .from("contents")
    .update({ scheduled_at: quando, scheduled_error: null })
    .eq("id", id);

  if (error) {
    // A constraint do banco recusa agendar o que já está no ar.
    if (error.code === "23514") {
      return { ok: false, erro: "Esta página já está publicada. Não há o que agendar." };
    }
    return { ok: false, erro: error.message };
  }

  revalidatePath("/admin/conteudos");
  revalidatePath("/admin/calendario");
  return { ok: true };
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
  // Tira da busca junto. Página fora do ar que continua aparecendo no resultado
  // leva a pessoa para um 404, o que é pior que não achar nada.
  await reindexarBusca(id);
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
