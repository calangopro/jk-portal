import { z } from "zod";
import { SITE } from "@/lib/seo/site";
import { TEMAS_DA_BIO } from "@/lib/bio/tipos";

/**
 * A página /grupo, como dado: para onde o grupo leva e com que cara.
 *
 * Os TEXTOS do formulário não moram aqui. Eles são os do bloco "Grupo de
 * ofertas no WhatsApp" da campanha do dia, no Link da bio, e é isso que faz a
 * página virar Black sozinha em 01/11 com o texto da Black, sem ninguém
 * lembrar de trocar dois lugares.
 *
 * O que mora aqui é o que só existe uma vez:
 *   - `destino`: o convite do grupo (ou o link do DevZapp que distribui entre
 *     vários grupos). Quando o grupo enche, troca AQUI, e o anúncio, a bio, o
 *     QR das lojas e o ManyChat continuam com o mesmo link.
 *   - `tema`: "campanha" acompanha a campanha do dia da bio; os outros fixam.
 */

export const TEMAS_DO_GRUPO = ["campanha", ...TEMAS_DA_BIO] as const;
export type TemaDoGrupo = (typeof TEMAS_DO_GRUPO)[number];

export const esquemaDoGrupo = z.object({
  versao: z.literal(1),
  destino: z.string().default(""),
  tema: z.enum(TEMAS_DO_GRUPO).default("campanha"),
});

export type ConfigDoGrupo = z.infer<typeof esquemaDoGrupo>;

export function grupoDeFabrica(): ConfigDoGrupo {
  return { versao: 1, destino: "", tema: "campanha" };
}

export function normalizarGrupo(valor: unknown): ConfigDoGrupo {
  const lido = esquemaDoGrupo.safeParse(valor);
  return lido.success ? lido.data : grupoDeFabrica();
}

/** A página do anúncio, com cadastro. */
export const PAGINA_DO_GRUPO = `${SITE.lojaUrl}/grupo`;

/**
 * O link que leva direto ao grupo, sem cadastro. É o que vai na bio, no QR das
 * lojas, no ManyChat e no fim do atendimento.
 */
export const LINK_DO_GRUPO = `${SITE.lojaUrl}/grupo/entrar`;

/** Convite de grupo do WhatsApp ou outro endereço https (o redirecionador do DevZapp). */
export function destinoAceito(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    // O próprio link fixo daria uma volta infinita.
    return !/\/grupo\/entrar\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}
