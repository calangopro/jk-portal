import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MODULOS_DO_FATO, STATUS_DO_FATO } from "@/lib/content/fatos";
import { STATUS_DA_PAUTA, notaDaOportunidade, porqueDaOportunidade } from "@/lib/content/pautas";
import { acharModelo } from "@/lib/editor/modelos";
import { snapshotsDoPeriodo, ultimoPeriodo } from "@/lib/data/snapshots";
import { SITE } from "@/lib/seo/site";
import { falhar, operacao } from "../tipos";
import { DADO_DE_FORA, gerarSlug, id, limite, noSite, ok, painel, quando, slugLivre } from "./apoio";

/** Base de fatos, pautas, comentários e autores. */

const urlOuNada = z.string().url().or(z.literal("")).optional();

const CAMPOS_DO_FATO = {
  afirmacao: z.string().min(5).max(1000).describe("A frase que pode ser citada, como a JK confirmaria."),
  detalhe: z.string().max(3000).optional().describe("Contexto interno (não vai ao site)."),
  modulo: z.enum(MODULOS_DO_FATO).default("empresa"),
  assunto: z.string().max(80).optional().describe("Do que o fato fala, em slug (ex.: ouro-18k). Liga o fato ao comparador."),
  atributo: z.string().max(80).optional().describe("Qual característica: teor, durabilidade, manutencao, garantia."),
  fonte_url: urlOuNada,
  arquivo_url: urlOuNada,
  capturado_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  responsavel: z.string().max(120).optional(),
};

function fatoParaBanco(a: Partial<Record<keyof typeof CAMPOS_DO_FATO, unknown>>) {
  const d: Record<string, unknown> = {};
  if (a.afirmacao !== undefined) d.claim = String(a.afirmacao).trim();
  if (a.detalhe !== undefined) d.detail = String(a.detalhe).trim() || null;
  if (a.modulo !== undefined) d.module = a.modulo;
  if (a.assunto !== undefined) d.subject = String(a.assunto).trim().toLowerCase() || null;
  if (a.atributo !== undefined) d.attribute = String(a.atributo).trim().toLowerCase() || null;
  if (a.fonte_url !== undefined) d.source_url = String(a.fonte_url).trim() || null;
  if (a.arquivo_url !== undefined) d.file_url = String(a.arquivo_url).trim() || null;
  if (a.capturado_em !== undefined) d.captured_at = a.capturado_em || null;
  if (a.responsavel !== undefined) d.responsible = String(a.responsavel).trim() || null;
  return d;
}

const fatoParaSaida = (f: Record<string, unknown>, usos?: number) => ({
  id: f.id,
  afirmacao: f.claim,
  detalhe: f.detail,
  modulo: f.module,
  status: f.status,
  assunto: f.subject,
  atributo: f.attribute,
  fonte_url: f.source_url,
  arquivo_url: f.file_url,
  capturado_em: f.captured_at,
  responsavel: f.responsible,
  ...(usos !== undefined ? { citado_em: usos } : {}),
});

const pautaParaSaida = (p: Record<string, unknown>) => ({
  id: p.id,
  consulta_alvo: p.target_query,
  titulo: p.title,
  intencao: p.search_intent,
  cluster: p.cluster,
  notas: p.notes,
  modelo: p.modelo,
  status: p.status,
  origem: p.origem,
  impressoes: p.impressions,
  cliques: p.clicks,
  posicao: p.position,
  ctr: p.ctr,
  conteudo_id: p.content_id,
});

async function revalidarComentarios(slug?: string | null) {
  revalidatePath("/admin/comentarios");
  if (slug) revalidatePath(`/${slug}`);
}

