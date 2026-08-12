import { JsonLd } from "@/components/schema/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/schema/builders";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Medicao } from "@/components/analytics/Medicao";
import { RastreioCliques } from "@/components/analytics/RastreioCliques";

/**
 * Moldura do site PÚBLICO (cabeçalho, rodapé e JSON-LD global).
 * Fica num route group para não envolver a área /admin, que tem chrome próprio
 * e nunca deve ser indexada.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Link de pulo para o conteúdo (acessibilidade / teclado). */}
      <a
        href="#conteudo"
        className="sr-only rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
      >
        Pular para o conteúdo
      </a>

      {/* Dados estruturados globais — presentes no HTML de toda página pública. */}
      <JsonLd data={[organizationSchema(), webSiteSchema()]} />
      <SiteHeader />
      <div id="conteudo">{children}</div>
      <SiteFooter />
      {/* Medição: só em produção e só se conectada no painel. */}
      <Medicao />
      <RastreioCliques />
    </>
  );
}
