import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Navigation, MessageCircle, Clock } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Trilha } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { JsonLd } from "@/components/schema/JsonLd";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/lib/schema/builders";
import { lojasIndexMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublishedLocations, comFotos } from "@/lib/data/locations";
import { linkDoMaps, linkDoWaze, linkDoWhatsapp } from "@/lib/data/rotas";
import { INSTITUCIONAL, anosDeMercado } from "@/lib/content/institucional";
import type { Location } from "@/lib/content/types";

export const metadata: Metadata = lojasIndexMetadata();
export const revalidate = 3600;

/**
 * Agrupa por cidade.
 *
 * Quem procura loja procura por cidade antes de procurar por shopping, e a
 * capital concentra a maioria das unidades, então ela abre a lista.
 */
function porCidade(lojas: Location[]) {
  const grupos = new Map<string, Location[]>();
  for (const l of lojas) {
    const cidade = l.addressLocality ?? "Outras unidades";
    grupos.set(cidade, [...(grupos.get(cidade) ?? []), l]);
  }
  return [...grupos.entries()].sort((a, b) => {
    if (a[0] === "São Paulo") return -1;
    if (b[0] === "São Paulo") return 1;
    return b[1].length - a[1].length;
  });
}

function resumoDoHorario(l: Location): string | null {
  if (!l.openingHours?.length) return null;
  const semana = l.openingHours[0];
  return `${semana.opens} às ${semana.closes}`;
}

export default async function LojasIndex() {
  const lojas = await comFotos(await getPublishedLocations());
  const grupos = porCidade(lojas);

  return (
    <main>
      <JsonLd
        data={[
          webPageSchema({
            url: absoluteUrl("/lojas"),
            name: "Lojas JK Alianças",
          }),
          breadcrumbSchema([
            { name: "Início", url: absoluteUrl("/") },
            { name: "Lojas", url: absoluteUrl("/lojas") },
          ]),
          itemListSchema(
            lojas.map((l) => ({
              name: `JK Alianças ${l.name}`,
              url: absoluteUrl(`/lojas/${l.slug}`),
            })),
            "Lojas JK Alianças",
          ),
        ]}
      />
      <Container size="wide" className="py-12 sm:py-16">
        <header className="max-w-3xl">
          <Trilha passos={[{ nome: "Início", href: "/" }, { nome: "Lojas" }]} className="mb-7" />
          <div className="mb-5">
            <Pill>Onde comprar</Pill>
          </div>
          <h1 className="font-display max-w-[16ch] text-titulo-artigo text-ink">
            Lojas JK Alianças em São Paulo
          </h1>
          <p className="linha-apoio mt-6 max-w-[50ch] text-lede">
            São {INSTITUCIONAL.lojasFisicas} unidades em São Paulo e na Grande
            São Paulo, com aro de prova, ajuste de tamanho na hora e
            atendimento de quem fabrica a peça. A marca está no mercado há{" "}
            {anosDeMercado()} anos.
          </p>
          <div aria-hidden className="filete-dourado mt-7" />
        </header>

        {lojas.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title="Nenhuma loja publicada ainda"
              description="As páginas das unidades entram no pacote de SEO local."
              action={<Button href="/">Voltar ao início</Button>}
            />
          </div>
        ) : (
          <div className="mt-14 space-y-16">
            {grupos.map(([cidade, lista]) => (
              <section key={cidade} aria-labelledby={`cidade-${cidade.replace(/\s+/g, "-")}`}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
                  <h2
                    id={`cidade-${cidade.replace(/\s+/g, "-")}`}
                    className="font-display min-w-0 break-words text-titulo-secao text-ink"
                  >
                    {cidade}
                  </h2>
                  <div className="flex min-w-32 flex-1 items-baseline gap-4">
                    <span aria-hidden className="hairline flex-1" />
                    <span className="numeros shrink-0 text-nota text-muted">
                      {lista.length} {lista.length === 1 ? "loja" : "lojas"}
                    </span>
                  </div>
                </div>

                <ul className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((l, i) => {
                    const capa = l.fotos?.[0];
                    const horario = resumoDoHorario(l);
                    const whats = linkDoWhatsapp(l);
                    return (
                      <li key={l.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
                        <article className="glass-card flex h-full flex-col overflow-hidden rounded-lg">
                          <Link href={`/lojas/${l.slug}`} className="group block">
                            <div className="relative aspect-[3/2] overflow-hidden bg-media">
                              {capa ? (
                                <Image
                                  src={capa.url}
                                  alt={capa.alt || `Loja JK Alianças ${l.name}`}
                                  fill
                                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                                  className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] group-hover:scale-[1.04]"
                                />
                              ) : (
                                // Sem foto ainda: em vez de um retângulo cinza,
                                // um cartão com o nome do shopping, que é a
                                // informação que a pessoa está procurando.
                                <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sand to-media px-5 text-center">
                                  <MapPin size={18} aria-hidden className="text-brand-nav" />
                                  <span className="font-display text-titulo-bloco text-brand-strong">
                                    {l.mallName ?? l.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="p-5">
                              <p className="eyebrow text-[0.66rem]">
                                {l.addressLocality}
                                {l.addressRegion ? `, ${l.addressRegion}` : ""}
                              </p>
                              <h3 className="font-display mt-2 text-titulo-bloco text-ink transition-colors group-hover:text-brand-strong">
                                {l.name}
                              </h3>
                              <p className="mt-2 text-apoio leading-relaxed text-muted">
                                {l.address}
                              </p>
                              {horario ? (
                                <p className="mt-3 flex items-center gap-1.5 text-nota text-muted">
                                  <Clock size={12} aria-hidden className="text-brand-nav" />
                                  Seg a sáb, {horario}
                                </p>
                              ) : null}
                            </div>
                          </Link>

                          {/* Rota e contato direto no card: quem chega no índice
                              muitas vezes quer só o caminho, não a página. */}
                          <div className="mt-auto flex flex-wrap gap-2 border-t border-border/70 px-5 py-4">
                            <a
                              href={linkDoMaps(l)}
                              target="_blank"
                              rel="noopener"
                              data-evento="clique_rota"
                              data-destino={l.slug}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
                            >
                              <MapPin size={12} aria-hidden /> Maps
                            </a>
                            <a
                              href={linkDoWaze(l)}
                              target="_blank"
                              rel="noopener"
                              data-evento="clique_waze"
                              data-destino={l.slug}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
                            >
                              <Navigation size={12} aria-hidden /> Waze
                            </a>
                            {whats ? (
                              <a
                                href={whats}
                                target="_blank"
                                rel="noopener"
                                data-evento="clique_whatsapp"
                                data-destino={l.slug}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
                              >
                                <MessageCircle size={12} aria-hidden /> WhatsApp
                              </a>
                            ) : null}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <section className="mt-16 rounded-xl bg-charcoal px-8 py-12 text-white sm:px-12">
          <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <p className="eyebrow text-brand-light">Antes de ir</p>
              <h2 className="font-display mt-3 text-titulo-secao">
                Chegue na loja já sabendo seu aro
              </h2>
              <p className="mt-3 text-white/70">
                O medidor funciona pela tela do celular, com uma moeda de R$ 1
                para calibrar. Leva dois minutos.
              </p>
            </div>
            <Button href="/medidor-de-aliancas">Medir meu aro</Button>
          </div>
        </section>
      </Container>
    </main>
  );
}
