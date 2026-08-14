"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { gerarSlug, slugDisponivel } from "@/lib/data/admin-contents";
import { acharModelo } from "@/lib/editor/modelos";
import {
  ehStatusDaPauta,
  notaDaOportunidade,
  porqueDaOportunidade,
  type Oportunidade,
  type Pauta,
  type StatusDaPauta,
} from "@/lib/content/pautas";

export type PautasState = { error?: string; success?: string };

const COLUNAS =
  "id, target_query, title, search_intent, cluster, notes, modelo, status, origem, impressions, clicks, position, ctr, content_id, contents(title, slug, status)";

type LinhaDoBanco = {
  id: string;
  target_query: string;
  title: string | null;
  search_intent: string | null;
  cluster: string | null;
  notes: string | null;
  modelo: string | null;
  status: string;
  origem: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  content_id: string | null;
  contents: { title: string; slug: string; status: string } | null;
};

function paraPauta(l: LinhaDoBanco): Pauta {
  return {
    id: l.id,
    targetQuery: l.target_query,
    title: l.title,
    searchIntent: l.search_intent,
    cluster: l.cluster,
    notes: l.notes,
    modelo: l.modelo,
    status: l.status as StatusDaPauta,
    origem: l.origem as "gsc" | "manual",
    impressions: l.impressions,
    clicks: l.clicks,
    position: l.position,
    ctr: l.ctr,
    contentId: l.content_id,
    conteudoTitulo: l.contents?.title ?? null,
    conteudoSlug: l.contents?.slug ?? null,
    conteudoStatus: l.contents?.status ?? null,
  };
}

export async function listarPautas(): Promise<Pauta[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("briefings").select(COLUNAS).order("created_at", { ascending: false });
  return ((data ?? []) as unknown as LinhaDoBanco[]).map(paraPauta);
}

/**
 * Consultas do Search Console que ainda não viraram pauta nem página.
 *
 * A fonte é `analytics_snapshots`, que já recebe a importação do CSV. Aqui só
 * juntamos as quatro métricas de cada consulta (elas chegam em linhas
 * separadas), tiramos o que já está em trabalho e ordenamos por oportunidade.
 *
 * Só o período mais recente entra: comparar consulta de janeiro com consulta de
 * agosto na mesma lista daria uma fila que mistura realidades diferentes.
 */
export async function oportunidades(limite = 30): Promise<Oportunidade[]> {
  await requireStaff();
  const supabase = await createClient();

  const { data: periodos } = await supabase
    .from("analytics_snapshots")
    .select("period_end")
    .eq("source", "gsc")
    .eq("dimension", "query")
    .order("period_end", { ascending: false })
    .limit(1);

  const ultimo = (periodos ?? [])[0]?.period_end as string | undefined;
  if (!ultimo) return [];

  const [{ data: linhas }, { data: pautas }, { data: conteudos }] = await Promise.all([
    supabase
      .from("analytics_snapshots")
      .select("dimension_value, metric, value")
      .eq("source", "gsc")
      .eq("dimension", "query")
      .eq("period_end", ultimo),
    supabase.from("briefings").select("target_query"),
    supabase.from("contents").select("target_query").not("target_query", "is", null),
  ]);

  // Consulta já em trabalho não volta para a fila. A comparação ignora caixa
  // porque o Search Console e o editor não combinam maiúscula entre si.
  const emTrabalho = new Set<string>();
  for (const p of (pautas ?? []) as { target_query: string }[]) {
    emTrabalho.add(p.target_query.trim().toLowerCase());
  }
  for (const c of (conteudos ?? []) as { target_query: string }[]) {
    emTrabalho.add(c.target_query.trim().toLowerCase());
  }

  const porConsulta = new Map<string, Record<string, number>>();
  for (const l of (linhas ?? []) as { dimension_value: string; metric: string; value: number }[]) {
    const atual = porConsulta.get(l.dimension_value) ?? {};
    atual[l.metric] = Number(l.value);
    porConsulta.set(l.dimension_value, atual);
  }

  const achadas: Oportunidade[] = [];
  for (const [consulta, m] of porConsulta) {
    if (emTrabalho.has(consulta.trim().toLowerCase())) continue;

    const base = {
      impressoes: m.impressions ?? 0,
      cliques: m.clicks ?? 0,
      posicao: m.position ?? 0,
      ctr: m.ctr ?? 0,
    };
    const nota = notaDaOportunidade(base);
    if (nota <= 0) continue;

    achadas.push({ consulta, ...base, nota, porque: porqueDaOportunidade(base) });
  }

  return achadas.sort((a, b) => b.nota - a.nota).slice(0, limite);
}

/**
 * Páginas que já miram uma consulta parecida.
 *
 * Roda antes de criar a pauta, porque canibalização custa barato de evitar
 * agora e caro de desfazer depois que as duas páginas estão no ar.
 */
async function conflitos(consulta: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const alvo = consulta.trim().toLowerCase();
  const { data } = await supabase
    .from("contents")
    .select("title, slug, status, target_query")
    .not("target_query", "is", null);

  return ((data ?? []) as { title: string; slug: string; status: string; target_query: string }[]).filter(
    (c) => c.target_query.trim().toLowerCase() === alvo,
  );
}

