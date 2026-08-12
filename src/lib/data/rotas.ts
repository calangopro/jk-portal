import type { Location } from "@/lib/content/types";

/**
 * Links de "como chegar".
 *
 * Coordenada vence endereço sempre que existe: shopping tem várias entradas e
 * o roteador acerta muito mais com o ponto exato do que com o texto da rua.
 */

function enderecoCompleto(l: Location): string {
  return [l.address, l.addressLocality, l.addressRegion, l.postalCode]
    .filter(Boolean)
    .join(", ");
}

/** Link do Google Maps. Prefere o link curto oficial já cadastrado. */
export function linkDoMaps(l: Location): string {
  if (l.mapsUrl) return l.mapsUrl;
  if (l.gbpUrl) return l.gbpUrl;
  if (l.latitude != null && l.longitude != null) {
    const q = `${l.latitude},${l.longitude}`;
    // `query_place_id` faz o Maps abrir a ficha da loja, não só um alfinete.
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `JK Alianças ${enderecoCompleto(l)}`,
  )}`;
}

/** Link do Waze, que abre o app no celular e o site no computador. */
export function linkDoWaze(l: Location): string {
  if (l.wazeUrl) return l.wazeUrl;
  if (l.latitude != null && l.longitude != null) {
    return `https://waze.com/ul?ll=${l.latitude},${l.longitude}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(
    `JK Alianças ${enderecoCompleto(l)}`,
  )}&navigate=yes`;
}

/** Link do WhatsApp da unidade, com mensagem pronta. Null quando não há número. */
export function linkDoWhatsapp(l: Location): string | null {
  const numero = (l.whatsapp ?? l.phone ?? "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = `Olá! Vim pelo site e queria falar sobre alianças na loja ${l.name}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Telefone clicável. Null quando a unidade só tem WhatsApp. */
export function linkDeTelefone(l: Location): string | null {
  if (!l.phone) return null;
  return `tel:${l.phone.replace(/[^\d+]/g, "")}`;
}

/** Número formatado para leitura, a partir dos dígitos guardados. */
export function telefoneLegivel(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const d = bruto.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

export { enderecoCompleto };
