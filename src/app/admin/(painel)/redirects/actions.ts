"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { normalizar } from "@/lib/redirects/servir";

export type RedirectsState = { error?: string; success?: string };

export type LinhaDeRedirect = {
  id: string;
  origem: string;
  destino: string;
  motivo: string | null;
  status: "301" | "302" | "410";
};

export type EnderecoQuebrado = {
  path: string;
  hits: number;
  referrer: string | null;
  primeiraVez: string;
  ultimaVez: string;
  /** Melhor palpite de destino, ou null quando nada se parece. */
  sugestao: string | null;
  sugestaoTitulo: string | null;
};

export async function listarRedirects(): Promise<LinhaDeRedirect[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("redirects")
    .select("id, source_path, destination_url, reason, status")
    .order("source_path");

  return ((data ?? []) as {
    id: string;
    source_path: string;
    destination_url: string;
    reason: string | null;
    status: string;
  }[]).map((r) => ({
    id: r.id,
    origem: r.source_path,
    destino: r.destination_url,
    motivo: r.reason,
    status: r.status as "301" | "302" | "410",
  }));
}

/** Palavras úteis de um caminho, sem acento e sem as curtas demais. */
function palavras(caminho: string): string[] {
  return caminho
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && p !== "guia" && p !== "lojas");
}

/**
 * A fila de endereços quebrados, já com um palpite de destino.
 *
 * O palpite sai da semelhança entre as palavras do endereço pedido e os slugs
 * que existem. Não acerta sempre, e por isso é sugestão e não decisão: quem
 * confirma é a pessoa, com um clique. Sem palpite nenhum, cada linha da fila
 * exigiria abrir a lista de guias e procurar à mão.
 */
export async function enderecosQuebrados(): Promise<EnderecoQuebrado[]> {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: quebrados }, { data: guias }, { data: lojas }] = await Promise.all([
    supabase
      .from("not_found_hits")
      .select("path, hits, referrer, first_seen, last_seen")
      .eq("resolved", false)
      .order("hits", { ascending: false })
      .limit(50),
    supabase.from("contents").select("title, slug").eq("status", "published"),
    supabase.from("locations").select("name, slug").eq("status", "published"),
  ]);

  const alvos = [
    ...((guias ?? []) as { title: string; slug: string }[]).map((g) => ({
      url: `/guia/${g.slug}`,
      titulo: g.title,
      termos: palavras(g.slug),
    })),
    ...((lojas ?? []) as { name: string; slug: string }[]).map((l) => ({
      url: `/lojas/${l.slug}`,
      titulo: l.name,
      termos: palavras(l.slug),
    })),
  ];

  return ((quebrados ?? []) as {
    path: string;
    hits: number;
    referrer: string | null;
    first_seen: string;
    last_seen: string;
  }[]).map((q) => {
    const pedidas = palavras(q.path);

    let melhor: { url: string; titulo: string; nota: number } | null = null;
    for (const a of alvos) {
      const comuns = a.termos.filter((t) => pedidas.includes(t)).length;
      if (comuns === 0) continue;
      // Proporção, não contagem bruta: senão o guia com o slug mais longo
      // ganharia sempre, só por ter mais palavras para casar.
      const nota = comuns / Math.max(a.termos.length, pedidas.length);
      if (!melhor || nota > melhor.nota) melhor = { url: a.url, titulo: a.titulo, nota };
    }

    // Abaixo de um terço de palavras em comum o palpite atrapalha mais do que
    // ajuda, e redirect errado é pior que 404: manda a pessoa para o lugar
    // errado e ainda ensina o Google que aquele endereço virou outro.
    const bom = melhor && melhor.nota >= 0.34 ? melhor : null;

    return {
      path: q.path,
      hits: q.hits,
      referrer: q.referrer,
      primeiraVez: q.first_seen,
      ultimaVez: q.last_seen,
      sugestao: bom?.url ?? null,
      sugestaoTitulo: bom?.titulo ?? null,
    };
  });
}

function validarOrigem(bruto: string): { origem?: string; erro?: string } {
  const t = bruto.trim();
  if (!t) return { erro: "Informe o endereço antigo, o que está quebrado." };
  if (!t.startsWith("/")) {
    return { erro: "O endereço antigo precisa começar com barra, como /guia/alianca-antiga." };
  }
  if (t.startsWith("/admin") || t.startsWith("/api")) {
    return { erro: "O middleware não atende /admin nem /api, então um redirect aí não faria efeito." };
  }
  return { origem: normalizar(t) };
}

export async function salvarRedirect(
  _prev: RedirectsState,
  formData: FormData,
): Promise<RedirectsState> {
  await requireStaff();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "301");
  const motivo = String(formData.get("reason") ?? "").trim();
  const { origem, erro } = validarOrigem(String(formData.get("source_path") ?? ""));
  if (erro || !origem) return { error: erro };

  if (!["301", "302", "410"].includes(status)) return { error: "Tipo de redirect desconhecido." };

  let destino = String(formData.get("destination_url") ?? "").trim();
  if (status === "410") {
    // 410 diz "saiu de vez", não "mudou de lugar". Guardamos o próprio endereço
    // como destino porque a coluna é obrigatória e o middleware ignora o valor.
    destino = origem;
  } else {
    if (!destino) return { error: "Informe para onde este endereço deve levar." };
    if (!destino.startsWith("/") && !/^https?:\/\//i.test(destino)) {
      return { error: "O destino precisa começar com barra, ou com https:// se for para fora." };
    }
    if (normalizar(destino) === origem) {
      return { error: "O destino é o mesmo endereço de origem. Isso viraria um laço infinito." };
    }
  }

  const payload = {
    source_path: origem,
    destination_url: destino,
    reason: motivo || null,
    status,
  };

  const { error } = id
    ? await supabase.from("redirects").update(payload).eq("id", id)
    : await supabase.from("redirects").insert(payload);

  if (error) {
    if (error.code === "23505") {
      return { error: `Já existe um redirect para ${origem}. Edite o que existe.` };
    }
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  // Some da fila de endereços quebrados: já foi resolvido.
  await supabase.from("not_found_hits").update({ resolved: true }).eq("path", origem);

  revalidatePath("/admin/redirects");
  return { success: `Redirect de ${origem} salvo. O middleware pega em até um minuto.` };
}

/** Cria o redirect direto da fila, com o palpite já preenchido. */
export async function aceitarSugestao(formData: FormData): Promise<void> {
  await requireStaff();
  const origem = String(formData.get("path") ?? "");
  const destino = String(formData.get("sugestao") ?? "");
  if (!origem || !destino) return;

  const dados = new FormData();
  dados.set("source_path", origem);
  dados.set("destination_url", destino);
  dados.set("status", "301");
  dados.set("reason", "Endereço quebrado encontrado pela fila de 404 do painel.");
  await salvarRedirect({}, dados);
}

/** Tira da fila sem criar redirect: nem todo 404 merece um. */
export async function ignorarEndereco(formData: FormData): Promise<void> {
  await requireStaff();
  const path = String(formData.get("path") ?? "");
  if (!path) return;
  const supabase = await createClient();
  await supabase.from("not_found_hits").update({ resolved: true }).eq("path", path);
  revalidatePath("/admin/redirects");
}

export async function removerRedirect(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("redirects").delete().eq("id", id);
  revalidatePath("/admin/redirects");
}
