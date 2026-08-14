import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { RegistrarEndereco } from "@/components/analytics/RegistrarEndereco";

/**
 * Corpo da página de endereço quebrado, em um lugar só.
 *
 * Existem DUAS portas de 404 no App Router: o `not-found.tsx` do grupo (site),
 * que responde quando uma rota do grupo chama `notFound()` (guia que não
 * existe, loja despublicada), e o `not-found.tsx` da raiz, que responde quando
 * o endereço não casa com rota nenhuma (`/qualquer-coisa`). A segunda é a mais
 * comum em link velho de fora, e era a que estava sem saída: só um botão de
 * voltar, sem cabeçalho e sem rodapé. As duas agora mostram a mesma coisa.
 */
const SAIDAS = [
  {
    href: "/guia",
    titulo: "Dicas sobre alianças",
    texto: "Tamanho, largura, material e cuidados, explicado por quem fabrica.",
  },
  {
    href: "/medidor-de-aliancas",
    titulo: "Medidor de aliança",
    texto: "Descubra o tamanho da sua aliança pela tela, sem sair de casa.",
  },
  {
    href: "/lojas",
    titulo: "Lojas JK Alianças",
    texto: "Endereço, horário e rota das unidades para experimentar de perto.",
  },
];

export function Pagina404() {
  return (
    <main>
      {/* Registra o endereço quebrado. Precisa ser no navegador: o Next
          renderiza este componente junto de páginas que respondem 200, então
          gravar no servidor contaria guia publicado como link quebrado. */}
      <RegistrarEndereco />
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
            Abaixo estão as páginas mais procuradas do site.
          </p>
          <div aria-hidden className="filete-dourado mt-7" />
        </div>

        <nav aria-label="Onde ir a partir daqui" className="mt-12">
          <ul className="grid gap-4 sm:grid-cols-3">
            {SAIDAS.map((s) => (
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
