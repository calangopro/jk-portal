"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { DIAS } from "./dias";

/**
 * Põe a busca em dia depois de mexer numa loja.
 *
 * Recebe o id junto do slug por um motivo específico: `getLocationBySlug`
 * filtra por `status = 'published'` E, em desenvolvimento, cai para os dados de
 * exemplo quando não acha. Se esta função dependesse só dele, despublicar uma
 * loja deixaria os trechos dela na busca (levando a pessoa para um 404), e em
 * dev poderia acabar indexando uma loja fictícia do `samples.ts`.
 *
 * Import dinâmico para a service_role ficar fora do pacote das telas. Falha
 * aqui não derruba o salvamento: o índice é derivado.
 */
async function reindexarLoja(id: string, slug: string, publicada: boolean) {
  try {
    if (!publicada) {
      const { removerDoIndice } = await import("@/lib/busca/indexar");
      await removerDoIndice("loja", id);
      return;
    }
    const [{ getLocationBySlug }, { indexarLoja }] = await Promise.all([
      import("@/lib/data/locations"),
      import("@/lib/busca/indexar"),
    ]);
    const loja = await getLocationBySlug(slug);
    // Confere o id: se vier exemplo do samples.ts, o id não bate e a gente não
    // indexa dado fictício.
    if (loja && loja.id === id) await indexarLoja(loja);
  } catch (e) {
    console.error("[busca] não consegui reindexar a loja", slug, e);
  }
}

export type LojaState = { erro?: string; ok?: string };


function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

