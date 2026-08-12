import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

/**
 * 404 do site público.
 *
 * Existe porque o `not-found.tsx` da raiz fica FORA do grupo (site), e por isso
 * era renderizado sem cabeçalho, sem rodapé e sem nenhuma saída além do "voltar
 * ao início". A documentação de links do Google é direta: toda página precisa
 * levar a outra, e um endereço quebrado é justamente onde a pessoa mais precisa
 * de caminho. Este arquivo herda o layout de (site), então volta a ter navegação.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

const saidas = [
  {
    href: "/guia",
    titulo: "Guias de alianças",
    texto: "Materiais, medidas, larguras e cuidados, explicado por quem fabrica.",
  },
  {
    href: "/medidor-de-aliancas",
    titulo: "Medidor de aliança",
    texto: "Descubra o seu aro pela tela, sem sair de casa.",
  },
  {
    href: "/lojas",
    titulo: "Lojas JK Alianças",
    texto: "Endereço, horário e rota das unidades para provar no dedo.",
  },
];

export default function NotFoundDoSite() {
  return (
    <main>
      <Container size="wide" className="py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-apoio font-semibold uppercase tracking-[0.18em] text-brand-nav">
            Erro 404
          </p>
          <h1 className="font-display mt-4 max-w-[18ch] text-titulo-artigo text-ink">
            Esta página não existe
          </h1>
          <p className="linha-apoio mt-6 max-w-[52ch] text-lede">
            O endereço que você abriu não existe, foi movido ou saiu do ar.
            Abaixo estão os caminhos mais usados do portal.
          </p>
          <div aria-hidden className="filete-dourado mt-7" />
        </div>

        <nav aria-label="Onde ir a partir daqui" className="mt-12">
          <ul className="grid gap-4 sm:grid-cols-3">
            {saidas.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="block h-full rounded-[18px] border border-border bg-white/70 p-6 transition-colors hover:border-brand focus-visible:border-brand"
                >
                  <span className="font-display block text-titulo-bloco text-ink">
                    {s.titulo}
                  </span>
                  <span className="mt-2 block text-apoio text-ink/70">
                    {s.texto}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10">
          <Button href="/" variant="outline">
            Voltar ao início
          </Button>
        </div>
      </Container>
    </main>
  );
}
