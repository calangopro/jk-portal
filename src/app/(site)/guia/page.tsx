import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Trilha } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { JsonLd } from "@/components/schema/JsonLd";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/lib/schema/builders";
import { guiaIndexMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublishedGuias, comCapas } from "@/lib/data/contents";
import { tempoDeLeitura, dataLonga } from "@/lib/content/leitura";
import type { Content } from "@/lib/content/types";

export const metadata: Metadata = guiaIndexMetadata();
export const revalidate = 3600;

/**
 * Agrupa por cluster, preservando a ordem de publicação dentro de cada grupo.
 * Guia sem cluster cai num grupo final, sem título inventado.
 */
function porCluster(guias: Content[]) {
  const grupos = new Map<string, Content[]>();
  const soltos: Content[] = [];

  for (const g of guias) {
    if (!g.cluster) {
      soltos.push(g);
      continue;
    }
    const atual = grupos.get(g.cluster) ?? [];
    atual.push(g);
    grupos.set(g.cluster, atual);
  }

  return { grupos: [...grupos.entries()], soltos };
}

function comMaiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O cluster vira id de âncora, e id com espaço não é id válido. */
function paraId(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function metaDoGuia(g: Content) {
  const data = dataLonga(g.publishedAt);
  return (
    <>
      {data ? <time dateTime={g.publishedAt ?? undefined}>{data}</time> : null}
      <span>{tempoDeLeitura(g.bodyHtml ?? g.bodyMd)} min de leitura</span>
    </>
  );
}

export default async function GuiaIndex() {
  const guias = await comCapas(await getPublishedGuias());
  const { grupos, soltos } = porCluster(guias);

  return (
    <main>
      <JsonLd
        data={[
          webPageSchema({
            url: absoluteUrl("/guia"),
            name: "Dicas de alianças e joias",
          }),
          breadcrumbSchema([
            { name: "Início", url: absoluteUrl("/") },
            { name: "Dicas", url: absoluteUrl("/guia") },
          ]),
          // A lista existe na tela; declarar isso é o tipo mais específico que
          // cabe numa página de índice, como pede a documentação.
          itemListSchema(
            guias.map((g) => ({
              name: g.title,
              url: absoluteUrl(`/guia/${g.slug}`),
            })),
            "Dicas de alianças e joias",
          ),
        ]}
      />
      <Container size="wide" className="py-12 sm:py-16">
        <header className="max-w-3xl">
          <Trilha passos={[{ nome: "Início", href: "/" }, { nome: "Dicas" }]} className="mb-7" />
          <div className="mb-5">
            <Pill>Conteúdo</Pill>
          </div>
          {/* O título fala de aliança E de joia de propósito. "Dicas sobre
              alianças" prometia menos do que a página entrega: aqui também tem
              material, o que muda entre ouro, prata e semijoia, e como cuidar da
              peça. Quem chegava pelo menu "Dicas" e caía num título mais estreito
              lia a página como se ela fosse só sobre tamanho de aliança. */}
          <h1 className="font-display max-w-[18ch] text-titulo-artigo text-ink">
            Dicas de alianças e joias
          </h1>
          <p className="linha-apoio mt-6 max-w-[52ch] text-lede">
            Como escolher o tamanho, a largura e o material, o que muda entre
            ouro, prata e semijoia, e como cuidar da peça depois. Escrito por
            quem fabrica.
          </p>
          <div aria-hidden className="filete-dourado mt-7" />
        </header>

        {guias.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title="Nenhum post publicado ainda"
              description="Os primeiros posts entram nos próximos pacotes de conteúdo."
              action={<Button href="/">Voltar ao início</Button>}
            />
          </div>
        ) : (
          <div className="mt-14 space-y-16">
            {grupos.map(([cluster, lista]) => (
              <section key={cluster} aria-labelledby={`grupo-${paraId(cluster)}`}>
                <div className="flex items-baseline gap-4">
                  <h2
                    id={`grupo-${paraId(cluster)}`}
                    className="font-display shrink-0 text-titulo-secao text-ink"
                  >
                    {comMaiuscula(cluster)}
                  </h2>
                  <span aria-hidden className="hairline flex-1" />
                  <span className="numeros shrink-0 text-nota text-muted">
                    {lista.length} {lista.length === 1 ? "post" : "posts"}
                  </span>
                </div>

                <ul className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((g, i) => (
                    <li key={g.id} className="rise" style={{ animationDelay: `${i * 90}ms` }}>
                      <Card
                        href={`/guia/${g.slug}`}
                        titulo={g.title}
                        resumo={g.excerpt}
                        imagem={g.capa}
                        meta={metaDoGuia(g)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {soltos.length > 0 ? (
              <section aria-labelledby="grupo-outros">
                <div className="flex items-baseline gap-4">
                  <h2 id="grupo-outros" className="font-display shrink-0 text-titulo-secao text-ink">
                    Outros posts
                  </h2>
                  <span aria-hidden className="hairline flex-1" />
                </div>
                <ul className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {soltos.map((g, i) => (
                    <li key={g.id} className="rise" style={{ animationDelay: `${i * 90}ms` }}>
                      <Card
                        href={`/guia/${g.slug}`}
                        titulo={g.title}
                        resumo={g.excerpt}
                        imagem={g.capa}
                        meta={metaDoGuia(g)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Container>
    </main>
  );
}
