import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conferirAntesDePublicar, publicarNoBanco, reindexarBusca, revalidarTudo, textoDoHtml } from "@/lib/publicacao/publicar";
import { tokenDePreview } from "@/lib/editor/preview";
import { MODELOS, acharModelo } from "@/lib/editor/modelos";
import { instanteDeSaoPaulo } from "@/lib/content/agenda";
import { evidenciaDoFato } from "@/lib/content/fatos";
import { analisarComIA } from "@/lib/analyzer/ai";
import { getConteudoPorId } from "@/lib/data/contents";
import { indexarGuia } from "@/lib/busca/indexar";
import { falhar, operacao, type Contexto } from "../tipos";
import {
  avaliar,
  choques,
  faixa,
  gerarSlug,
  id,
  limite,
  noSite,
  ok,
  paginasComparaveis,
  painel,
  quando,
  registrarImagensDoCorpo,
  registrarLinksDoCorpo,
  revalidarConteudo,
  slugLivre,
  temLinkDeEntrada,
} from "./apoio";

/**
 * Conteúdos (posts). Tudo passa pelas mesmas peças do editor: o núcleo de
 * publicação (`publicarNoBanco`, com a trava de fonte e a do analisador), o
 * mesmo `slugDisponivel` (aqui `slugLivre`, com o cliente do conector), o
 * mesmo formato de histórico em `revisions` (para "Restaurar" do editor
 * funcionar com versão salva pelo Claude) e as mesmas revalidações.
 */

const COLUNAS =
  "id, type, title, slug, status, search_intent, target_query, cluster, pillar_id, excerpt, answer, body_html, meta_title, meta_description, faqs, author_id, reviewer_id, author_name, reviewer_name, published_at, scheduled_at, scheduled_error, created_at, updated_at";

type Linha = {
  id: string;
  type: string;
  title: string;
  slug: string;
  status: string;
  search_intent: string | null;
  target_query: string | null;
  cluster: string | null;
  pillar_id: string | null;
  excerpt: string | null;
  answer: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  faqs: { question: string; answer: string }[] | null;
  author_id: string | null;
  reviewer_id: string | null;
  author_name: string | null;
  reviewer_name: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  scheduled_error: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS = ["draft", "in_review", "published", "archived"] as const;

const faqs = z
  .array(z.object({ pergunta: z.string().min(3), resposta: z.string().min(3) }))
  .max(30)
  .describe("Perguntas frequentes reais, com resposta objetiva. Mande a lista inteira (substitui a anterior).");

/** Os campos editáveis, com o nome em português e o que vai no banco. */
const CAMPOS = {
  titulo: z.string().min(3).max(200).describe("O H1. Com a consulta principal."),
  slug: z.string().max(120).describe("Endereço (/slug). Sem /guias, sem data. Vazio: sai do título."),
  tipo: z.enum(["guia", "artigo"]).describe("guia (padrão) ou artigo."),
  consulta_alvo: z.string().max(200).describe("A busca que a página quer ganhar. Evita canibalização."),
  intencao: z.string().max(300).describe("A intenção de busca, em uma frase."),
  cluster: z.string().max(80).describe("Tema que agrupa posts (jk.conteudos.clusters)."),
  pilar_id: z.uuid().nullable().describe("O post pilar do cluster, se este não for o pilar."),
  resposta: z.string().max(1200).describe("Resposta rápida: 2 a 4 frases que respondem a dúvida sozinhas. É o primeiro texto da página."),
  resumo: z.string().max(400).describe("Resumo curto para listas (excerpt)."),
  corpo_html: z.string().max(400_000).describe('O corpo em HTML do editor. Sem <h1>. Blocos: buscar({ guia: "blocos" }).'),
  meta_titulo: z.string().max(120).describe("Título da busca, até 60 caracteres."),
  meta_descricao: z.string().max(320).describe("140 a 160 caracteres, para o clique, sem repetir o título."),
  faqs,
  autor_id: z.uuid().nullable().describe("Pessoa de jk.autores.listar. Preenche o nome sozinho."),
  revisor_id: z.uuid().nullable().describe("Pessoa de jk.autores.listar que revisou."),
  autor_nome: z.string().max(120).describe("Só se a pessoa não estiver cadastrada em Autores."),
  revisor_nome: z.string().max(120).describe("Só se a pessoa não estiver cadastrada em Autores."),
};

type Campos = { [K in keyof typeof CAMPOS]?: z.infer<(typeof CAMPOS)[K]> };

const vazioViraNulo = (v: string | undefined | null) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null);

/** Português -> colunas do banco. Só o que veio; nome do autor sai do cadastro quando falta. */
async function paraBanco(db: SupabaseClient, c: Campos): Promise<Record<string, unknown>> {
  const d: Record<string, unknown> = {};
  if (c.titulo !== undefined) d.title = c.titulo.trim();
  if (c.tipo !== undefined) d.type = c.tipo;
  if (c.consulta_alvo !== undefined) d.target_query = vazioViraNulo(c.consulta_alvo);
  if (c.intencao !== undefined) d.search_intent = vazioViraNulo(c.intencao);
  if (c.cluster !== undefined) d.cluster = vazioViraNulo(c.cluster);
  if (c.pilar_id !== undefined) d.pillar_id = c.pilar_id || null;
  if (c.resposta !== undefined) d.answer = vazioViraNulo(c.resposta);
  if (c.resumo !== undefined) d.excerpt = vazioViraNulo(c.resumo);
  if (c.corpo_html !== undefined) d.body_html = c.corpo_html;
  if (c.meta_titulo !== undefined) d.meta_title = vazioViraNulo(c.meta_titulo);
  if (c.meta_descricao !== undefined) d.meta_description = vazioViraNulo(c.meta_descricao);
  if (c.faqs !== undefined) {
    d.faqs = c.faqs.map((f) => ({ question: f.pergunta.trim(), answer: f.resposta.trim() })).filter((f) => f.question && f.answer);
  }
  if (c.autor_nome !== undefined) d.author_name = vazioViraNulo(c.autor_nome);
  if (c.revisor_nome !== undefined) d.reviewer_name = vazioViraNulo(c.revisor_nome);
  for (const [campo, coluna, nome] of [
    ["autor_id", "author_id", "author_name"],
    ["revisor_id", "reviewer_id", "reviewer_name"],
  ] as const) {
    const v = c[campo];
    if (v === undefined) continue;
    d[coluna] = v || null;
    if (v && d[nome] === undefined) {
      const { data } = await db.from("authors").select("name, is_active").eq("id", v).maybeSingle();
      if (!data) falhar(`${campo}: pessoa não encontrada em Autores (jk.autores.listar).`);
      d[nome] = data!.name;
    }
  }
  return d;
}

