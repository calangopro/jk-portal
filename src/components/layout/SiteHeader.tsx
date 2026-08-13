import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { NavPrincipal, type ItemNav } from "./NavPrincipal";
import { ProgressoLeitura } from "./ProgressoLeitura";
import { SITE } from "@/lib/seo/site";
import { BuscaNoCabecalho } from "@/components/busca/BuscaNoCabecalho";

const ITENS: ItemNav[] = [
  { href: "/guia", rotulo: "Guias" },
  { href: "/medidor-de-aliancas", rotulo: "Medidor" },
  { href: "/lojas", rotulo: "Lojas" },
];

/**
 * Cabeçalho fixo em vidro. A fixação é puro CSS (sticky); só a navegação do
 * celular e o filete de progresso precisam de JavaScript.
 */
export function SiteHeader() {
  return (
    <header className="glass-nav sticky top-0 z-50">
      <Container
        size="wide"
        className="flex h-16 items-center justify-between gap-4 sm:gap-6"
      >
        <Link
          href="/"
          aria-label={`${SITE.name}, página inicial`}
          className="flex items-center"
        >
          <Image
            src="/logo.svg"
            alt={SITE.name}
            width={132}
            height={44}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <BuscaNoCabecalho />

        <NavPrincipal itens={ITENS} />
      </Container>

      <ProgressoLeitura />
    </header>
  );
}
