import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MapPin, Search } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";
import { CampoDeBusca } from "@/components/busca/CampoDeBusca";
import { buscar } from "@/lib/busca/consultar";

/**
 * Página de resultado da busca.
 *
 * `noindex, follow` porque resultado de busca interna não deve ser indexado: o
 * Google trata página de busca como conteúdo raso e gerado, e uma delas por
 * consulta encheria o índice de páginas quase iguais. O `follow` fica para os
 * links daqui continuarem passando autoridade para os guias.
 */
export const metadata: Metadata = {
  title: "Busca",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function PaginaDeBusca({ searchParams }: Props) {
  const { q } = await searchParams;
  const consulta = (q ?? "").trim();
  const resultado = consulta ? await buscar(consulta, 20) : null;
  const total = resultado ? resultado.guias.length + resultado.lojas.length : 0;

  return (
    <main>
      <Container size="wide" className="py-14 sm:py-20">
        <h1 className="font-display text-titulo-artigo text-ink">
          {consulta ? <>Resultados para “{consulta}”</> : "Buscar no site"}
        </h1>

        <div className="mt-7 max-w-2xl">
          <CampoDeBusca autoFoco={!consulta} />
        </div>

        {consulta ? (
          <p className="mt-4 text-apoio text-muted">
            {total === 0
              ? "Nada encontrado."
              : `${total} ${total === 1 ? "resultado" : "resultados"}.`}
            {resultado && !resultado.comSignificado ? (
              <span className="ml-1">
                A busca por significado está indisponível agora, então este resultado veio só
                por palavra.
              </span>
            ) : null}
          </p>
        ) : null}

        {consulta && total === 0 ? (
          <div className="mt-10 max-w-2xl">
            <EmptyState
              title="Nada encontrado para essa busca"
              description="Tente com outras palavras, ou veja os posts publicados. Se você procurou uma loja, o índice de lojas tem todas as unidades."
              action={<Button href="/guia">Ver os posts</Button>}
            />
          </div>
        ) : null}

        {resultado && resultado.guias.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-apoio font-semibold uppercase tracking-[0.14em] text-muted">
              Posts
            </h2>
            <ul className="mt-4 space-y-3">
              {resultado.guias.map((a) => (
                <li key={`${a.tipo}-${a.slug}-${a.secao ?? ""}`}>
                  <Link href={a.href} className="glass-card group block rounded-lg p-5">
                    <span className="flex items-start gap-3">
                      <FileText size={16} aria-hidden className="mt-1 shrink-0 text-brand-nav" />
                      <span className="min-w-0">
                        <span className="font-display block text-titulo-bloco text-ink transition-colors group-hover:text-brand-strong">
                          {a.secao ?? a.titulo}
                        </span>
                        {a.secao ? (
                          <span className="mt-0.5 block text-nota text-muted">{a.titulo}</span>
                        ) : null}
                        <span className="mt-2 block leading-relaxed text-muted">{a.trecho}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {resultado && resultado.lojas.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-apoio font-semibold uppercase tracking-[0.14em] text-muted">
              Lojas
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {resultado.lojas.map((a) => (
                <li key={a.slug}>
                  <Link href={a.href} className="glass-card group block rounded-lg p-5">
                    <span className="flex items-start gap-3">
                      <MapPin size={16} aria-hidden className="mt-1 shrink-0 text-brand-nav" />
                      <span className="min-w-0">
                        <span className="font-display block text-titulo-bloco text-ink transition-colors group-hover:text-brand-strong">
                          {a.titulo}
                        </span>
                        <span className="mt-1 block text-nota leading-relaxed text-muted">
                          {a.trecho}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!consulta ? (
          <p className="mt-10 flex items-center gap-2 text-apoio text-muted">
            <Search size={15} aria-hidden />
            Escreva sua dúvida com as próprias palavras. A busca entende o sentido, não só a
            palavra exata.
          </p>
        ) : null}
      </Container>
    </main>
  );
}