/** Cria uma loja em rascunho e abre a edição. */
export async function criarLoja() {
  await requireStaff();
  const supabase = await createClient();

  const base = "nova-loja";
  let slug = base;
  for (let i = 2; i < 40; i++) {
    const { data } = await supabase.from("locations").select("id").eq("slug", slug).limit(1);
    if (!data || data.length === 0) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({ slug, name: "Nova loja", address: "", status: "draft" })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar a loja.");
  revalidatePath("/admin/lojas");
  redirect(`/admin/lojas/${data.id}`);
}

/**
 * Salva a loja.
 *
 * Os horários chegam como um campo por dia e são agrupados aqui: dias com o
 * mesmo horário viram uma única entrada, que é o formato que o schema.org
 * espera em OpeningHoursSpecification.
 */
export async function salvarLoja(
  _prev: LojaState,
  formData: FormData,
): Promise<LojaState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("name") ?? "").trim();
  const endereco = String(formData.get("address") ?? "").trim();
  if (!id) return { erro: "Loja não identificada." };
  if (!nome) return { erro: "A loja precisa de um nome." };

  const slugBruto = String(formData.get("slug") ?? "").trim();
  const slug = slugificar(slugBruto || nome);

  // Agrupa dias com o mesmo horário.
  const porHorario = new Map<string, string[]>();
  for (const d of DIAS) {
    if (String(formData.get(`aberto_${d.chave}`) ?? "") !== "1") continue;
    const abre = String(formData.get(`abre_${d.chave}`) ?? "").trim();
    const fecha = String(formData.get(`fecha_${d.chave}`) ?? "").trim();
    if (!abre || !fecha) continue;
    const chave = `${abre}|${fecha}`;
    porHorario.set(chave, [...(porHorario.get(chave) ?? []), d.chave]);
  }
  const horarios = [...porHorario.entries()].map(([chave, dias]) => {
    const [opens, closes] = chave.split("|");
    return { dayOfWeek: dias, opens, closes };
  });

  const servicos = String(formData.get("services") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const numero = (campo: string) => {
    const v = String(formData.get(campo) ?? "").trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const texto = (campo: string) => {
    const v = String(formData.get(campo) ?? "").trim();
    return v || null;
  };

  const inteiro = (campo: string) => {
    const v = String(formData.get(campo) ?? "").trim();
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  // O formulário manda o FAQ como JSON num campo escondido. Pergunta ou
  // resposta em branco não vai para o schema: FAQPage com item vazio é erro
  // de dados estruturados no Search Console.
  const perguntas = (() => {
    try {
      const bruto = JSON.parse(String(formData.get("faqs") ?? "[]"));
      if (!Array.isArray(bruto)) return [];
      return bruto
        .map((f: { question?: string; answer?: string }) => ({
          question: String(f.question ?? "").trim(),
          answer: String(f.answer ?? "").trim(),
        }))
        .filter((f) => f.question && f.answer);
    } catch {
      return [];
    }
  })();

  const destaques = String(formData.get("highlights") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Guardamos só dígitos com DDI, que é o formato que o wa.me aceita.
  const whatsappBruto = String(formData.get("whatsapp") ?? "").replace(/\D/g, "");
  const whatsapp = whatsappBruto
    ? whatsappBruto.startsWith("55")
      ? whatsappBruto
      : `55${whatsappBruto}`
    : null;

  // Avaliação sem origem não é dado, é chute. O banco também recusa, mas
  // barrar aqui deixa a mensagem legível em vez de um erro de constraint.
  const fonteAvaliacao = String(formData.get("reviews_source") ?? "").trim();
  const notaPreenchida = String(formData.get("rating") ?? "").trim();
  if (notaPreenchida && !fonteAvaliacao) {
    return {
      erro: "Para publicar uma nota é preciso dizer de onde ela veio. Preencha a origem da avaliação.",
    };
  }
  const temFonteDeAvaliacao = Boolean(fonteAvaliacao);

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({
      name: nome,
      slug,
      address: endereco,
      address_locality: texto("address_locality"),
      address_region: texto("address_region"),
      postal_code: texto("postal_code"),
      phone: texto("phone"),
      latitude: numero("latitude"),
      longitude: numero("longitude"),
      gbp_url: texto("gbp_url"),
      gbp_place_id: texto("gbp_place_id"),
      opening_hours: horarios.length > 0 ? horarios : null,
      services: servicos.length > 0 ? servicos : null,

      // Identidade da unidade
      mall_name: texto("mall_name"),
      unit_label: texto("unit_label"),
      opened_at: texto("opened_at"),
      about: texto("about"),
      highlights: destaques.length > 0 ? destaques : null,
      faqs: perguntas.length > 0 ? perguntas : null,

      // Como chegar e falar
      maps_url: texto("maps_url"),
      waze_url: texto("waze_url"),
      whatsapp: whatsapp,

      // Horário: a fonte é o que autoriza a publicação do horário
      hours_source: texto("hours_source"),
      hours_note: texto("hours_note"),

      // Avaliações: só entram com origem. Sem fonte, os três campos zeram
      // juntos, senão sobraria uma nota órfã no banco.
      rating: temFonteDeAvaliacao ? numero("rating") : null,
      reviews_count: temFonteDeAvaliacao ? inteiro("reviews_count") : null,
      reviews_source: temFonteDeAvaliacao ? texto("reviews_source") : null,
      reviews_checked_at: temFonteDeAvaliacao ? texto("reviews_checked_at") : null,

      sort_order: inteiro("sort_order") ?? 0,
    })
    .eq("id", id);

  if (error) {
    if (error.message.includes("duplicate")) {
      return { erro: "Já existe outra loja com esse endereço de página." };
    }
    return { erro: error.message };
  }

  // O status não muda aqui, então vem do banco para decidir entre indexar e
  // remover.
  const { data: estado } = await supabase
    .from("locations")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  await reindexarLoja(id, slug, estado?.status === "published");

  revalidatePath("/admin/lojas");
  revalidatePath(`/lojas/${slug}`);
  revalidatePath("/lojas");
  return { ok: "Salvo." };
}

/**
 * Publica ou tira do ar.
 *
 * Publicar exige NAP mínimo, porque loja publicada emite JSON-LD JewelryStore,
 * e endereço incompleto vira sinal local errado no Google.
 */
export async function mudarStatusLoja(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "archived"].includes(status)) return;

  const supabase = await createClient();

  if (status === "published") {
    const { data } = await supabase
      .from("locations")
      .select("name, address, address_locality")
      .eq("id", id)
      .maybeSingle();

    const falta =
      !data?.name?.trim() || !data?.address?.trim() || !data?.address_locality?.trim();
    if (falta) {
      // Sem NAP completo a loja não vai ao ar.
      revalidatePath("/admin/lojas");
      return;
    }
  }

  const { data: alterada } = await supabase
    .from("locations")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  // Entrar ou sair do ar muda o que a busca deve mostrar. `indexarLoja` já
  // apaga os trechos sozinho quando o status não é publicado.
  if (alterada?.slug) await reindexarLoja(id, alterada.slug, status === "published");

  revalidatePath("/admin/lojas");
  revalidatePath("/lojas");
}

/* --------------------------------------------------------------- galeria */

export type FotoDaLoja = {
  vinculoId: string;
  mediaId: string;
  url: string;
  alt: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  role: string;
  position: number;
};

/** Fotos já vinculadas a uma loja, na ordem em que aparecem no site. */
export async function fotosDaLoja(locationId: string): Promise<FotoDaLoja[]> {
  await requireStaff();
  const supabase = await createClient();

  const { data } = await supabase
    .from("location_media")
    .select(
      "id, media_id, role, position, media:media_id (url, alt, credit, width, height)",
    )
    .eq("location_id", locationId)
    .order("position", { ascending: true });

  type Linha = {
    id: string;
    media_id: string;
    role: string;
    position: number;
    media: {
      url: string | null;
      alt: string | null;
      credit: string | null;
      width: number | null;
      height: number | null;
    } | null;
  };

  return ((data ?? []) as unknown as Linha[])
    .filter((l) => l.media?.url)
    .map((l) => ({
      vinculoId: l.id,
      mediaId: l.media_id,
      url: l.media!.url!,
      alt: l.media!.alt,
      credit: l.media!.credit,
      width: l.media!.width,
      height: l.media!.height,
      role: l.role,
      position: l.position,
    }));
}

/**
 * Liga uma foto à loja.
 *
 * Exige alt e dimensão, como a capa dos guias: foto de loja aparece na busca
 * local e no card do índice, e imagem sem alt é barreira de acessibilidade
 * publicada de propósito.
 */
export async function adicionarFotoDaLoja(
  locationId: string,
  mediaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: midia } = await supabase
    .from("media")
    .select("alt, width, height")
    .eq("id", mediaId)
    .maybeSingle();

  const m = midia as { alt: string | null; width: number | null; height: number | null } | null;
  if (!m?.alt?.trim()) {
    return { ok: false, erro: "Esta foto está sem texto alternativo. Corrija em Mídia antes de usar." };
  }
  if (!m.width || !m.height) {
    return { ok: false, erro: "Esta foto está sem dimensão registrada, e sem isso a página pula quando ela carrega." };
  }

  const { data: existentes } = await supabase
    .from("location_media")
    .select("position")
    .eq("location_id", locationId)
    .order("position", { ascending: false })
    .limit(1);

  const proxima = ((existentes?.[0] as { position: number } | undefined)?.position ?? -1) + 1;

  const { error } = await supabase.from("location_media").insert({
    location_id: locationId,
    media_id: mediaId,
    role: "gallery",
    position: proxima,
  });

  if (error) {
    if (error.message.includes("duplicate")) {
      return { ok: false, erro: "Esta foto já está na galeria desta loja." };
    }
    return { ok: false, erro: error.message };
  }

  revalidatePath("/lojas");
  return { ok: true };
}

/** Tira a foto da galeria. O arquivo continua na biblioteca de mídia. */
export async function removerFotoDaLoja(vinculoId: string): Promise<{ ok: boolean }> {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("location_media").delete().eq("id", vinculoId);
  revalidatePath("/lojas");
  return { ok: true };
}

/**
 * Reordena a galeria.
 *
 * Recebe a lista inteira já na ordem certa e regrava a posição de cada uma. É
 * mais simples e mais seguro do que trocar duas linhas de lugar, porque nunca
 * deixa duas fotos com a mesma posição.
 */
export async function reordenarFotosDaLoja(
  vinculoIds: string[],
): Promise<{ ok: boolean }> {
  await requireStaff();
  const supabase = await createClient();

  await Promise.all(
    vinculoIds.map((id, i) =>
      supabase.from("location_media").update({ position: i }).eq("id", id),
    ),
  );

  revalidatePath("/lojas");
  return { ok: true };
}
