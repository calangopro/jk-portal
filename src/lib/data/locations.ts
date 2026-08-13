import { createReadClient } from "@/lib/supabase/read";
import type { Faq, Imagem, Location, OpeningHours } from "@/lib/content/types";
import { SAMPLE_LOCATIONS } from "./samples";
import { podeUsarExemplos, registrarFalha } from "./exemplos";

type Row = {
  id: string;
  slug: string;
  name: string;
  mall_name: string | null;
  unit_label: string | null;
  address: string;
  address_locality: string | null;
  address_region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: OpeningHours[] | null;
  hours_source: string | null;
  hours_note: string | null;
  gbp_url: string | null;
  gbp_place_id: string | null;
  maps_url: string | null;
  waze_url: string | null;
  utm: Record<string, string> | null;
  services: string[] | null;
  opened_at: string | null;
  about: string | null;
  highlights: string[] | null;
  faqs: Faq[] | null;
  rating: number | null;
  reviews_count: number | null;
  reviews_source: string | null;
  reviews_checked_at: string | null;
  sort_order: number | null;
  status: Location["status"];
  published_at: string | null;
  updated_at: string | null;
};

function mapRow(r: Row): Location {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    mallName: r.mall_name,
    unitLabel: r.unit_label,
    address: r.address,
    addressLocality: r.address_locality,
    addressRegion: r.address_region,
    postalCode: r.postal_code,
    country: r.country,
    phone: r.phone,
    whatsapp: r.whatsapp,
    latitude: r.latitude,
    longitude: r.longitude,
    openingHours: r.opening_hours,
    hoursSource: r.hours_source,
    hoursNote: r.hours_note,
    gbpUrl: r.gbp_url,
    gbpPlaceId: r.gbp_place_id,
    mapsUrl: r.maps_url,
    wazeUrl: r.waze_url,
    utm: r.utm,
    services: r.services,
    openedAt: r.opened_at,
    about: r.about,
    highlights: r.highlights,
    faqs: r.faqs,
    // Nota sem origem não vira dado. A mesma regra existe como constraint no
    // banco, mas repetir aqui protege quem ler direto de outro lugar.
    avaliacoes:
      r.rating != null && r.reviews_count != null && r.reviews_source
        ? {
            nota: Number(r.rating),
            quantidade: r.reviews_count,
            fonte: r.reviews_source,
            conferidoEm: r.reviews_checked_at,
          }
        : null,
    sortOrder: r.sort_order,
    status: r.status,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Lojas publicadas.
 *
 * Banco vazio devolve lista vazia. Erro é registrado e também devolve vazio,
 * para a página mostrar estado vazio em vez de endereço inventado.
 */
export async function getPublishedLocations(): Promise<Location[]> {
  const supabase = createReadClient();
  if (!supabase) {
    registrarFalha("getPublishedLocations", "cliente do Supabase indisponível");
    return podeUsarExemplos() ? SAMPLE_LOCATIONS : [];
  }

  try {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      registrarFalha("getPublishedLocations", error.message);
      return podeUsarExemplos() ? SAMPLE_LOCATIONS : [];
    }
    if (!data || data.length === 0) {
      // Vazio legítimo: nenhuma loja publicada ainda.
      return podeUsarExemplos() ? SAMPLE_LOCATIONS : [];
    }
    return (data as Row[]).map(mapRow);
  } catch (e) {
    registrarFalha("getPublishedLocations", e);
    return podeUsarExemplos() ? SAMPLE_LOCATIONS : [];
  }
}

/**
 * Uma loja pelo slug. Não encontrada devolve null, o que vira 404.
 * Um 404 honesto é muito melhor para SEO do que uma página com NAP falso.
 */
