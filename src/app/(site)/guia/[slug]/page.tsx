import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDoGuia } from "@/components/conteudo/PaginaDoGuia";
import { guiaMetadata } from "@/lib/seo/metadata";
import { getGuiaBySlug, getPublishedGuias } from "@/lib/data/contents";

export const revalidate = 3600;
export const dynamicParams = true; // slugs novos entram sob demanda (ISR)

export async function generateStaticParams() {
  const guias = await getPublishedGuias();
  return guias.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const guia = await getGuiaBySlug((await params).slug);
  if (!guia) {
    return {
      title: "Página não encontrada",
      // `follow: true` de propósito. Numa 404 o Google deve continuar seguindo
      // os links da página (cabeçalho, rodapé, saídas). `nofollow` cortava a
      // descoberta do resto do site a partir de um endereço quebrado.
      robots: { index: false, follow: true },
    };
  }
  return guiaMetadata(guia);
}

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const guia = await getGuiaBySlug((await params).slug);
  if (!guia) notFound();
  return <PaginaDoGuia guia={guia} />;
}
