import type { Metadata } from "next";
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
import { ListaDeLojas } from "@/components/lojas/ListaDeLojas";
import { INSTITUCIONAL, anosDeMercado } from "@/lib/content/institucional";

export const metadata: Metadata = lojasIndexMetadata();
export const revalidate = 3600;

export default async function LojasIndex() {
  const lojas = await comFotos(await getPublishedLocations());

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
          <ListaDeLojas lojas={lojas} />
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
