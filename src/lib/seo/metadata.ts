import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";
import { OG_PADRAO } from "./og";
import type { Content, Location } from "@/lib/content/types";

type OgImage = { url: string; width?: number; height?: number; alt?: string };

type BuildInput = {
  title: string;
  description: string;
  /** Caminho relativo (ex.: "/aliancas-de-namoro"); vira canonical absoluto. */
  path: string;
  /** Canonical absoluto explícito. Quando ausente, é derivado de `path`. */
  canonical?: string;
  type?: "website" | "article";
  images?: OgImage[];
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * Fábrica central de metadata. Garante canonical absoluto e coerência de Open
 * Graph. Usamos `title.absolute` para o título NÃO ser reprocessado pelo
 * template do layout (`%s | JK Alianças`), porque cada função abaixo já inclui
 * a marca uma única vez, evitando a duplicação "| JK Alianças | JK Alianças".
 *
 * Quando `images` não é informado, entra a arte de marca de `(site)/og`. Ela é
 * declarada aqui, e não deixada para a convenção `opengraph-image.tsx`, porque
 * a convenção vale só para o segmento onde o arquivo está e não desce para os
 * de baixo: com ela, só a home tinha imagem e todo o resto do site ia para o
 * WhatsApp com card cego.
 *
 * As diretivas de preview (`max-image-preview:large`, `max-snippet:-1`,
 * `max-video-preview:-1`) não são detalhe: sem `max-image-preview:large` o
 * Google mostra miniatura pequena na busca e a página fica INELEGÍVEL para o
 * Google Discover, que exige essa diretiva na documentação. Ficam no `robots`
 * genérico, e não no `googleBot`, para que Bing e os demais também leiam.
 */
export function buildMetadata(input: BuildInput): Metadata {
  const canonical = input.canonical ?? absoluteUrl(input.path);
  const imagens: OgImage[] = input.images?.length
    ? input.images
    : [
        {
          url: absoluteUrl(OG_PADRAO.path),
          width: OG_PADRAO.width,
          height: OG_PADRAO.height,
          alt: OG_PADRAO.alt,
        },
      ];

  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical },
    robots: input.noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName: SITE.name,
      locale: SITE.locale,
      type: input.type ?? "website",
      images: imagens,
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: imagens,
    },
  };
}

export function homeMetadata(): Metadata {
  return buildMetadata({
    title: `Tudo sobre alianças, joias e semijoias | ${SITE.name}`,
    description: SITE.description,
    path: "/",
    type: "website",
  });
}

export function guiaIndexMetadata(): Metadata {
  return buildMetadata({
    // O escopo da página é aliança, joia e semijoia, o mesmo do site. Um
    // título só de aliança deixava metade do conteúdo fora do que a busca lê.
    title: `Dicas de alianças, joias e semijoias | ${SITE.name}`,
    description:
      "Como escolher aliança, joia e semijoia: tamanho do aro, largura, ouro, prata, banhado, preço e cuidados no uso diário. Escrito por quem fabrica.",
    path: "/dicas",
    type: "website",
  });
}

/**
 * Canonical de um guia, em um lugar só.
 *
 * O campo `canonical_url` existe para conteúdo sindicado e precisa valer tanto
 * para o `<link rel="canonical">` quanto para o `@id` do JSON-LD. Antes cada
 * lado calculava do seu jeito (o schema respeitava o campo, o metadata não), e
 * os dois podiam apontar para URLs diferentes na mesma página, o que faz o
 * Google escolher a canônica sozinho.
 */
export function canonicalDoGuia(c: {
  slug: string;
  canonicalUrl?: string | null;
}): string {
  const bruto = c.canonicalUrl?.trim();
  if (!bruto) return absoluteUrl(`/${c.slug}`);
  return bruto.startsWith("http") ? bruto : absoluteUrl(bruto);
}

export function guiaMetadata(c: Content): Metadata {
  return buildMetadata({
    title: c.metaTitle ?? `${c.title} | ${SITE.name}`,
    description: c.metaDescription ?? c.excerpt ?? SITE.description,
    path: `/${c.slug}`,
    canonical: canonicalDoGuia(c),
    type: "article",
    // Ordem de preferência: a imagem escolhida no admin, senão a arte que o
    // próprio guia gera com o título e a resposta rápida dentro. A arte de
    // marca do site é a última linha, e para o guia ela nunca é a melhor: no
    // WhatsApp o link ficava igual ao da home. Dimensão e alt vão junto porque
    // sem elas o card sai sem prévia grande em alguns leitores.
    images: c.ogImageUrl
      ? [{ url: c.ogImageUrl }]
      : [
          {
            url: absoluteUrl(`/${c.slug}/og`),
            width: 1200,
            height: 630,
            alt: `${c.title} | ${SITE.name}`,
          },
        ],
    publishedTime: c.publishedAt ?? undefined,
    modifiedTime: c.updatedAt ?? undefined,
  });
}

export function lojasIndexMetadata(): Metadata {
  return buildMetadata({
    title: `Lojas ${SITE.name} | Onde comprar`,
    description:
      "Encontre a loja JK Alianças mais próxima: endereço, horários e serviços de cada unidade.",
    path: "/lojas",
    type: "website",
  });
}

export function lojaMetadata(l: Location): Metadata {
  const cidade = l.addressLocality ?? "São Paulo";

  // Quem busca loja busca por marca mais lugar ("jk alianças aricanduva"), e
  // o título precisa bater com isso na primeira metade, antes do corte.
  const titulo = `${SITE.name} ${l.name}, ${cidade} | Endereço e horário`;

  const horario = l.openingHours?.length
    ? "Veja o horário, "
    : "Veja endereço, ";

  return buildMetadata({
    title: titulo,
    description:
      `Loja JK Alianças no ${l.mallName ?? l.name}, em ${cidade}. ` +
      `${l.address}. ${horario}os serviços da unidade e a rota pelo Google Maps ou pelo Waze.`,
    path: `/lojas/${l.slug}`,
    type: "website",
  });
}
