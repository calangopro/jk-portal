import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { JsonLd } from "@/components/schema/JsonLd";
import { breadcrumbSchema } from "@/lib/schema/builders";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

// Placeholder do futuro PILAR (cluster campeão). Marcado noindex até existir
// conteúdo real com fontes aprovadas — não indexar página fina.
export const metadata: Metadata = buildMetadata({
  title: "Alianças de namoro (em construção)",
  description:
    "Página pilar em construção. O guia completo de alianças de namoro entra em um pacote de conteúdo dedicado.",
  path: "/guia/aliancas-de-namoro",
  type: "article",
  noindex: true,
});

export default function AliancasDeNamoroPlaceholder() {
  return (
    <main>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Dicas", url: absoluteUrl("/guia") },
          {
            name: "Alianças de namoro",
            url: absoluteUrl("/guia/aliancas-de-namoro"),
          },
        ])}
      />
      <Container className="py-16 sm:py-24">
        <p className="inline-block rounded-full bg-cream px-3 py-1 text-xs font-semibold text-brand-strong">
          Em construção (placeholder)
        </p>
        <h1 className="mt-5 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
          Alianças de namoro
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Este é o espaço reservado para o guia pilar de{" "}
          <strong>alianças de namoro</strong>, o cluster prioritário da
          estratégia. A estrutura já existe; o conteúdo real, com fontes
          aprovadas e revisão humana, entra em um pacote dedicado.
        </p>
        <div className="mt-8">
          <Button href="/guia" variant="outline">
            Ver outros guias
          </Button>
        </div>
      </Container>
    </main>
  );
}
