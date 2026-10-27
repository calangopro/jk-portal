import { SITE } from "@/lib/seo/site";

/**
 * Os QR codes impressos, como dado.
 *
 * Cada QR tem um endereço que vai na arte e não muda mais, e um destino que
 * mora no painel e muda quando quiser. É isso que deixa trocar o número do
 * WhatsApp sem reimprimir adesivo nenhum, e saber de qual lugar veio a leitura.
 *
 *   - Slug vazio: `jkaliancas.com.br/qrcode`. É o dos banheiros do Shopping
 *     Tamboré (36 adesivos de outubro de 2026). Não se arquiva.
 *   - Os outros: `jkaliancas.com.br/qrcode/<slug>`.
 *
 * Dois modos de destino, e só um vale por vez:
 *   - `whatsapp`: número e mensagem pronta. A mensagem chega escrita na
 *     conversa, e é por ela que o atendimento sabe de onde veio o contato.
 *   - `link`: qualquer endereço https (a bio, um produto, uma campanha).
 */

export const MODOS_DO_QRCODE = ["whatsapp", "link"] as const;
export type ModoDoQrcode = (typeof MODOS_DO_QRCODE)[number];

/** O que decide para onde a leitura vai. */
export type DestinoDoQrcode = {
  modo: ModoDoQrcode;
  /** Só os dígitos do número local (DDD + número), sem o 55. */
  whatsapp: string;
  mensagem: string;
  link: string;
};

/** Uma linha de `qrcodes`. */
export type Qrcode = DestinoDoQrcode & {
  id: string;
  slug: string;
  nome: string;
  arquivado_em: string | null;
  criado_em: string;
};

export const COLUNAS_DO_QRCODE = "id, slug, nome, modo, whatsapp, mensagem, link, arquivado_em, criado_em";

/**
 * O destino do QR do Tamboré quando o banco não responde. O adesivo está
 * colado: sem banco, ele ainda leva ao WhatsApp do quiosque, que é o que a
 * arte promete ("Fala com a gente, quiosque JK, aqui no Tamboré").
 */
export function destinoDeFabrica(): DestinoDoQrcode {
  return {
    modo: "whatsapp",
    // O número da unidade Tamboré em /admin/lojas.
    whatsapp: "11991734391",
    mensagem: "Oi! Vi o QR code da JK aqui no Tamboré e quero saber mais.",
    link: "",
  };
}

/** A mensagem que um QR novo já traz, para a pessoa ajustar ao lugar. */
export const MENSAGEM_PADRAO = "Oi! Vi o QR code da JK e quero saber mais.";

/** O endereço que vai impresso. */
export function enderecoDoQrcode(slug: string): string {
  return `${SITE.lojaUrl}/qrcode${slug ? `/${slug}` : ""}`;
}

/** Endereço para mostrar na tela, sem o https://www. */
export const enderecoCurto = (slug: string) => enderecoDoQrcode(slug).replace(/^https:\/\/www\./, "");

export const SLUG_DO_QRCODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugValido(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 40 && SLUG_DO_QRCODE.test(slug);
}

/** "Banheiro do Shopping Osasco" para "banheiro-do-shopping-osasco". */
export function paraSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function linkDoWhatsappDoQrcode(numeroLocal: string, mensagem: string): string {
  const texto = mensagem.trim();
  return `https://wa.me/55${numeroLocal}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** Endereço https que não seja um QR, senão a leitura daria voltas. */
export function linkAceito(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    return !/\/qrcode(\/|$)/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Para onde a leitura vai agora. Null quando o modo escolhido está sem dado. */
export function destinoDoQrcode(c: DestinoDoQrcode): string | null {
  if (c.modo === "link") return linkAceito(c.link) ? c.link : null;
  return c.whatsapp ? linkDoWhatsappDoQrcode(c.whatsapp, c.mensagem) : null;
}

/** "WhatsApp (11) 99173-4391" ou o link, para a lista do painel. */
export function destinoLegivel(c: DestinoDoQrcode): string {
  if (c.modo === "link") return c.link;
  const d = c.whatsapp;
  const numero = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `WhatsApp ${numero}`;
}