/** O retrato que o editor grava em `revisions` (o mesmo formato do SalvarPayload). */
function retrato(l: Linha) {
  return {
    id: l.id,
    versao: l.updated_at,
    title: l.title,
    slug: l.slug,
    targetQuery: l.target_query ?? "",
    searchIntent: l.search_intent ?? "",
    cluster: l.cluster ?? "",
    pilarId: l.pillar_id ?? "",
    excerpt: l.excerpt ?? "",
    answer: l.answer ?? "",
    bodyHtml: l.body_html ?? "",
    metaTitle: l.meta_title ?? "",
    metaDescription: l.meta_description ?? "",
    authorName: l.author_name ?? "",
    reviewerName: l.reviewer_name ?? "",
    authorId: l.author_id ?? "",
    reviewerId: l.reviewer_id ?? "",
    faqs: l.faqs ?? [],
  };
}

async function guardarVersao(ctx: Contexto, l: Linha, nota: string) {
  await ctx.db.from("revisions").insert({
    content_id: l.id,
    editor_id: ctx.quem.id,
    snapshot: retrato(l),
    note: `${nota} (pelo Claude, ${ctx.acesso.nome})`.slice(0, 300),
  });
}

async function carregar(db: SupabaseClient, ref: { id?: string; slug?: string }): Promise<Linha> {
  if (!ref.id && !ref.slug) falhar("Mande id ou slug.");
  let q = db.from("contents").select(COLUNAS);
  q = ref.id ? q.eq("id", ref.id) : q.eq("slug", ref.slug!.replace(/^\/+/, "").replace(/^guias\//, ""));
  const { data } = await q.maybeSingle();
  if (!data) falhar("Conteúdo não encontrado.", 404);
  return data as Linha;
}

/** Os endereços de um conteúdo. A prévia vale para qualquer situação, inclusive rascunho. */
function enderecos(ctx: Contexto, l: Pick<Linha, "id" | "slug" | "status">) {
  return {
    painel: painel(ctx, `/conteudos/${l.id}`),
    previa: `${ctx.base}/preview/${tokenDePreview(l.id)}`,
    ...(l.status === "published" ? { url: noSite(ctx, `/${l.slug}`) } : {}),
  };
}

function resumoDaLinha(ctx: Contexto, l: Linha) {
  return {
    id: l.id,
    titulo: l.title,
    slug: l.slug,
    status: l.status,
    tipo: l.type,
    consulta_alvo: l.target_query,
    cluster: l.cluster,
    atualizado_em: l.updated_at,
    publicado_em: l.published_at,
    ...(l.scheduled_at ? { agendado_para: quando(l.scheduled_at) } : {}),
    ...(l.scheduled_error ? { erro_do_agendamento: l.scheduled_error } : {}),
    ...enderecos(ctx, l),
  };
}

async function analiseCompleta(ctx: Contexto, l: Linha) {
  const [outras, entrada, fontes, capa] = await Promise.all([
    paginasComparaveis(ctx.db, l.id),
    temLinkDeEntrada(ctx.db, l.id),
    ctx.db.from("sources").select("id", { count: "exact", head: true }).eq("content_id", l.id),
    ctx.db.from("content_media").select("id", { count: "exact", head: true }).eq("content_id", l.id).eq("role", "hero"),
  ]);
  const a = avaliar(l, { outras, temLinkDeEntrada: entrada });
  const semFonte = !fontes.count;
  return {
    ...a,
    ...(semFonte
      ? { barram_publicacao: [...a.barram_publicacao, { id: "fonte", grupo: "SEO", titulo: "Nenhuma fonte registrada", dica: "Cite um fato (jk.conteudos.citar_fato) ou registre uma fonte (jk.conteudos.adicionar_fonte)." }] }
      : {}),
    fontes: fontes.count ?? 0,
    tem_capa: (capa.count ?? 0) > 0,
    tem_link_de_entrada: entrada,
    canibalizacao: choques(l.title, l.target_query ?? "", outras),
  };
}

/** Grava os campos, guarda versão e acerta links e imagens. Serve para editar rascunho e post no ar. */
async function gravar(ctx: Contexto, atual: Linha, mudancas: Record<string, unknown>, nota: string) {
  const slugAntigo = atual.slug;
  if (typeof mudancas.slug === "string" || mudancas.title !== undefined) {
    const pedido = typeof mudancas.slug === "string" ? mudancas.slug : null;
    if (pedido !== null) {
      const limpo = gerarSlug(pedido.replace(/^\/+/, "")) || gerarSlug(String(mudancas.title ?? atual.title));
      mudancas.slug = await slugLivre(ctx.db, limpo, atual.id);
    }
  }
  const salvo = ok(
    await ctx.db.from("contents").update(mudancas).eq("id", atual.id).eq("updated_at", atual.updated_at).select(COLUNAS).maybeSingle(),
    "gravação",
  ) as Linha | null;
  if (!salvo) {
    falhar("Alguém salvou este conteúdo depois da versão que você leu. Leia de novo (jk.conteudos.ler), confira o que mudou e mande a versão nova.", 409);
  }
  await guardarVersao(ctx, salvo!, nota);
  await Promise.all([
    registrarLinksDoCorpo(ctx.db, ctx.base, salvo!.id, salvo!.body_html),
    registrarImagensDoCorpo(ctx.db, salvo!.id, salvo!.body_html),
  ]);
  revalidarConteudo(salvo!.slug, slugAntigo);
  return salvo!;
}

const refConteudo = {
  id: id.optional(),
  slug: z.string().max(200).optional().describe("Alternativa ao id."),
};

const camposParciais = z.object(Object.fromEntries(Object.entries(CAMPOS).map(([k, v]) => [k, v.optional()])) as {
  [K in keyof typeof CAMPOS]: z.ZodOptional<(typeof CAMPOS)[K]>;
});

const RETORNO_SALVO =
  "{ id: string; slug: string; status: string; versao: string; painel: string; previa: string; url?: string; analise: { nota: number; barram_publicacao: Array<{id,titulo,dica?}>; erros: Array<{id,titulo,dica?}>; avisos: Array<{id,titulo,dica?}>; canibalizacao: Array<{titulo,slug,gravidade,explicacao}> } }";

async function respostaSalva(ctx: Contexto, l: Linha) {
  const a = await analiseCompleta(ctx, l);
  return {
    id: l.id,
    slug: l.slug,
    status: l.status,
    versao: l.updated_at,
    ...enderecos(ctx, l),
    analise: {
      nota: a.nota,
      barram_publicacao: a.barram_publicacao,
      erros: a.erros,
      avisos: a.avisos.slice(0, 12),
      canibalizacao: a.canibalizacao,
    },
  };
}

export const OPERACOES_CONTEUDOS = [
  operacao({
    nome: "conteudos.listar",
    resumo: "Lista os posts, com filtro por situação, tipo, cluster ou palavra.",
    entrada: z.object({
      status: z.enum(STATUS).optional().describe("draft, in_review, published ou archived. Vazio: todos menos arquivados."),
      tipo: z.string().optional(),
      cluster: z.string().optional(),
      busca: z.string().max(100).optional().describe("Palavra no título, slug ou consulta alvo."),
      agendados: z.boolean().optional().describe("Só os que têm data de publicação marcada."),
      ordem: z.enum(["recentes", "titulo", "publicacao"]).default("recentes"),
      limite: limite(50, 200),
      pagina: z.number().int().min(1).default(1),
    }),
    retorno:
      "{ total: number; itens: Array<{ id, titulo, slug, status, tipo, consulta_alvo, cluster, atualizado_em, publicado_em, agendado_para?, erro_do_agendamento?, painel, previa, url? }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db.from("contents").select(COLUNAS.replace(", body_html", ""), { count: "exact" });
      q = a.status ? q.eq("status", a.status) : q.neq("status", "archived");
      if (a.tipo) q = q.eq("type", a.tipo);
      if (a.cluster) q = q.eq("cluster", a.cluster);
      if (a.agendados) q = q.not("scheduled_at", "is", null);
      if (a.busca) {
        const t = a.busca.replace(/[%,()]/g, " ").trim();
        q = q.or(`title.ilike.%${t}%,slug.ilike.%${t}%,target_query.ilike.%${t}%`);
      }
      q =
        a.ordem === "titulo"
          ? q.order("title")
          : a.ordem === "publicacao"
            ? q.order("published_at", { ascending: false, nullsFirst: false })
            : q.order("updated_at", { ascending: false });
      const [de, ate] = faixa(a.pagina, a.limite);
      const r = await q.range(de, ate);
      const linhas = ok(r) as unknown as Linha[];
      return { total: r.count ?? linhas.length, itens: linhas.map((l) => resumoDaLinha(ctx, l)) };
    },
  }),

  operacao({
    nome: "conteudos.ler",
    resumo: "Lê um post inteiro: campos, corpo, fontes, capa, produtos, links, versão e endereços.",
    detalhe: "Guarde a `versao`: editar pede ela, para não apagar o que outra pessoa salvou. sem_corpo: true devolve tudo menos o corpo_html.",
    entrada: z.object({ ...refConteudo, sem_corpo: z.boolean().default(false) }),
    retorno:
      "{ id, titulo, slug, status, tipo, versao, consulta_alvo, intencao, cluster, pilar_id, resposta, resumo, corpo_html?, palavras, meta_titulo, meta_descricao, faqs: Array<{pergunta,resposta}>, autor_id, autor_nome, revisor_id, revisor_nome, publicado_em, agendado_para, fontes: Array<{id,url,evidencia,fato_id}>, capa: {midia_id,url,alt} | null, produtos: Array<{id,nome,relacao}>, links_de_saida: Array<{slug,titulo}>, links_de_entrada: Array<{slug,titulo,status}>, painel, previa, url? }",
    risco: "leitura",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, a);
      const [fontes, capa, produtos, saida, entrada] = await Promise.all([
        ctx.db.from("sources").select("id, source_url, evidence, fact_id, captured_at").eq("content_id", l.id),
        ctx.db.from("content_media").select("media_id, media:media_id(url, alt, width, height)").eq("content_id", l.id).eq("role", "hero").maybeSingle(),
        ctx.db.from("content_products").select("relation, position, products:product_id(id, name, url)").eq("content_id", l.id).order("position"),
        ctx.db.from("content_links").select("target_url, anchor, alvo:target_content_id(slug, title)").eq("source_content_id", l.id),
        ctx.db.from("content_links").select("origem:source_content_id(slug, title, status)").eq("target_content_id", l.id),
      ]);
      const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
      const capaLinha = capa.data as { media_id: string; media: unknown } | null;
      const capaMidia = um(capaLinha?.media as { url: string; alt: string | null; width: number | null; height: number | null } | null);
      return {
        id: l.id,
        titulo: l.title,
        slug: l.slug,
        status: l.status,
        tipo: l.type,
        versao: l.updated_at,
        consulta_alvo: l.target_query,
        intencao: l.search_intent,
        cluster: l.cluster,
        pilar_id: l.pillar_id,
        resposta: l.answer,
        resumo: l.excerpt,
        ...(a.sem_corpo ? {} : { corpo_html: l.body_html ?? "" }),
        palavras: textoDoHtml(l.body_html ?? "").split(/\s+/).filter(Boolean).length,
        meta_titulo: l.meta_title,
        meta_descricao: l.meta_description,
        faqs: (l.faqs ?? []).map((f) => ({ pergunta: f.question, resposta: f.answer })),
        autor_id: l.author_id,
        autor_nome: l.author_name,
        revisor_id: l.reviewer_id,
        revisor_nome: l.reviewer_name,
        publicado_em: l.published_at,
        agendado_para: quando(l.scheduled_at),
        ...(l.scheduled_error ? { erro_do_agendamento: l.scheduled_error } : {}),
        fontes: (fontes.data ?? []).map((f) => ({ id: f.id, url: f.source_url, evidencia: f.evidence, fato_id: f.fact_id })),
        capa: capaLinha && capaMidia ? { midia_id: capaLinha.media_id, url: capaMidia.url, alt: capaMidia.alt, largura: capaMidia.width, altura: capaMidia.height } : null,
        produtos: (produtos.data ?? []).map((p) => {
          const pr = um(p.products as unknown as { id: string; name: string; url: string } | null);
          return { id: pr?.id, nome: pr?.name, url: pr?.url, relacao: p.relation };
        }),
        links_de_saida: (saida.data ?? []).map((s) => {
          const alvo = um(s.alvo as unknown as { slug: string; title: string } | null);
          return alvo ? { slug: alvo.slug, titulo: alvo.title, ancora: s.anchor } : { url: s.target_url, ancora: s.anchor };
        }),
        links_de_entrada: (entrada.data ?? []).map((e) => um(e.origem as unknown as { slug: string; title: string; status: string } | null)).filter(Boolean),
        ...enderecos(ctx, l),
      };
    },
  }),

  operacao({
    nome: "conteudos.criar",
    resumo: "Cria um post como RASCUNHO (não vai ao ar). Devolve id, versão, prévia e a análise.",
    detalhe:
      "modelo preenche a estrutura de partida (jk.conteudos.modelos): pilar, artigo, comparativo ou local; os campos que você mandar vencem o modelo. O texto precisa seguir buscar({ guia: \"escrita\" }). Links internos e imagens da biblioteca no corpo são registrados sozinhos.",
    entrada: z.object({
      ...Object.fromEntries(Object.entries(CAMPOS).map(([k, v]) => [k, k === "titulo" ? v : v.optional()])),
      modelo: z.string().optional().describe("pilar, artigo, comparativo ou local."),
      pauta_id: z.uuid().optional().describe("A pauta de onde veio: ela passa a 'escrevendo' e fica ligada ao post."),
    }) as unknown as z.ZodType<Campos & { titulo: string; modelo?: string; pauta_id?: string }>,
    retorno: RETORNO_SALVO,
    risco: "escrita",
    async executar(a, ctx) {
      const modelo = a.modelo ? acharModelo(a.modelo) : undefined;
      if (a.modelo && !modelo) falhar(`Modelo "${a.modelo}" não existe. Use: ${MODELOS.map((m) => m.id).join(", ")}.`);
      const dados = await paraBanco(ctx.db, a);
      const slug = await slugLivre(ctx.db, gerarSlug(a.slug || a.titulo));
      const linha = ok(
        await ctx.db
          .from("contents")
          .insert({
            type: "guia",
            status: "draft",
            search_intent: modelo?.intencao ?? null,
            answer: modelo?.resposta ?? null,
            body_html: modelo?.bodyHtml ?? null,
            faqs: modelo?.faqs ?? null,
            ...dados,
            slug,
          })
          .select(COLUNAS)
          .single(),
        "criação",
      ) as Linha;
      await guardarVersao(ctx, linha, "Criado");
      await Promise.all([
        registrarLinksDoCorpo(ctx.db, ctx.base, linha.id, linha.body_html),
        registrarImagensDoCorpo(ctx.db, linha.id, linha.body_html),
        a.pauta_id
          ? ctx.db.from("briefings").update({ content_id: linha.id, status: "escrevendo" }).eq("id", a.pauta_id).is("content_id", null)
          : Promise.resolve(),
      ]);
      revalidatePath("/admin/conteudos");
      if (a.pauta_id) revalidatePath("/admin/pautas");
      return respostaSalva(ctx, linha);
    },
  }),

  operacao({
    nome: "conteudos.editar",
    resumo: "Muda campos de um post que NÃO está no ar (rascunho, revisão ou arquivado). Mande só o que muda e a versão lida.",
    detalhe:
      "Post publicado: use editar_no_ar. A versão evita apagar o que outra pessoa salvou no editor; se mudou, leia de novo. Cada gravação vira uma versão no histórico (o editor mostra e restaura).",
    entrada: camposParciais.extend({ id, versao: z.string().describe("O campo versao de ler, criar ou da última edição.") }),
    retorno: RETORNO_SALVO,
    risco: "escrita",
    async executar(a, ctx) {
      const atual = await carregar(ctx.db, { id: a.id });
      if (atual.status === "published") falhar("Este post está no ar. Para mudar, use jk.conteudos.editar_no_ar (pede o sim da pessoa).", 409);
      if (atual.updated_at !== a.versao) {
        falhar("Alguém salvou este conteúdo depois da versão que você leu. Leia de novo (jk.conteudos.ler), confira o que mudou e mande a versão nova.", 409);
      }
      const { id: _i, versao: _v, ...campos } = a;
      const mudancas = await paraBanco(ctx.db, campos);
      if (campos.slug !== undefined) mudancas.slug = campos.slug;
      if (!Object.keys(mudancas).length) falhar("Nada para mudar: mande ao menos um campo.");
      return respostaSalva(ctx, await gravar(ctx, atual, mudancas, "Editado"));
    },
  }),

  operacao({
    nome: "conteudos.editar_no_ar",
    resumo: "Muda campos de um post PUBLICADO. A mudança aparece no site na hora.",
    detalhe:
      "Recusa se a versão nova ficaria com algo que barra a publicação (travessão, imagem sem alt, H1 no corpo, \"Escreva aqui\", título ou meta vazios). Mudar o slug de post no ar quebra links e o histórico de busca: só com motivo, e crie o redirect 301 do endereço velho (jk.redirects.criar).",
    entrada: camposParciais.extend({ id, versao: z.string() }),
    retorno: RETORNO_SALVO,
    risco: "perigosa",
    async executar(a, ctx) {
      const atual = await carregar(ctx.db, { id: a.id });
      if (atual.status !== "published") falhar("Este post não está no ar. Use jk.conteudos.editar.");
      if (atual.updated_at !== a.versao) {
        falhar("Alguém salvou este conteúdo depois da versão que você leu. Leia de novo e mande a versão nova.", 409);
      }
      const { id: _i, versao: _v, ...campos } = a;
      const mudancas = await paraBanco(ctx.db, campos);
      if (campos.slug !== undefined) mudancas.slug = campos.slug;
      if (!Object.keys(mudancas).length) falhar("Nada para mudar: mande ao menos um campo.");
      const futuro = { ...atual, ...mudancas } as Linha;
      const trava = avaliar(futuro).barram_publicacao;
      if (trava.length) {
        falhar(`Com essa mudança o post no ar ficaria com erro que barra publicação: ${trava.map((t) => t.titulo + (t.dica ? ` (${t.dica})` : "")).join("; ")}.`);
      }
      const salvo = await gravar(ctx, atual, mudancas, "Editado no ar");
      await revalidarTudo(salvo.slug);
      await reindexarBusca(salvo.id);
      return respostaSalva(ctx, salvo);
    },
  }),

  operacao({
    nome: "conteudos.analisar",
    resumo: "Roda o analisador de SEO, GEO e voz num post salvo: nota, o que barra a publicação, erros, avisos e canibalização.",
    entrada: z.object(refConteudo),
    retorno:
      "{ nota, nota_seo, nota_geo, nota_voz, palavras, barram_publicacao: Array<{id,grupo,titulo,dica?}>, erros: [...], avisos: [...], ok: string[], fontes: number, tem_capa: boolean, tem_link_de_entrada: boolean, canibalizacao: Array<{id,titulo,slug,status,gravidade,explicacao}> }",
    risco: "leitura",
    async executar(a, ctx) {
      return analiseCompleta(ctx, await carregar(ctx.db, a));
    },
  }),

  operacao({
    nome: "conteudos.analisar_texto",
    resumo: "Roda o analisador num texto que ainda não foi salvo (para ajustar antes de criar ou editar).",
    entrada: z.object({
      titulo: z.string(),
      slug: z.string().default(""),
      meta_titulo: z.string().default(""),
      meta_descricao: z.string().default(""),
      resposta: z.string().default(""),
      corpo_html: z.string().default(""),
      consulta_alvo: z.string().default(""),
      faqs: faqs.default([]),
      autor_nome: z.string().default(""),
      revisor_nome: z.string().default(""),
      exceto_id: z.uuid().optional().describe("O próprio post, para não comparar com ele mesmo."),
    }),
    retorno: "o mesmo de analisar, sem fontes nem capa",
    risco: "leitura",
    async executar(a, ctx) {
      const outras = await paginasComparaveis(ctx.db, a.exceto_id);
      const c = {
        title: a.titulo,
        slug: a.slug || gerarSlug(a.titulo),
        meta_title: a.meta_titulo,
        meta_description: a.meta_descricao,
        answer: a.resposta,
        body_html: a.corpo_html,
        faqs: a.faqs.map((f) => ({ question: f.pergunta, answer: f.resposta })),
        target_query: a.consulta_alvo,
        author_name: a.autor_nome,
        reviewer_name: a.revisor_nome,
      };
      return { ...avaliar(c, { outras }), canibalizacao: choques(a.titulo, a.consulta_alvo, outras) };
    },
  }),

  operacao({
    nome: "conteudos.canibalizacao",
    resumo: "Confere se um título ou consulta alvo disputa com página que já existe (antes de criar pauta ou post).",
    entrada: z.object({ consulta_alvo: z.string().min(2), titulo: z.string().default(""), exceto_id: z.uuid().optional() }),
    retorno: "{ choques: Array<{id,titulo,slug,status,gravidade:'erro'|'alerta',explicacao}>; pautas: Array<{id,consulta_alvo,status}> }",
    risco: "leitura",
    async executar(a, ctx) {
      const outras = await paginasComparaveis(ctx.db, a.exceto_id);
      const alvo = a.consulta_alvo.trim().toLowerCase();
      const { data: pautas } = await ctx.db.from("briefings").select("id, target_query, status").ilike("target_query", alvo);
      return {
        choques: choques(a.titulo || a.consulta_alvo, a.consulta_alvo, outras),
        pautas: (pautas ?? []).map((p) => ({ id: p.id, consulta_alvo: p.target_query, status: p.status })),
      };
    },
  }),

  operacao({
    nome: "conteudos.analisar_com_ia",
    resumo: "A análise com IA do painel (OpenAI da JK, gasta crédito): notas, problemas, trechos citáveis, FAQ e títulos sugeridos.",
    entrada: z.object(refConteudo),
    retorno: "{ notaSeo, notaGeo, resumo, respondeIntencao, pontosFortes[], problemas[{titulo,porque,comoResolver}], trechosCitaveis[], faqSugeridas[], titulosAlternativos[], metaDescriptionSugerida, problemasDeVoz[] }",
    risco: "leitura",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, a);
      const { data: publicados } = await ctx.db.from("contents").select("title").eq("status", "published").neq("id", l.id).limit(200);
      try {
        return await analisarComIA({
          titulo: l.title,
          consultaAlvo: l.target_query ?? "",
          intencao: l.search_intent ?? "",
          resposta: l.answer ?? "",
          texto: textoDoHtml(l.body_html ?? ""),
          metaDescription: l.meta_description ?? "",
          jaPublicados: (publicados ?? []).map((p) => p.title),
        });
      } catch (e) {
        return falhar(`A análise com IA falhou: ${e instanceof Error ? e.message : String(e)}`, 502);
      }
    },
  }),

  operacao({
    nome: "conteudos.previa",
    resumo: "O link de prévia do post (funciona em rascunho, sem login), para a pessoa conferir antes de publicar.",
    entrada: z.object(refConteudo),
    retorno: "{ previa: string; painel: string; url?: string }",
    risco: "leitura",
    async executar(a, ctx) {
      return enderecos(ctx, await carregar(ctx.db, a));
    },
  }),

  operacao({
    nome: "conteudos.publicar",
    resumo: "Publica o post. Passa pelas travas do painel: precisa de fonte e de nada que barre no analisador.",
    detalhe: "Se recusar, a mensagem diz exatamente o que corrigir. Publicar também avisa o IndexNow e refaz a busca do site.",
    entrada: z.object({ id }),
    retorno: "{ ok: true; url: string; painel: string }",
    risco: "perigosa",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status === "published") return { ok: true, ja_estava: true, url: noSite(ctx, `/${l.slug}`), painel: painel(ctx, `/conteudos/${l.id}`) };
      const r = await publicarNoBanco(ctx.db, a.id);
      if (!r.ok) falhar(r.erro ?? "Não deu para publicar.");
      return { ok: true, url: noSite(ctx, `/${r.slug}`), painel: painel(ctx, `/conteudos/${a.id}`) };
    },
  }),

  operacao({
    nome: "conteudos.despublicar",
    resumo: "Tira o post do ar: volta para rascunho (o endereço passa a dar 404).",
    detalhe: "Se o post tinha tráfego, considere um redirect 301 para o post mais próximo (jk.redirects.criar).",
    entrada: z.object({ id }),
    retorno: "{ ok: true; status: 'draft' }",
    risco: "perigosa",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status !== "published") falhar("Este post não está no ar.");
      ok(await ctx.db.from("contents").update({ status: "draft" }).eq("id", a.id), "mudança");
      for (const c of ["/admin/conteudos", "/", "/dicas", "/sitemap.xml", "/llms.txt", `/${l.slug}`]) revalidatePath(c);
      await reindexarBusca(a.id);
      return { ok: true, status: "draft", painel: painel(ctx, `/conteudos/${a.id}`) };
    },
  }),

  operacao({
    nome: "conteudos.mudar_status",
    resumo: "Passa um post entre rascunho e em revisão (draft, in_review). Não publica nem tira do ar.",
    entrada: z.object({ id, status: z.enum(["draft", "in_review"]) }),
    retorno: "{ ok: true; status: string }",
    risco: "escrita",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status === "published") falhar("Post no ar: para tirar do ar use jk.conteudos.despublicar.");
      ok(await ctx.db.from("contents").update({ status: a.status }).eq("id", a.id), "mudança");
      revalidatePath("/admin/conteudos");
      return { ok: true, status: a.status };
    },
  }),

  operacao({
    nome: "conteudos.arquivar",
    resumo: "Arquiva um post (sai do site e das listas, o histórico fica). É o apagar do painel.",
    entrada: z.object({ id }),
    retorno: "{ ok: true }",
    risco: "perigosa",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      ok(await ctx.db.from("contents").update({ status: "archived", scheduled_at: null }).eq("id", a.id), "arquivamento");
      for (const c of ["/admin/conteudos", "/", "/dicas", "/sitemap.xml", "/llms.txt", `/${l.slug}`]) revalidatePath(c);
      const guia = await getConteudoPorId(a.id);
      if (guia) await indexarGuia(guia).catch(() => undefined);
      return { ok: true, painel: painel(ctx, `/conteudos/${a.id}`) };
    },
  }),

  operacao({
    nome: "conteudos.desarquivar",
    resumo: "Traz um post arquivado de volta, como rascunho.",
    entrada: z.object({ id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status !== "archived") falhar("Este post não está arquivado.");
      ok(await ctx.db.from("contents").update({ status: "draft" }).eq("id", a.id), "mudança");
      revalidatePath("/admin/conteudos");
      return { ok: true, status: "draft" };
    },
  }),

  operacao({
    nome: "conteudos.agendar",
    resumo: "Marca data e hora (de São Paulo) para o post entrar no ar sozinho, pelas mesmas travas do publicar.",
    detalhe: 'quando: "AAAA-MM-DD HH:MM" no horário de São Paulo, ou ISO com fuso. O relógio roda a cada poucos minutos; se a trava recusar, o motivo fica em erro_do_agendamento.',
    entrada: z.object({ id, quando: z.string().min(10) }),
    retorno: "{ ok: true; agendado_para: string }",
    risco: "perigosa",
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status === "published") falhar("Este post já está no ar.");
      const texto = a.quando.trim().replace(" ", "T");
      const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(texto) ? new Date(texto).toISOString() : instanteDeSaoPaulo(texto.slice(0, 16));
      if (!iso || Number.isNaN(new Date(iso).getTime())) falhar('Data inválida. Use "AAAA-MM-DD HH:MM" (horário de São Paulo).');
      if (new Date(iso!).getTime() < Date.now() - 60_000) falhar("Essa data já passou.");
      ok(await ctx.db.from("contents").update({ scheduled_at: iso, scheduled_error: null }).eq("id", a.id), "agendamento");
      revalidatePath("/admin/conteudos");
      revalidatePath("/admin/calendario");
      return { ok: true, agendado_para: quando(iso), painel: painel(ctx, "/calendario") };
    },
  }),

  operacao({
    nome: "conteudos.cancelar_agendamento",
    resumo: "Tira a data de publicação marcada.",
    entrada: z.object({ id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("contents").update({ scheduled_at: null, scheduled_error: null }).eq("id", a.id), "mudança");
      revalidatePath("/admin/conteudos");
      revalidatePath("/admin/calendario");
      return { ok: true };
    },
  }),

  operacao({
    nome: "conteudos.calendario",
    resumo: "O calendário editorial: o que está agendado, o que saiu e as pautas em andamento, num intervalo de datas.",
    entrada: z.object({
      de: z.string().optional().describe("AAAA-MM-DD. Padrão: 30 dias atrás."),
      ate: z.string().optional().describe("AAAA-MM-DD. Padrão: 60 dias à frente."),
    }),
    retorno: "{ agendados: Array<{id,titulo,quando,erro?}>; publicados: Array<{id,titulo,slug,quando}>; pautas_em_andamento: Array<{id,consulta_alvo,status,conteudo_id}> }",
    risco: "leitura",
    async executar(a, ctx) {
      const de = a.de ? `${a.de}T00:00:00-03:00` : new Date(Date.now() - 30 * 86400_000).toISOString();
      const ate = a.ate ? `${a.ate}T23:59:59-03:00` : new Date(Date.now() + 60 * 86400_000).toISOString();
      const [ag, pub, pautas] = await Promise.all([
        ctx.db.from("contents").select("id, title, scheduled_at, scheduled_error").not("scheduled_at", "is", null).gte("scheduled_at", de).lte("scheduled_at", ate).order("scheduled_at"),
        ctx.db.from("contents").select("id, title, slug, published_at").eq("status", "published").gte("published_at", de).lte("published_at", ate).order("published_at"),
        ctx.db.from("briefings").select("id, target_query, status, content_id").in("status", ["pronta", "escrevendo"]),
      ]);
      return {
        agendados: (ag.data ?? []).map((c) => ({ id: c.id, titulo: c.title, quando: quando(c.scheduled_at), ...(c.scheduled_error ? { erro: c.scheduled_error } : {}) })),
        publicados: (pub.data ?? []).map((c) => ({ id: c.id, titulo: c.title, slug: c.slug, quando: quando(c.published_at) })),
        pautas_em_andamento: (pautas.data ?? []).map((p) => ({ id: p.id, consulta_alvo: p.target_query, status: p.status, conteudo_id: p.content_id })),
      };
    },
  }),

  operacao({
    nome: "conteudos.duplicar",
    resumo: "Cria uma cópia em rascunho, com slug novo, sem tocar no original.",
    entrada: z.object({ id }),
    retorno: RETORNO_SALVO,
    risco: "escrita",
    async executar(a, ctx) {
      const o = await carregar(ctx.db, { id: a.id });
      const slug = await slugLivre(ctx.db, gerarSlug(`${o.title} copia`));
      const nova = ok(
        await ctx.db
          .from("contents")
          .insert({
            type: o.type,
            title: `${o.title} (cópia)`,
            slug,
            status: "draft",
            excerpt: o.excerpt,
            answer: o.answer,
            body_html: o.body_html,
            meta_title: o.meta_title,
            meta_description: o.meta_description,
            target_query: o.target_query,
            search_intent: o.search_intent,
            author_name: o.author_name,
            reviewer_name: o.reviewer_name,
            faqs: o.faqs,
          })
          .select(COLUNAS)
          .single(),
        "cópia",
      ) as Linha;
      await guardarVersao(ctx, nova, "Duplicado");
      revalidatePath("/admin/conteudos");
      return respostaSalva(ctx, nova);
    },
  }),

  operacao({
    nome: "conteudos.historico",
    resumo: "As versões guardadas de um post (as 30 últimas), com quem salvou e o que mudou em relação à anterior.",
    entrada: z.object({ id }),
    retorno: "{ versoes: Array<{ id, criada_em, quem, nota, titulo, slug, tamanho_do_corpo, mudou: string[] }> }",
    risco: "leitura",
    async executar(a, ctx) {
      // `revisions.editor_id` aponta para auth.users, não para profiles: o nome vem numa segunda consulta.
      const { data } = await ctx.db
        .from("revisions")
        .select("id, created_at, note, snapshot, editor_id")
        .eq("content_id", a.id)
        .order("created_at", { ascending: false })
        .limit(30);
      const brutas = (data ?? []) as { id: string; created_at: string; note: string | null; snapshot: Record<string, unknown>; editor_id: string | null }[];
      const ids = [...new Set(brutas.map((r) => r.editor_id).filter(Boolean))] as string[];
      const { data: pessoas } = ids.length ? await ctx.db.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const porId = new Map((pessoas ?? []).map((p) => [p.id, p]));
      const linhas = brutas.map((r) => ({ ...r, editor: r.editor_id ? (porId.get(r.editor_id) ?? null) : null }));
      const campos = ["title", "slug", "targetQuery", "answer", "bodyHtml", "metaTitle", "metaDescription", "faqs", "authorName", "reviewerName", "excerpt", "cluster"];
      return {
        versoes: linhas.map((r, i) => {
          const anterior = linhas[i + 1]?.snapshot;
          const mudou = anterior ? campos.filter((c) => JSON.stringify(r.snapshot?.[c] ?? "") !== JSON.stringify(anterior[c] ?? "")) : [];
          return {
            id: r.id,
            criada_em: quando(r.created_at),
            quem: r.editor?.full_name ?? r.editor?.email ?? null,
            nota: r.note,
            titulo: r.snapshot?.title,
            slug: r.snapshot?.slug,
            tamanho_do_corpo: String(r.snapshot?.bodyHtml ?? "").length,
            mudou,
          };
        }),
      };
    },
  }),

  operacao({
    nome: "conteudos.ler_versao",
    resumo: "Lê uma versão guardada inteira (para comparar ou recuperar um trecho).",
    entrada: z.object({ versao_id: id }),
    retorno: "{ id, criada_em, nota, campos: { titulo, slug, resposta, corpo_html, meta_titulo, meta_descricao, faqs, ... } }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data } = await ctx.db.from("revisions").select("id, content_id, created_at, note, snapshot").eq("id", a.versao_id).maybeSingle();
      if (!data) falhar("Versão não encontrada.", 404);
      const s = (data!.snapshot ?? {}) as Record<string, unknown>;
      return {
        id: data!.id,
        conteudo_id: data!.content_id,
        criada_em: quando(data!.created_at),
        nota: data!.note,
        campos: {
          titulo: s.title,
          slug: s.slug,
          consulta_alvo: s.targetQuery,
          intencao: s.searchIntent,
          resposta: s.answer,
          resumo: s.excerpt,
          corpo_html: s.bodyHtml,
          meta_titulo: s.metaTitle,
          meta_descricao: s.metaDescription,
          faqs: s.faqs,
          autor_nome: s.authorName,
          revisor_nome: s.reviewerName,
        },
      };
    },
  }),

  operacao({
    nome: "conteudos.restaurar_versao",
    resumo: "Volta o post para uma versão guardada (não muda a situação: post no ar continua no ar, com o texto antigo).",
    entrada: z.object({ versao_id: id }),
    retorno: RETORNO_SALVO,
    risco: "perigosa",
    async executar(a, ctx) {
      const { data: r } = await ctx.db.from("revisions").select("content_id, created_at, snapshot").eq("id", a.versao_id).maybeSingle();
      if (!r) falhar("Versão não encontrada.", 404);
      const atual = await carregar(ctx.db, { id: r!.content_id });
      const s = (r!.snapshot ?? {}) as Record<string, unknown>;
      const mapa: Record<string, string> = {
        title: "title",
        slug: "slug",
        targetQuery: "target_query",
        searchIntent: "search_intent",
        cluster: "cluster",
        excerpt: "excerpt",
        answer: "answer",
        bodyHtml: "body_html",
        metaTitle: "meta_title",
        metaDescription: "meta_description",
        authorName: "author_name",
        reviewerName: "reviewer_name",
      };
      const mudancas: Record<string, unknown> = {};
      for (const [k, col] of Object.entries(mapa)) {
        if (k in s) mudancas[col] = typeof s[k] === "string" ? (String(s[k]).trim() || (col === "body_html" ? "" : null)) : s[k];
      }
      if (mudancas.title === null) mudancas.title = atual.title;
      if (Array.isArray(s.faqs)) mudancas.faqs = s.faqs;
      for (const [k, col] of [["authorId", "author_id"], ["reviewerId", "reviewer_id"], ["pilarId", "pillar_id"]] as const) {
        if (k in s) mudancas[col] = s[k] || null;
      }
      const salvo = await gravar(ctx, atual, mudancas, `Restaurado da versão de ${quando(r!.created_at)}`);
      if (salvo.status === "published") await revalidarTudo(salvo.slug);
      return respostaSalva(ctx, salvo);
    },
  }),

  operacao({
    nome: "conteudos.adicionar_fonte",
    resumo: "Registra uma fonte no post: o que ela comprova e o link. Publicar exige ao menos uma.",
    detalhe: "Para afirmação sobre a JK, prefira citar_fato (fato aprovado). Texto sem afirmação que precise de fonte: registre uma anotação dizendo isso.",
    entrada: z.object({
      id,
      evidencia: z.string().min(5).max(2000).describe("O que esta fonte comprova."),
      url: z.string().url().optional(),
    }),
    retorno: "{ id, url, evidencia }",
    risco: "escrita",
    async executar(a, ctx) {
      await carregar(ctx.db, { id: a.id });
      const f = ok(
        await ctx.db
          .from("sources")
          .insert({
            content_id: a.id,
            source_url: a.url?.trim() || null,
            evidence: a.evidencia.trim(),
            captured_at: new Date().toISOString().slice(0, 10),
            responsible: ctx.quem.nome ?? ctx.quem.email,
          })
          .select("id, source_url, evidence")
          .single(),
        "fonte",
      );
      return { id: f.id, url: f.source_url, evidencia: f.evidence };
    },
  }),

  operacao({
    nome: "conteudos.citar_fato",
    resumo: "Cita um fato APROVADO da base no post (vira fonte validada). É o caminho para afirmar algo sobre a JK.",
    entrada: z.object({ id, fato_id: id }),
    retorno: "{ ok: true; fonte_id: string; ja_citado?: boolean }",
    risco: "escrita",
    async executar(a, ctx) {
      await carregar(ctx.db, { id: a.id });
      const { data: fato } = await ctx.db
        .from("facts")
        .select("id, claim, detail, source_url, file_url, captured_at, responsible, status")
        .eq("id", a.fato_id)
        .maybeSingle();
      if (!fato) falhar("Fato não encontrado na base.", 404);
      if (fato!.status !== "aprovado") falhar("Só fato aprovado pode ser citado. Este ainda espera validação da JK.");
      const r = await ctx.db
        .from("sources")
        .insert({
          content_id: a.id,
          fact_id: a.fato_id,
          source_url: fato!.source_url,
          file_url: fato!.file_url,
          evidence: evidenciaDoFato(fato!),
          captured_at: fato!.captured_at,
          responsible: fato!.responsible,
          validation_status: "validated",
        })
        .select("id")
        .maybeSingle();
      if (r.error?.code === "23505") {
        const { data } = await ctx.db.from("sources").select("id").eq("content_id", a.id).eq("fact_id", a.fato_id).maybeSingle();
        return { ok: true, ja_citado: true, fonte_id: data?.id };
      }
      return { ok: true, fonte_id: ok(r, "citação")?.id };
    },
  }),

  operacao({
    nome: "conteudos.remover_fonte",
    resumo: "Tira uma fonte do post.",
    entrada: z.object({ fonte_id: id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("sources").delete().eq("id", a.fonte_id), "remoção");
      return { ok: true };
    },
  }),

  operacao({
    nome: "conteudos.definir_capa",
    resumo: "Põe uma imagem da biblioteca como capa do post (precisa de alt, largura e altura; ideal 1200 px e perto de 16:9).",
    entrada: z.object({ id, midia_id: id }),
    retorno: "{ ok: true; avisos: string[] }",
    risco: "escrita",
    async executar(a, ctx) {
      await carregar(ctx.db, { id: a.id });
      const { data: m } = await ctx.db.from("media").select("id, alt, width, height, deactivated_at").eq("id", a.midia_id).maybeSingle();
      if (!m || m.deactivated_at) falhar("Imagem não encontrada na biblioteca.", 404);
      if (!m!.alt?.trim()) falhar("A imagem precisa de texto alternativo antes de virar capa (jk.midia.editar).");
      if (!m!.width || !m!.height) falhar("A imagem está sem largura e altura registradas.");
      await ctx.db.from("content_media").delete().eq("content_id", a.id).eq("role", "hero");
      ok(await ctx.db.from("content_media").insert({ content_id: a.id, media_id: a.midia_id, role: "hero", position: 0 }), "capa");
      revalidatePath(`/admin/conteudos/${a.id}`);
      const avisos: string[] = [];
      if (m!.width! < 1200) avisos.push(`A capa tem ${m!.width} px de largura; o Discover pede 1200 px.`);
      const p = m!.width! / m!.height!;
      if (p < 1.6 || p > 1.95) avisos.push(`A proporção é ${p.toFixed(2)}:1; o ideal é perto de 1,78:1 (16:9).`);
      return { ok: true, avisos };
    },
  }),

  operacao({
    nome: "conteudos.remover_capa",
    resumo: "Tira a capa do post.",
    entrada: z.object({ id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("content_media").delete().eq("content_id", a.id).eq("role", "hero"), "remoção");
      return { ok: true };
    },
  }),

  operacao({
    nome: "conteudos.vincular_produto",
    resumo: "Liga um produto do catálogo ao post como relacionado (aparece junto do conteúdo).",
    entrada: z.object({ id, produto_id: id, relacao: z.string().default("related") }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      const { count } = await ctx.db.from("content_products").select("id", { count: "exact", head: true }).eq("content_id", a.id);
      ok(
        await ctx.db
          .from("content_products")
          .upsert({ content_id: a.id, product_id: a.produto_id, relation: a.relacao, position: count ?? 0 }, { onConflict: "content_id,product_id" }),
        "vínculo",
      );
      return { ok: true };
    },
  }),

  operacao({
    nome: "conteudos.desvincular_produto",
    resumo: "Tira um produto relacionado do post.",
    entrada: z.object({ id, produto_id: id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("content_products").delete().eq("content_id", a.id).eq("product_id", a.produto_id), "remoção");
      return { ok: true };
    },
  }),

  operacao({
    nome: "conteudos.modelos",
    resumo: "Os modelos de post do editor (pilar, artigo, comparativo, local), com a estrutura de cada um.",
    entrada: z.object({ com_corpo: z.boolean().default(false) }),
    retorno: "{ modelos: Array<{ id, nome, descricao, intencao, corpo_html? }> }",
    risco: "leitura",
    async executar(a) {
      return {
        modelos: MODELOS.map((m) => ({
          id: m.id,
          nome: m.nome,
          descricao: m.descricao,
          quando_usar: m.quando,
          intencao: m.intencao,
          ...(a.com_corpo ? { resposta: m.resposta, corpo_html: m.bodyHtml, faqs: m.faqs } : {}),
        })),
      };
    },
  }),

  operacao({
    nome: "conteudos.clusters",
    resumo: "Os clusters em uso, com o pilar e os posts de cada um, e as páginas órfãs (publicadas que ninguém linka).",
    entrada: z.object({}),
    retorno: "{ clusters: Array<{ cluster, pilar?: {id,titulo}, posts: Array<{id,titulo,slug,status}> }>; orfas: Array<{id,titulo,slug}> }",
    risco: "leitura",
    async executar(_a, ctx) {
      const [{ data: todos }, { data: links }] = await Promise.all([
        ctx.db.from("contents").select("id, title, slug, status, cluster, pillar_id").neq("status", "archived"),
        ctx.db.from("content_links").select("source_content_id, target_content_id").not("target_content_id", "is", null),
      ]);
      const lista = todos ?? [];
      const porId = new Map(lista.map((c) => [c.id, c]));
      const grupos = new Map<string, typeof lista>();
      for (const c of lista) if (c.cluster) grupos.set(c.cluster, [...(grupos.get(c.cluster) ?? []), c]);
      const publicados = new Set(lista.filter((c) => c.status === "published").map((c) => c.id));
      const citados = new Set((links ?? []).filter((l) => publicados.has(l.source_content_id)).map((l) => l.target_content_id));
      return {
        clusters: [...grupos.entries()].map(([cluster, posts]) => {
          const pilarId = posts.find((p) => p.pillar_id)?.pillar_id;
          const pilar = pilarId ? porId.get(pilarId) : undefined;
          return {
            cluster,
            ...(pilar ? { pilar: { id: pilar.id, titulo: pilar.title } } : {}),
            posts: posts.map((p) => ({ id: p.id, titulo: p.title, slug: p.slug, status: p.status })),
          };
        }),
        orfas: lista.filter((c) => c.status === "published" && !citados.has(c.id)).map((c) => ({ id: c.id, titulo: c.title, slug: c.slug })),
      };
    },
  }),

  operacao({
    nome: "conteudos.apagar_definitivo",
    resumo: "Apaga de vez um post ARQUIVADO (some com fontes, versões e vínculos). Não tem volta.",
    detalhe: 'Só administrador, só post arquivado, e só com a confirmação escrita: confirmacao = "APAGAR <slug>". Na dúvida, arquivar basta.',
    entrada: z.object({ id, confirmacao: z.string() }),
    retorno: "{ ok: true }",
    risco: "perigosa",
    soAdmin: true,
    async executar(a, ctx) {
      const l = await carregar(ctx.db, { id: a.id });
      if (l.status !== "archived") falhar("Só post arquivado pode ser apagado de vez. Arquive antes (jk.conteudos.arquivar).");
      if (a.confirmacao.trim() !== `APAGAR ${l.slug}`) falhar(`Para apagar de vez, mande confirmacao: "APAGAR ${l.slug}".`);
      ok(await ctx.db.from("contents").delete().eq("id", a.id), "remoção");
      revalidatePath("/admin/conteudos");
      return { ok: true };
    },
  }),
];

/** Usado pela pauta para nascer rascunho com o mesmo caminho. */
export { slugLivre };

/** Confere, sem publicar, se o post passaria nas travas agora (a mesma conta do publicar). */
export async function passariaNasTravas(ctx: Contexto, idDoConteudo: string): Promise<string | null> {
  const { count } = await ctx.db.from("sources").select("id", { count: "exact", head: true }).eq("content_id", idDoConteudo);
  if (!count) return "Falta registrar pelo menos uma fonte.";
  return conferirAntesDePublicar(ctx.db, idDoConteudo);
}
