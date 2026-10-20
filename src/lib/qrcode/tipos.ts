import { z } from "zod";
import { SITE } from "@/lib/seo/site";

/**
 * O QR code impresso, como dado: para onde jkaliancas.com.br/qrcode leva.
 *
 * O endereço do QR é fixo e vai na arte. O destino mora aqui, no painel, e é
 * isso que deixa trocar o número do WhatsApp sem reimprimir adesivo nenhum.
 *
 * Dois modos, e um só vale por vez:
 *   - `whatsapp`: número e mensagem pronta. A mensagem chega escrita na
 *     conversa, e é por ela que o atendimento sabe que a pessoa veio do QR.
 *   - `link`: qualquer endereço https (a bio, um produto, uma campanha).
 *
 * O padrão de fábrica é o WhatsApp do quiosque do Tamboré, que é o que os
 * adesivos de outubro de 2026 prometem ("Fala com a gente, quiosque JK, aqui no
 * Tamboré"). Sem nada gravado no banco, o QR já funciona.
 */

export const MODOS_DO_QRCODE = ["whatsapp", "link"] as const;
export type ModoDoQrcode = (typeof MODOS_DO_QRCODE)[number];

export const esquemaDoQrcode = z.object({
  versao: z.literal(1),
  modo: z.enum(MODOS_DO_QRCODE).default("whatsapp"),
  /** Só os dígitos do número local (DDD + número), sem o 55. */
  whatsapp: z.string().default(""),
  mensagem: z.string().max(300).default(""),
  link: z.string().default(""),
});

export type ConfigDoQrcode = z.infer<typeof esquemaDoQrcode>;

export function qrcodeDeFabrica(): ConfigDoQrcode {
  return {
    versao: 1,
    modo: "whatsapp",
    // O número da unidade Tamboré em /admin/lojas.
    whatsapp: "11991734391",
    mensagem: "Oi! Vi o QR code da JK aqui no Tamboré e quero saber mais.",
    link: "",
  };
}

export function normalizarQrcode(valor: unknown): ConfigDoQrcode {
  const lido = esquemaDoQrcode.safeParse(valor);
  return lido.success ? lido.data : qrcodeDeFabrica();
}

/** O endereço que vai impresso. */
export const LINK_DO_QRCODE = `${SITE.lojaUrl}/qrcode`;

export function linkDoWhatsappDoQrcode(numeroLocal: string, mensagem: string): string {
  const texto = mensagem.trim();
  return `https://wa.me/55${numeroLocal}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** Endereço https que não seja o próprio QR, senão a leitura daria voltas. */
export function linkAceito(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    return !/\/qrcode\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Para onde a leitura vai agora. Null quando o modo escolhido está sem dado,
 * e aí quem chama decide a saída de emergência.
 */
export function destinoDoQrcode(c: ConfigDoQrcode): string | null {
  if (c.modo === "link") return linkAceito(c.link) ? c.link : null;
  return c.whatsapp ? linkDoWhatsappDoQrcode(c.whatsapp, c.mensagem) : null;
}
