import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Trilha } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { JsonLd } from "@/components/schema/JsonLd";
import { breadcrumbSchema, profilePageSchema } from "@/lib/schema/builders";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, SITE } from "@/lib/seo/site";
import { autorPorSlug, autoresAtivos, conteudosDoAutor } from "@/lib/data/autores";
import { dataLonga } from "@/lib/content/leitura";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const autores = await autoresAtivos();
  return autores.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const autor = await autorPorSlug((await params).slug);
  if (!autor) {
    return {
      title: "Página não encontrada",
      robots: { index: false, follow: true },
    };
  }

  const cargo = autor.jobTitle ? `${autor.jobTitle} na ${SITE.name}` : SITE.name;
  return buildMetadata({
    title: `${autor.name}, ${cargo} | ${SITE.name}`,
    description:
      autor.bio?.trim() ||
      `Conteúdos sobre alianças escritos por ${autor.name}${
        autor.jobTitle ? `, ${autor.jobTitle}` : ""
      } na ${SITE.name}.`,
    path: `/autor/${autor.slug}`,
    type: "website",
    images: autor.foto
      ? [
          {
            url: autor.foto.url,
            width: autor.foto.width,
            height: autor.foto.height,
            alt: autor.foto.alt,
          },
        ]
      : undefined,
  });
}

/**
 * Página de autor.
 *
 * É o destino do `author.url` que o JSON-LD de Article passou a declarar, e o
 * lugar onde a documentação do Google espera encontrar a resposta ao "quem
 * escreveu isto". Sem esta página, a assinatura no artigo é só um nome.
 */
export default async function PaginaDoAutor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const autor = await autorPorSlug((await params).slug);
  if (!autor) notFound();

  const conteudos = await conteudosDoAutor(autor.id);

  return (
    <main>
      <JsonLd data={profilePageSchema(autor, conteudos)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: autor.name, url: absoluteUrl(`/autor/${autor.slug}`) },
        ])}
      />

      <Container size="wide" className="py-12 sm:py-16">
        <Trilha
          passos={[{ nome: "Início", href: "/" }, { nome: autor.name }]}
          className="mb-7"
        />

        <header className="flex flex-col gap-7 sm:flex-row sm:items-start">
          {autor.foto ? (
            <Image
              src={autor.foto.url}
              alt={autor.foto.alt}
              width={autor.foto.width}
              height={autor.foto.height}
              sizes="140px"
              priority
              className="h-[140px] w-[140px] shrink-0 rounded-full object-cover"
              {...(autor.foto.placeholder
                ? { placeholder: "blur" as const, blurDataURL: autor.foto.placeholder }
                : {})}
            />
          ) : null}

          <div className="max-w-2xl">
            <div className="mb-5">
              <Pill>Quem escreve</Pill>
            </div>
            <h1 className="font-display text-titulo-artigo text-ink">{autor.name}</h1>
            {autor.jobTitle ? (
              <p className="mt-3 text-lede text-ink/80">{autor.jobTitle}</p>
            ) : null}
            {autor.credentials ? (
              <p className="mt-2 text-apoio text-ink/70">{autor.credentials}</p>
            ) : null}
            <div aria-hidden className="filete-dourado mt-7" />
            {autor.bio ? (
              <p className="linha-apoio mt-7 max-w-[58ch] text-corpo">{autor.bio}</p>
            ) : null}

            {autor.sameAs.length ? (
              <ul className="mt-7 flex flex-wrap gap-4">
                {autor.sameAs.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener"
                      className="text-apoio text-brand-nav underline underline-offset-4 hover:text-brand-strong"
                    >
                      {new URL(url).hostname.replace(/^www\./, "")}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        {conteudos.length ? (
          <section className="mt-16">
            <h2 className="font-display text-titulo-secao text-ink">
              O que {autor.name.split(" ")[0]} assina
            </h2>
            <ul className="mt-7 grid gap-4 sm:grid-cols-2">
              {conteudos.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/guia/${c.slug}`}
                    className="block h-full rounded-[18px] border border-border bg-white/70 p-6 transition-colors hover:border-brand focus-visible:border-brand"
                  >
                    <span className="font-display block text-titulo-bloco text-ink">
                      {c.title}
                    </span>
                    {c.excerpt ? (
                      <span className="mt-2 block text-apoio text-ink/70">
                        {c.excerpt}
                      </span>
                    ) : null}
                    {c.publishedAt ? (
                      <span className="mt-3 block text-apoio text-muted">
                        {dataLonga(c.publishedAt)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
