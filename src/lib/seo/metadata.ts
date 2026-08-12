import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";
import type { Content, Location } from "@/lib/content/types";

type OgImage = { url: string; width?: number; height?: number; alt?: string };

type BuildInput = {
  title: string;
  description: string;
  /** Caminho relativo (ex.: "/guia/aliancas-de-namoro"); vira canonical absoluto. */
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
 * Quando `images` não é informado, deixamos o Next usar a imagem de OG gerada
 * por convenção em app/opengraph-image.tsx (arte de marca única para o site).
 *
 * As diretivas de preview (`max-image-preview:large`, `max-snippet:-1`,
 * `max-video-preview:-1`) não são detalhe: sem `max-image-preview:large` o
 * Google mostra miniatura pequena na busca e a página fica INELEGÍVEL para o
 * Google Discover, que exige essa diretiva na documentação. Ficam no `robots`
 * genérico, e não no `googleBot`, para que Bing e os demais também leiam.
 */
export function buildMetadata(input: BuildInput): Metadata {
  const canonical = input.canonical ?? absoluteUrl(input.path);
  const hasImages = !!input.images?.length;

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
      ...(hasImages ? { images: input.images } : {}),
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...(hasImages ? { images: input.images } : {}),
    },
  };
}

export function homeMetadata(): Metadata {
  return buildMetadata({
    title: `${SITE.name}: guia de alianças de casamento e namoro`,
    description: SITE.description,
    path: "/",
    type: "website",
  });
}

export function guiaIndexMetadata(): Metadata {
  return buildMetadata({
    title: `Guias de alianças | ${SITE.name}`,
    description:
      "Tudo o que você precisa saber antes de escolher sua aliança: materiais, medidas, larguras, cuidados e mais.",
    path: "/guia",
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
  if (!bruto) return absoluteUrl(`/guia/${c.slug}`);
  return bruto.startsWith("http") ? bruto : absoluteUrl(bruto);
}

export function guiaMetadata(c: Content): Metadata {
  return buildMetadata({
    title: c.metaTitle ?? `${c.title} | ${SITE.name}`,
    description: c.metaDescription ?? c.excerpt ?? SITE.description,
    path: `/guia/${c.slug}`,
    canonical: canonicalDoGuia(c),
    type: "article",
    images: c.ogImageUrl ? [{ url: c.ogImageUrl }] : undefined,
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