export async function criarPauta(_prev: PautasState, formData: FormData): Promise<PautasState> {
  const perfil = await requireStaff();
  const supabase = await createClient();

  const targetQuery = String(formData.get("target_query") ?? "").trim();
  if (!targetQuery) {
    return { error: "Diga qual busca esta página quer ganhar. Sem isso não dá para medir nada depois." };
  }

  const choques = await conflitos(targetQuery, supabase);
  if (choques.length > 0) {
    const c = choques[0];
    return {
      error:
        `Já existe uma página mirando "${targetQuery}": ${c.title}. ` +
        "Duas páginas na mesma intenção disputam entre si e as duas perdem. Melhore a que existe, ou escolha outro recorte.",
    };
  }

  const numero = (chave: string) => {
    const v = String(formData.get(chave) ?? "").trim();
    if (!v) return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const { error } = await supabase.from("briefings").insert({
    target_query: targetQuery,
    title: String(formData.get("title") ?? "").trim() || null,
    search_intent: String(formData.get("search_intent") ?? "").trim() || null,
    cluster: String(formData.get("cluster") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    modelo: String(formData.get("modelo") ?? "").trim() || null,
    origem: String(formData.get("origem") ?? "manual") === "gsc" ? "gsc" : "manual",
    impressions: numero("impressions"),
    clicks: numero("clicks"),
    position: numero("position"),
    ctr: numero("ctr"),
    created_by: perfil.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Já existe uma pauta para "${targetQuery}". Abra a que existe em vez de criar outra.` };
    }
    return { error: `Não foi possível criar a pauta: ${error.message}` };
  }

  revalidatePath("/admin/pautas");
  return { success: `Pauta criada para "${targetQuery}".` };
}

export async function mudarStatusDaPauta(id: string, status: StatusDaPauta): Promise<PautasState> {
  await requireStaff();
  if (!ehStatusDaPauta(status)) return { error: "Status desconhecido." };

  const supabase = await createClient();
  const { error } = await supabase.from("briefings").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/pautas");
  return { success: "Status alterado." };
}

/**
 * A pauta vira rascunho, e o rascunho já nasce preenchido.
 *
 * É o ponto inteiro desta tela. O editor deixa de abrir uma página em branco e
 * abre com consulta alvo, intenção, cluster e o esqueleto do modelo escolhido.
 * Os produtos que combinam com a consulta entram como relacionados: relação de
 * verdade, visível e removível no editor, não texto inventado no corpo.
 */
export async function virarRascunho(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: pauta } = await supabase
    .from("briefings")
    .select("id, target_query, title, search_intent, cluster, notes, modelo, content_id")
    .eq("id", id)
    .maybeSingle();

  if (!pauta) return;

  // Pauta que já virou rascunho abre o rascunho, em vez de criar um segundo.
  if (pauta.content_id) redirect(`/admin/conteudos/${pauta.content_id}`);

  const modelo = acharModelo(pauta.modelo ?? "");
  const titulo = pauta.title?.trim() || modelo?.titulo || pauta.target_query;
  const slug = await slugDisponivel(gerarSlug(titulo));

  const { data: conteudo, error } = await supabase
    .from("contents")
    .insert({
      type: "guia",
      title: titulo,
      slug,
      status: "draft",
      target_query: pauta.target_query,
      search_intent: pauta.search_intent ?? modelo?.intencao ?? null,
      cluster: pauta.cluster ?? null,
      answer: modelo?.resposta ?? null,
      body_html: modelo?.bodyHtml ?? null,
      faqs: modelo?.faqs ?? null,
    })
    .select("id")
    .single();

  if (error || !conteudo) throw new Error(error?.message ?? "Falha ao criar o rascunho.");

  await supabase
    .from("briefings")
    .update({ content_id: conteudo.id, status: "escrevendo" })
    .eq("id", pauta.id);

  await ligarProdutosProvaveis(conteudo.id, pauta.target_query);

  revalidatePath("/admin/pautas");
  revalidatePath("/admin/conteudos");
  redirect(`/admin/conteudos/${conteudo.id}`);
}

/**
 * Sugere produtos pelo nome, a partir das palavras da consulta.
 *
 * Sugestão, não decisão: entram como `related` em `content_products`, aparecem
 * no editor e saem de lá com um clique. Palavra de três letras ou menos fica de
 * fora porque "de", "com" e "18k" trariam meio catálogo.
 */
async function ligarProdutosProvaveis(contentId: string, consulta: string) {
  const supabase = await createClient();

  const palavras = consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 3);

  if (palavras.length === 0) return;

  const { data } = await supabase
    .from("products")
    .select("id, name")
    .eq("is_active", true)
    .not("price", "is", null)
    .ilike("name", `%${palavras[0]}%`)
    .limit(3);

  const produtos = (data ?? []) as { id: string }[];
  if (produtos.length === 0) return;

  await supabase.from("content_products").insert(
    produtos.map((p, i) => ({
      content_id: contentId,
      product_id: p.id,
      relation: "related",
      position: i,
    })),
  );
}
