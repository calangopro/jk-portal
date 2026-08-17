import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { NavPrincipal, type ItemNav } from "./NavPrincipal";
import { ProgressoLeitura } from "./ProgressoLeitura";
import { SITE } from "@/lib/seo/site";
import { BuscaNoCabecalho } from "@/components/busca/BuscaNoCabecalho";
import { itensDeFerramenta } from "@/lib/ferramentas/registro";

import { comBasePath } from "@/lib/seo/base-path";
const ITENS: ItemNav[] = [
  { href: "/dicas", rotulo: "Dicas" },
  {
    href: "/ferramentas",
    rotulo: "Ferramentas",
    // Cada ferramenta aparece pelo nome, e não escondida atrás do índice.
    // Ferramenta nova entra no menu só por existir no registro.
    filhos: itensDeFerramenta().map((f) => ({
      href: f.href,
      rotulo: f.nome,
      resumo: f.chamada,
      chave: f.chave,
    })),
  },
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
            // `next/image` entrega SVG as-is (sem `dangerouslyAllowSVG`, o
            // otimizador não toca em .svg), e nesse caminho o `src` sai cru,
            // sem o basePath. Imagem OTIMIZADA não precisa disto: ela vira
            // /guias/_next/image?url=… porque o Next prefixa `images.path`,
            // e prefixar o `url` ali faria o otimizador procurar o arquivo
            // em public/guias/. Por isso o prefixo entra só aqui.
            src={comBasePath("/logo.svg")}
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
