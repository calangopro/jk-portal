import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { SITE } from "@/lib/seo/site";
import { itensDeFerramenta } from "@/lib/ferramentas/registro";

const NAVEGACAO = [
  { href: "/guia", rotulo: "Dicas sobre alianças" },
  { href: "/lojas", rotulo: "Nossas lojas" },
  { href: "/ferramentas", rotulo: "Todas as ferramentas" },
];

// Cada ferramenta com o nome próprio no rodapé: é link interno para a página
// que mais rende no portal, e some do rodapé só se sair do registro.
const FERRAMENTAS_NO_RODAPE = itensDeFerramenta();

/** Nome legível de cada perfil, derivado do domínio em SITE.sameAs. */
const REDES: Record<string, string> = {
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "youtube.com": "YouTube",
  "tiktok.com": "TikTok",
};

function nomeDaRede(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "").replace(/^pt-br\./, "");
  return REDES[host] ?? host;
}

/** Rodapé de autoridade em painel escuro, com dourado e filete no topo. */
export function SiteFooter() {
  return (
    <footer className="relative mt-28 overflow-hidden bg-charcoal text-white">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <Container size="wide" className="relative py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div className="max-w-sm">
            <Image
              src="/logo.svg"
              alt={SITE.name}
              width={150}
              height={50}
              className="h-9 w-auto"
            />
            <p className="mt-5 text-apoio leading-relaxed text-white/65">
              Alianças e joias com fábrica própria e atendimento presencial,
              feitas com cuidado para os momentos mais especiais.
            </p>
          </div>

          <nav aria-label="Conteúdo do site">
            <p className="eyebrow mb-4 text-brand-light">Portal</p>
            <ul className="space-y-3 text-apoio text-white/80">
              {NAVEGACAO.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="transition-colors hover:text-brand-light">
                    {i.rotulo}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="eyebrow mb-4 mt-8 text-brand-light">Ferramentas</p>
            <ul className="space-y-3 text-apoio text-white/80">
              {FERRAMENTAS_NO_RODAPE.map((f) => (
                <li key={f.href}>
                  <Link href={f.href} className="transition-colors hover:text-brand-light">
                    {f.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Perfis oficiais">
            <p className="eyebrow mb-4 text-brand-light">Onde encontrar</p>
            <ul className="space-y-3 text-apoio text-white/80">
              {SITE.sameAs.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener"
                    className="transition-colors hover:text-brand-light"
                  >
                    {nomeDaRede(url)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="eyebrow mb-4 text-brand-light">Comprar</p>
            <p className="text-apoio leading-relaxed text-white/65">
              Preço, estoque e compra ficam na loja oficial. Aqui é só conteúdo.
            </p>
            <a
              href={`${SITE.lojaUrl}?utm_source=portal&utm_medium=rodape`}
              target="_blank"
              rel="noopener"
              data-evento="clique_produto"
              data-destino="rodape"
              className="mt-4 inline-flex items-center gap-1.5 text-apoio font-semibold text-brand-light transition-colors hover:text-white"
            >
              Ir para a loja JK Alianças
              <span aria-hidden>&rarr;</span>
            </a>
          </div>
        </div>

        <p className="mt-14 border-t border-white/10 pt-6 text-nota leading-relaxed text-white/55">
          © {new Date().getFullYear()} {SITE.name}. Conteúdo informativo.
          Preços, estoque e compra na loja oficial.
        </p>
      </Container>
    </footer>
  );
}
