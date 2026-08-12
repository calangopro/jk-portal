import type { Metadata } from "next";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Figura } from "@/components/ui/Figura";
import { EmptyState } from "@/components/ui/states";
import { homeMetadata } from "@/lib/seo/metadata";
import { getPublishedGuias, comCapas } from "@/lib/data/contents";
import { tempoDeLeitura, dataLonga } from "@/lib/content/leitura";
import type { Content } from "@/lib/content/types";

export const metadata: Metadata = homeMetadata();
export const revalidate = 3600; // ISR: HTML estático, revalidado de hora em hora

const PROVA = [
  { k: "Fábrica própria", v: "Controle de cada detalhe" },
  { k: "10 lojas físicas", v: "Atendimento presencial" },
  { k: "+17 mil avaliações", v: "Reputação comprovada" },
];

function metaDoGuia(g: Content) {
  const data = dataLonga(g.publishedAt);
  return (
    <>
      {data ? <time dateTime={g.publishedAt ?? undefined}>{data}</time> : null}
      <span>{tempoDeLeitura(g.bodyHtml ?? g.bodyMd)} min de leitura</span>
    </>
  );
}

export default async function Home() {
  const guias = await comCapas(await getPublishedGuias());

  // Capa do portal: um guia em destaque e os seguintes em coluna, como numa
  // primeira página. Antes eram dois cards do mesmo tamanho, sem hierarquia.
  const [destaque, ...resto] = guias;
  const secundarios = resto.slice(0, 4);

  return (
    <main>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="grain relative overflow-hidden">
        <Container size="wide" className="relative py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="eyebrow rise" style={{ animationDelay: "0ms" }}>
                Guia JK Alianças
              </p>
              {/* Sem animação de entrada: este h1 é o maior elemento da tela e
                  define o LCP. Começar em opacity 0 atrasa a métrica de graça. */}
              <h1 className="font-display mt-5 max-w-[15ch] text-display text-ink">
                Informação confiável para escolher a aliança certa
              </h1>
              <p
                className="rise mt-6 max-w-[44ch] text-lede leading-relaxed text-muted"
                style={{ animationDelay: "160ms" }}
              >
                Guias, comparativos e as lojas da JK Alianças, feito com fábrica
                própria e cuidado com cada detalhe.
              </p>
              <div
                className="rise mt-9 flex flex-wrap gap-3"
                style={{ animationDelay: "240ms" }}
              >
                <Button href="/guia">Ver os guias</Button>
                <Button href="/medidor-de-aliancas" variant="outline">
                  Medir meu aro
                </Button>
              </div>
            </div>

            {/* Card de prova em vidro */}
            <div
              className="rise glass relative rounded-xl p-7 sm:p-9"
              style={{ animationDelay: "320ms" }}
            >
              <p className="eyebrow">Por que a JK</p>
              <ul className="mt-6 space-y-5">
                {PROVA.map((p) => (
                  <li
                    key={p.k}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border/70 pb-5 last:border-0 last:pb-0"
                  >
                    <span className="font-display text-titulo-bloco text-brand-strong">
                      {p.k}
                    </span>
                    <span className="text-apoio text-muted">{p.v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------- Guias */}
      <section>
        <Container size="wide" className="py-14 sm:py-20">
          <div className="flex items-baseline gap-4">
            <h2 className="font-display shrink-0 text-titulo-secao text-ink">
              Guias para não errar
            </h2>
            <span aria-hidden className="hairline flex-1" />
            <Link
              href="/guia"
              className="shrink-0 text-apoio font-semibold text-brand-nav hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {guias.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                title="Guias a caminho"
                description="Os primeiros guias entram nos próximos pacotes de conteúdo."
                action={<Button href="/lojas">Ver as lojas</Button>}
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              {/* Chamada principal, no formato de capa. */}
              <article className="rise">
                <Link href={`/guia/${destaque.slug}`} className="group block">
                  {destaque.capa ? (
                    <Figura
                      imagem={{ ...destaque.capa, caption: null, credit: null }}
                      prioridade
                      proporcao="16 / 9"
                      sizes="(min-width: 1024px) 660px, 100vw"
                      className="overflow-hidden rounded-lg"
                    />
                  ) : null}
                  <div className={destaque.capa ? "mt-6" : ""}>
                    {destaque.cluster ? (
                      <Pill>
                        {destaque.cluster.charAt(0).toUpperCase() + destaque.cluster.slice(1)}
                      </Pill>
                    ) : null}
                    <h3 className="font-display mt-4 max-w-[22ch] text-titulo-secao text-ink transition-colors group-hover:text-brand-strong">
                      {destaque.title}
                    </h3>
                    {destaque.excerpt ? (
                      <p className="mt-3 max-w-[54ch] leading-relaxed text-muted">
                        {destaque.excerpt}
                      </p>
                    ) : null}
                    <p className="mt-4 flex flex-wrap items-center gap-x-3 text-nota text-muted">
                      {metaDoGuia(destaque)}
                    </p>
                  </div>
                </Link>
              </article>

              {secundarios.length > 0 ? (
                <ul className="space-y-5">
                  {secundarios.map((g, i) => (
                    <li key={g.id} className="rise" style={{ animationDelay: `${(i + 1) * 90}ms` }}>
                      <Card
                        href={`/guia/${g.slug}`}
                        titulo={g.title}
                        resumo={g.excerpt}
                        meta={metaDoGuia(g)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Container>
      </section>

      {/* ----------------------------------------------------------- Medidor */}
      <section>
        <Container size="wide" className="pb-14 sm:pb-20">
          <div className="glass relative overflow-hidden rounded-xl p-8 sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-sm border border-brand/30 bg-brand/10 text-brand-nav">
                  <Ruler size={20} aria-hidden />
                </span>
                <h2 className="font-display mt-5 text-titulo-secao text-ink">
                  Descubra seu aro pela tela, em dois minutos
                </h2>
                <p className="mt-3 leading-relaxed text-muted">
                  Calibre com uma moeda de R$ 1, apoie a aliança que já serve e
                  arraste o anel até encaixar. A medida sai em milímetros de verdade.
                </p>
              </div>
              <Button href="/medidor-de-aliancas" size="lg" icone={<Ruler size={18} />}>
                Medir meu aro
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------------- CTA band */}
      <section>
        <Container size="wide" className="pb-8">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-charcoal via-charcoal to-wine-deep px-8 py-14 text-white sm:px-14 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-lg">
                <p className="eyebrow text-brand-light">Onde comprar</p>
                <h2 className="font-display mt-3 text-titulo-secao leading-tight">
                  Prove no dedo, na loja mais perto de você
                </h2>
                <p className="mt-4 text-white/70">
                  Atendimento presencial nas unidades JK Alianças, com fábrica
                  própria e personalização.
                </p>
              </div>
              <Button href="/lojas">Ver as lojas</Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