export const OPERACOES_EDITORIAL = [
  // ---------------------------------------------------------------- fatos
  operacao({
    nome: "fatos.listar",
    resumo: "A base de fatos: o que dá para afirmar sobre a JK, os materiais e os produtos, com a situação de cada fato.",
    detalhe: "Só fato APROVADO pode ser citado em post. 'validar' é pergunta para a JK; não use como verdade.",
    entrada: z.object({
      status: z.enum(STATUS_DO_FATO).optional(),
      modulo: z.enum(MODULOS_DO_FATO).optional(),
      busca: z.string().max(100).optional(),
      limite: limite(100, 500),
    }),
    retorno: "{ itens: Array<{ id, afirmacao, detalhe, modulo, status, assunto, atributo, fonte_url, arquivo_url, capturado_em, responsavel, citado_em }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db.from("facts").select("*").order("module").order("updated_at", { ascending: false }).limit(a.limite);
      if (a.status) q = q.eq("status", a.status);
      if (a.modulo) q = q.eq("module", a.modulo);
      if (a.busca) {
        const t = a.busca.replace(/[%,()]/g, " ").trim();
        q = q.or(`claim.ilike.%${t}%,detail.ilike.%${t}%,subject.ilike.%${t}%`);
      }
      const fatos = ok(await q) as Record<string, unknown>[];
      const { data: usos } = await ctx.db.from("sources").select("fact_id").not("fact_id", "is", null);
      const conta = new Map<string, number>();
      for (const u of usos ?? []) conta.set(u.fact_id, (conta.get(u.fact_id) ?? 0) + 1);
      return { itens: fatos.map((f) => fatoParaSaida(f, conta.get(String(f.id)) ?? 0)), painel: painel(ctx, "/fatos") };
    },
  }),

  operacao({
    nome: "fatos.ler",
    resumo: "Um fato e os posts que o citam.",
    entrada: z.object({ id }),
    retorno: "{ ...fato, posts: Array<{ id, titulo, slug, status }> }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data: f } = await ctx.db.from("facts").select("*").eq("id", a.id).maybeSingle();
      if (!f) falhar("Fato não encontrado.", 404);
      const { data: s } = await ctx.db.from("sources").select("contents:content_id(id, title, slug, status)").eq("fact_id", a.id);
      return {
        ...fatoParaSaida(f!),
        posts: (s ?? []).map((x) => (Array.isArray(x.contents) ? x.contents[0] : x.contents)).filter(Boolean),
      };
    },
  }),

  operacao({
    nome: "fatos.criar",
    resumo: "Registra um fato novo na base, como 'extraido' ou 'validar' (aprovar é decisão da JK, por fatos.mudar_status).",
    entrada: z.object({ ...CAMPOS_DO_FATO, status: z.enum(["extraido", "validar"]).default("validar") }),
    retorno: "{ ...fato }",
    risco: "escrita",
    async executar(a, ctx) {
      const f = ok(
        await ctx.db
          .from("facts")
          .insert({
            ...fatoParaBanco(a),
            status: a.status,
            responsible: a.responsavel?.trim() || ctx.quem.nome || ctx.quem.email,
            created_by: ctx.quem.id,
          })
          .select("*")
          .single(),
        "registro",
      );
      revalidatePath("/admin/fatos");
      return fatoParaSaida(f);
    },
  }),

  operacao({
    nome: "fatos.editar",
    resumo: "Corrige o texto ou a origem de um fato (não muda a situação).",
    entrada: z.object({ id, ...Object.fromEntries(Object.entries(CAMPOS_DO_FATO).map(([k, v]) => [k, v.optional()])) }) as z.ZodType<
      { id: string } & Partial<Record<keyof typeof CAMPOS_DO_FATO, string>>
    >,
    retorno: "{ ...fato }",
    risco: "escrita",
    async executar(a, ctx) {
      const { id: idDoFato, ...resto } = a;
      const d = fatoParaBanco(resto);
      if (!Object.keys(d).length) falhar("Nada para mudar.");
      const f = ok(await ctx.db.from("facts").update(d).eq("id", idDoFato).select("*").maybeSingle(), "gravação");
      if (!f) falhar("Fato não encontrado.", 404);
      revalidatePath("/admin/fatos");
      return fatoParaSaida(f);
    },
  }),

  operacao({
    nome: "fatos.mudar_status",
    resumo: "Muda a situação de um fato. 'aprovado' só quando a JK confirmou: passa a poder ser citado e aparece no site.",
    detalhe: "Aprovar exige origem (link, arquivo ou contexto). 'desatualizado' preserva quem já citou. Não existe apagar fato.",
    entrada: z.object({ id, status: z.enum(STATUS_DO_FATO) }),
    retorno: "{ ok: true; status: string }",
    risco: "perigosa",
    async executar(a, ctx) {
      const r = await ctx.db.from("facts").update({ status: a.status }).eq("id", a.id);
      if (r.error?.code === "23514") falhar("Para aprovar, o fato precisa de origem: link, arquivo ou contexto (fatos.editar).");
      ok(r, "mudança");
      revalidatePath("/admin/fatos");
      revalidatePath("/ferramentas/[slug]", "page");
      return { ok: true, status: a.status };
    },
  }),

  // ---------------------------------------------------------------- pautas
  operacao({
    nome: "pautas.listar",
    resumo: "A fila de pautas (o que escrever), com a busca alvo, a situação e o post que nasceu de cada uma.",
    entrada: z.object({ status: z.enum(STATUS_DA_PAUTA).optional(), limite: limite(100, 300) }),
    retorno: "{ itens: Array<{ id, consulta_alvo, titulo, intencao, cluster, notas, modelo, status, origem, impressoes, cliques, posicao, ctr, conteudo_id, conteudo?: {titulo,slug,status} }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db.from("briefings").select("*, contents:content_id(title, slug, status)").order("created_at", { ascending: false }).limit(a.limite);
      if (a.status) q = q.eq("status", a.status);
      const linhas = ok(await q) as Record<string, unknown>[];
      return {
        itens: linhas.map((p) => {
          const c = (Array.isArray(p.contents) ? p.contents[0] : p.contents) as { title: string; slug: string; status: string } | null;
          return { ...pautaParaSaida(p), ...(c ? { conteudo: { titulo: c.title, slug: c.slug, status: c.status } } : {}) };
        }),
        painel: painel(ctx, "/pautas"),
      };
    },
  }),

  operacao({
    nome: "pautas.oportunidades",
    resumo: "Buscas do Search Console com muita impressão e pouco clique que ainda não têm pauta nem post: o que escrever primeiro.",
    entrada: z.object({ limite: limite(30, 200) }),
    retorno: "{ periodo: {inicio,fim} | null; itens: Array<{ consulta, impressoes, cliques, posicao, ctr, nota, porque }> }",
    risco: "leitura",
    async executar(a, ctx) {
      const periodo = await ultimoPeriodo(ctx.db, "query");
      if (!periodo) return { periodo: null, itens: [], aviso: "Ainda não há dados do Search Console (jk.metricas.importar_search_console)." };
      const [linhas, { data: pautas }, { data: conteudos }] = await Promise.all([
        snapshotsDoPeriodo(ctx.db, periodo, "query"),
        ctx.db.from("briefings").select("target_query"),
        ctx.db.from("contents").select("target_query").not("target_query", "is", null),
      ]);
      const emTrabalho = new Set(
        [...(pautas ?? []), ...(conteudos ?? [])].map((x) => String(x.target_query).trim().toLowerCase()),
      );
      const porConsulta = new Map<string, Record<string, number>>();
      for (const l of linhas) {
        const m = porConsulta.get(l.dimension_value) ?? {};
        m[l.metric] = Number(l.value);
        porConsulta.set(l.dimension_value, m);
      }
      const itens = [];
      for (const [consulta, m] of porConsulta) {
        if (emTrabalho.has(consulta.trim().toLowerCase())) continue;
        const base = { impressoes: m.impressions ?? 0, cliques: m.clicks ?? 0, posicao: m.position ?? 0, ctr: m.ctr ?? 0 };
        const nota = notaDaOportunidade(base);
        if (nota <= 0) continue;
        itens.push({ consulta, ...base, nota, porque: porqueDaOportunidade(base) });
      }
      return { periodo, itens: itens.sort((x, y) => y.nota - x.nota).slice(0, a.limite) };
    },
  }),

  operacao({
    nome: "pautas.criar",
    resumo: "Cria uma pauta (recusa se já existe post ou pauta mirando a mesma busca).",
    entrada: z.object({
      consulta_alvo: z.string().min(2).max(200),
      titulo: z.string().max(200).optional(),
      intencao: z.string().max(300).optional(),
      cluster: z.string().max(80).optional(),
      notas: z.string().max(3000).optional(),
      modelo: z.enum(["pilar", "artigo", "comparativo", "local"]).optional(),
      origem: z.enum(["gsc", "manual"]).default("manual"),
      impressoes: z.number().optional(),
      cliques: z.number().optional(),
      posicao: z.number().optional(),
      ctr: z.number().optional(),
    }),
    retorno: "{ ...pauta }",
    risco: "escrita",
    async executar(a, ctx) {
      const alvo = a.consulta_alvo.trim();
      const { data: conflitos } = await ctx.db.from("contents").select("title, target_query").not("target_query", "is", null);
      const choque = (conflitos ?? []).find((c) => String(c.target_query).trim().toLowerCase() === alvo.toLowerCase());
      if (choque) {
        falhar(`Já existe uma página mirando "${alvo}": ${choque.title}. Melhore a que existe ou escolha outro recorte.`, 409);
      }
      const r = await ctx.db
        .from("briefings")
        .insert({
          target_query: alvo,
          title: a.titulo?.trim() || null,
          search_intent: a.intencao?.trim() || null,
          cluster: a.cluster?.trim() || null,
          notes: a.notas?.trim() || null,
          modelo: a.modelo ?? null,
          origem: a.origem,
          impressions: a.impressoes ?? null,
          clicks: a.cliques ?? null,
          position: a.posicao ?? null,
          ctr: a.ctr ?? null,
          created_by: ctx.quem.id,
        })
        .select("*")
        .single();
      if (r.error?.code === "23505") falhar(`Já existe uma pauta para "${alvo}".`, 409);
      revalidatePath("/admin/pautas");
      return pautaParaSaida(ok(r, "criação"));
    },
  }),

  operacao({
    nome: "pautas.editar",
    resumo: "Muda título, intenção, cluster, notas ou modelo de uma pauta.",
    entrada: z.object({
      id,
      titulo: z.string().max(200).optional(),
      intencao: z.string().max(300).optional(),
      cluster: z.string().max(80).optional(),
      notas: z.string().max(3000).optional(),
      modelo: z.enum(["pilar", "artigo", "comparativo", "local"]).nullable().optional(),
    }),
    retorno: "{ ...pauta }",
    risco: "escrita",
    async executar(a, ctx) {
      const d: Record<string, unknown> = {};
      if (a.titulo !== undefined) d.title = a.titulo.trim() || null;
      if (a.intencao !== undefined) d.search_intent = a.intencao.trim() || null;
      if (a.cluster !== undefined) d.cluster = a.cluster.trim() || null;
      if (a.notas !== undefined) d.notes = a.notas.trim() || null;
      if (a.modelo !== undefined) d.modelo = a.modelo;
      if (!Object.keys(d).length) falhar("Nada para mudar.");
      const p = ok(await ctx.db.from("briefings").update(d).eq("id", a.id).select("*").maybeSingle(), "gravação");
      if (!p) falhar("Pauta não encontrada.", 404);
      revalidatePath("/admin/pautas");
      return pautaParaSaida(p);
    },
  }),

  operacao({
    nome: "pautas.mudar_status",
    resumo: "Muda a situação de uma pauta (ideia, pronta, escrevendo, publicada, descartada).",
    entrada: z.object({ id, status: z.enum(STATUS_DA_PAUTA) }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("briefings").update({ status: a.status }).eq("id", a.id), "mudança");
      revalidatePath("/admin/pautas");
      return { ok: true };
    },
  }),

  operacao({
    nome: "pautas.virar_rascunho",
    resumo: "Transforma a pauta em post rascunho, já com consulta alvo, modelo e até 3 produtos prováveis ligados.",
    detalhe: "Se a pauta já virou post, devolve o post que existe.",
    entrada: z.object({ id }),
    retorno: "{ conteudo_id, slug, painel, previa, ja_existia: boolean }",
    risco: "escrita",
    async executar(a, ctx) {
      const { data: p } = await ctx.db.from("briefings").select("*").eq("id", a.id).maybeSingle();
      if (!p) falhar("Pauta não encontrada.", 404);
      if (p!.content_id) {
        const { data: c } = await ctx.db.from("contents").select("id, slug").eq("id", p!.content_id).maybeSingle();
        return { conteudo_id: p!.content_id, slug: c?.slug, ja_existia: true, painel: painel(ctx, `/conteudos/${p!.content_id}`) };
      }
      const modelo = acharModelo(p!.modelo ?? "");
      const titulo = p!.title?.trim() || modelo?.titulo || p!.target_query;
      const slug = await slugLivre(ctx.db, gerarSlug(titulo));
      const c = ok(
        await ctx.db
          .from("contents")
          .insert({
            type: "guia",
            title: titulo,
            slug,
            status: "draft",
            target_query: p!.target_query,
            search_intent: p!.search_intent ?? modelo?.intencao ?? null,
            cluster: p!.cluster ?? null,
            answer: modelo?.resposta ?? null,
            body_html: modelo?.bodyHtml ?? null,
            faqs: modelo?.faqs ?? null,
          })
          .select("id, slug")
          .single(),
        "criação",
      );
      await ctx.db.from("briefings").update({ content_id: c.id, status: "escrevendo" }).eq("id", p!.id);
      const palavras = String(p!.target_query)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/\s+/)
        .filter((x) => x.length > 3);
      if (palavras.length) {
        const { data: prov } = await ctx.db
          .from("products")
          .select("id")
          .eq("is_active", true)
          .not("price", "is", null)
          .ilike("name", `%${palavras[0]}%`)
          .limit(3);
        if (prov?.length) {
          await ctx.db.from("content_products").insert(prov.map((x, i) => ({ content_id: c.id, product_id: x.id, relation: "related", position: i })));
        }
      }
      revalidatePath("/admin/pautas");
      revalidatePath("/admin/conteudos");
      const { tokenDePreview } = await import("@/lib/editor/preview");
      return {
        conteudo_id: c.id,
        slug: c.slug,
        ja_existia: false,
        painel: painel(ctx, `/conteudos/${c.id}`),
        previa: `${ctx.base}/preview/${tokenDePreview(c.id)}`,
      };
    },
  }),

  // ---------------------------------------------------------------- comentários
  operacao({
    nome: "comentarios.listar",
    resumo: "Comentários dos visitantes (padrão: a fila esperando moderação), com o post e as respostas da JK.",
    entrada: z.object({
      status: z.enum(["pending", "approved", "spam", "rejected"]).default("pending"),
      conteudo_id: z.uuid().optional(),
      limite: limite(50, 200),
    }),
    retorno: "{ aviso: string; itens: Array<{ id, status, nome, texto, quando, post: {id,titulo,slug}, resposta_de?: string, respostas: Array<{id,texto,quando}> }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db
        .from("comments")
        .select("id, status, author_name, body, created_at, parent_id, is_staff_reply, author_profile_id, contents:content_id(id, title, slug)")
        .eq("status", a.status)
        .is("author_profile_id", null)
        .order("created_at", { ascending: false })
        .limit(a.limite);
      if (a.conteudo_id) q = q.eq("content_id", a.conteudo_id);
      const linhas = ok(await q) as Record<string, unknown>[];
      const ids = linhas.map((l) => l.id as string);
      const { data: respostas } = ids.length
        ? await ctx.db.from("comments").select("id, parent_id, body, created_at").in("parent_id", ids).not("author_profile_id", "is", null)
        : { data: [] };
      return {
        aviso: DADO_DE_FORA,
        itens: linhas.map((l) => {
          const c = (Array.isArray(l.contents) ? l.contents[0] : l.contents) as { id: string; title: string; slug: string } | null;
          return {
            id: l.id,
            status: l.status,
            nome: l.author_name,
            texto: l.body,
            quando: quando(l.created_at as string),
            post: c ? { id: c.id, titulo: c.title, slug: c.slug, url: noSite(ctx, `/${c.slug}`) } : null,
            respostas: (respostas ?? []).filter((r) => r.parent_id === l.id).map((r) => ({ id: r.id, texto: r.body, quando: quando(r.created_at) })),
          };
        }),
        painel: painel(ctx, "/comentarios"),
      };
    },
  }),

  operacao({
    nome: "comentarios.aprovar",
    resumo: "Aprova comentários: o texto do visitante passa a aparecer no post.",
    entrada: z.object({ ids: z.array(id).min(1).max(100) }),
    retorno: "{ ok: true; aprovados: number }",
    risco: "perigosa",
    async executar(a, ctx) {
      const r = ok(await ctx.db.from("comments").update({ status: "approved" }).in("id", a.ids).select("id, contents:content_id(slug)"), "aprovação") as Record<string, unknown>[];
      revalidatePath("/admin/comentarios");
      for (const l of r) {
        const c = (Array.isArray(l.contents) ? l.contents[0] : l.contents) as { slug: string } | null;
        if (c?.slug) revalidatePath(`/${c.slug}`);
      }
      return { ok: true, aprovados: r.length };
    },
  }),

  operacao({
    nome: "comentarios.recusar",
    resumo: "Tira comentários da fila como spam ou recusado (não aparecem no site), ou devolve para a fila.",
    entrada: z.object({ ids: z.array(id).min(1).max(100), como: z.enum(["spam", "rejected", "pending"]) }),
    retorno: "{ ok: true; mudados: number }",
    risco: "escrita",
    async executar(a, ctx) {
      const r = ok(await ctx.db.from("comments").update({ status: a.como }).in("id", a.ids).select("id, contents:content_id(slug)"), "mudança") as Record<string, unknown>[];
      revalidatePath("/admin/comentarios");
      for (const l of r) {
        const c = (Array.isArray(l.contents) ? l.contents[0] : l.contents) as { slug: string } | null;
        if (c?.slug) revalidatePath(`/${c.slug}`);
      }
      return { ok: true, mudados: r.length };
    },
  }),

  operacao({
    nome: "comentarios.responder",
    resumo: "Responde um comentário em nome da JK Alianças (aparece no post com o selo da loja). Aprova o comentário junto.",
    detalhe: "Só administrador. A resposta fala pela marca: sem promessa de preço, prazo ou desconto que não esteja aprovado. Escreva pelas regras de texto.",
    entrada: z.object({ comentario_id: id, texto: z.string().min(2).max(2000) }),
    retorno: "{ ok: true; resposta_id: string; url: string }",
    risco: "perigosa",
    soAdmin: true,
    async executar(a, ctx) {
      if (/[—–]/.test(a.texto)) falhar("A resposta tem travessão. Use vírgula, dois pontos ou parênteses.");
      const { data: pai } = await ctx.db.from("comments").select("id, content_id, parent_id, status, contents:content_id(slug)").eq("id", a.comentario_id).maybeSingle();
      if (!pai) falhar("Comentário não encontrado.", 404);
      if (pai!.parent_id) falhar("Responda o comentário principal: a conversa tem um nível só.");
      const r = ok(
        await ctx.db
          .from("comments")
          .insert({
            content_id: pai!.content_id,
            parent_id: pai!.id,
            author_name: SITE.name,
            body: a.texto.trim(),
            status: "approved",
            author_profile_id: ctx.quem.id,
          })
          .select("id")
          .single(),
        "resposta",
      );
      if (pai!.status !== "approved") await ctx.db.from("comments").update({ status: "approved" }).eq("id", pai!.id);
      const c = (Array.isArray(pai!.contents) ? pai!.contents[0] : pai!.contents) as { slug: string } | null;
      await revalidarComentarios(c?.slug);
      return { ok: true, resposta_id: r.id, url: c?.slug ? noSite(ctx, `/${c.slug}`) : null };
    },
  }),

  operacao({
    nome: "comentarios.apagar_resposta",
    resumo: "Apaga uma resposta da JK (nunca encosta em comentário de visitante).",
    entrada: z.object({ resposta_id: id }),
    retorno: "{ ok: true }",
    risco: "perigosa",
    soAdmin: true,
    async executar(a, ctx) {
      const { data } = await ctx.db.from("comments").delete().eq("id", a.resposta_id).not("author_profile_id", "is", null).select("contents:content_id(slug)");
      if (!data?.length) falhar("Resposta não encontrada (ou é comentário de visitante, que não se apaga por aqui).", 404);
      const c = (Array.isArray(data![0].contents) ? data![0].contents[0] : data![0].contents) as { slug: string } | null;
      await revalidarComentarios(c?.slug);
      return { ok: true };
    },
  }),

  operacao({
    nome: "comentarios.apagar_spam",
    resumo: "Apaga de vez comentários marcados como spam.",
    entrada: z.object({ ids: z.array(id).min(1).max(200) }),
    retorno: "{ ok: true; apagados: number }",
    risco: "escrita",
    soAdmin: true,
    async executar(a, ctx) {
      const { data } = await ctx.db.from("comments").delete().in("id", a.ids).eq("status", "spam").select("id");
      revalidatePath("/admin/comentarios");
      return { ok: true, apagados: data?.length ?? 0 };
    },
  }),

  // ---------------------------------------------------------------- autores
  operacao({
    nome: "autores.listar",
    resumo: "Quem assina e revisa os posts (com página própria em /autor/slug).",
    entrada: z.object({ inativos: z.boolean().default(false) }),
    retorno: "{ itens: Array<{ id, nome, slug, cargo, credenciais, bio, email, perfis, ativo, url, posts: number }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db.from("authors").select("*").order("name");
      if (!a.inativos) q = q.eq("is_active", true);
      const autores = ok(await q) as Record<string, unknown>[];
      const { data: usos } = await ctx.db.from("contents").select("author_id, reviewer_id").neq("status", "archived");
      return {
        itens: autores.map((x) => ({
          id: x.id,
          nome: x.name,
          slug: x.slug,
          cargo: x.job_title,
          credenciais: x.credentials,
          bio: x.bio,
          email: x.email,
          perfis: x.same_as,
          ativo: x.is_active,
          url: noSite(ctx, `/autor/${x.slug}`),
          posts: (usos ?? []).filter((u) => u.author_id === x.id || u.reviewer_id === x.id).length,
        })),
      };
    },
  }),

  operacao({
    nome: "autores.salvar",
    resumo: "Cria ou edita um autor (sem id cria). Vira a página /autor/slug e o author.url do Article.",
    entrada: z.object({
      id: z.uuid().optional(),
      nome: z.string().min(2).max(120),
      slug: z.string().max(80).optional(),
      cargo: z.string().max(120).optional(),
      credenciais: z.string().max(300).optional(),
      bio: z.string().max(3000).optional(),
      email: z.string().email().optional(),
      perfis: z.array(z.string().url()).max(10).optional().describe("Links de perfis (LinkedIn, Instagram...)."),
    }),
    retorno: "{ id, slug, url }",
    risco: "escrita",
    soAdmin: true,
    async executar(a, ctx) {
      const slug = gerarSlug(a.slug || a.nome);
      const d = {
        name: a.nome.trim(),
        slug,
        job_title: a.cargo?.trim() || null,
        credentials: a.credenciais?.trim() || null,
        bio: a.bio?.trim() || null,
        email: a.email?.trim() || null,
        same_as: a.perfis ?? [],
      };
      const r = a.id
        ? await ctx.db.from("authors").update(d).eq("id", a.id).select("id, slug").maybeSingle()
        : await ctx.db.from("authors").insert(d).select("id, slug").single();
      if (r.error?.code === "23505") falhar(`Já existe autor com o endereço ${slug}.`, 409);
      const x = ok(r, "gravação");
      revalidatePath("/admin/autores");
      revalidatePath(`/autor/${x.slug}`);
      return { id: x.id, slug: x.slug, url: noSite(ctx, `/autor/${x.slug}`) };
    },
  }),

  operacao({
    nome: "autores.ativar",
    resumo: "Ativa ou desativa um autor.",
    entrada: z.object({ id, ativo: z.boolean() }),
    retorno: "{ ok: true }",
    risco: "escrita",
    soAdmin: true,
    async executar(a, ctx) {
      ok(await ctx.db.from("authors").update({ is_active: a.ativo }).eq("id", a.id), "mudança");
      revalidatePath("/admin/autores");
      return { ok: true };
    },
  }),
];