export async function getLocationBySlug(
  slug: string,
): Promise<Location | null> {
  const exemplo = () =>
    podeUsarExemplos() ? (SAMPLE_LOCATIONS.find((l) => l.slug === slug) ?? null) : null;

  const supabase = createReadClient();
  if (!supabase) {
    registrarFalha("getLocationBySlug", "cliente do Supabase indisponível");
    return exemplo();
  }

  try {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      registrarFalha("getLocationBySlug", error.message);
      return exemplo();
    }
    if (!data) return exemplo();
    return mapRow(data as Row);
  } catch (e) {
    registrarFalha("getLocationBySlug", e);
    return exemplo();
  }
}

/**
 * Fotos das lojas, em uma consulta só.
 *
 * Espelha `capasDosConteudos`: recebe vários ids de uma vez para o índice de
 * lojas não disparar uma consulta por card. A galeria ainda não tem foto
 * nenhuma cadastrada, e é justamente por isso que a leitura precisa aguentar
 * lista vazia sem quebrar nada na página.
 *
 * Devolve array porque o Data Cache do Next não serializa `Map`. O acesso por
 * chave fica em `mapaDeFotos`.
 */
export type FotosDaLoja = { locationId: string; fotos: Imagem[] };

/** Fotos de várias lojas, em uma consulta só. */
export async function fotosDasLojas(
  locationIds: string[],
): Promise<FotosDaLoja[]> {
  const ids = [...new Set(locationIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = createReadClient();
  if (!supabase) return [];

  // Agrupar por loja pede acesso por chave, então o `Map` continua aqui dentro.
  // O que não pode é ele ser o valor de RETORNO, porque é isso que o Data
  // Cache não sabe serializar.
  const porLoja = new Map<string, Imagem[]>();

  type Vinculo = {
    location_id: string;
    role: string;
    position: number;
    alt_override: string | null;
    caption_override: string | null;
    media: {
      id: string;
      url: string | null;
      alt: string | null;
      caption: string | null;
      credit: string | null;
      width: number | null;
      height: number | null;
      placeholder: string | null;
      focal_x: number | null;
      focal_y: number | null;
      deactivated_at: string | null;
    } | null;
  };

  try {
    const { data, error } = await supabase
      .from("location_media")
      .select(
        "location_id, role, position, alt_override, caption_override, media:media_id (id, url, alt, caption, credit, width, height, placeholder, focal_x, focal_y, deactivated_at)",
      )
      .in("location_id", ids)
      .order("position", { ascending: true });

    if (error) {
      registrarFalha("fotosDasLojas", error.message);
      return [];
    }

    for (const v of (data ?? []) as unknown as Vinculo[]) {
      const m = v.media;
      if (!m || !m.url || !m.width || !m.height || m.deactivated_at) continue;

      const foto: Imagem = {
        id: m.id,
        url: m.url,
        alt: v.alt_override ?? m.alt ?? "",
        width: m.width,
        height: m.height,
        caption: v.caption_override ?? m.caption,
        credit: m.credit,
        placeholder: m.placeholder,
        focalX: m.focal_x,
        focalY: m.focal_y,
      };

      const lista = porLoja.get(v.location_id) ?? [];
      // A capa (`hero`) abre a galeria, o resto segue a ordem cadastrada.
      if (v.role === "hero") lista.unshift(foto);
      else lista.push(foto);
      porLoja.set(v.location_id, lista);
    }
  } catch (e) {
    registrarFalha("fotosDasLojas", e);
  }

  return [...porLoja].map(([locationId, fotos]) => ({ locationId, fotos }));
}

/** Fotos indexadas por id da loja. */
export async function mapaDeFotos(locationIds: string[]): Promise<Map<string, Imagem[]>> {
  const lista = await fotosDasLojas(locationIds);
  return new Map(lista.map((f) => [f.locationId, f.fotos]));
}

/** Preenche `fotos` numa lista de lojas, sem uma consulta por item. */
export async function comFotos(lojas: Location[]): Promise<Location[]> {
  if (lojas.length === 0) return lojas;
  const fotos = await mapaDeFotos(lojas.map((l) => l.id));
  if (fotos.size === 0) return lojas;
  return lojas.map((l) => ({ ...l, fotos: fotos.get(l.id) ?? null }));
}
