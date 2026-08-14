"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { SimboloDaFerramenta } from "@/components/ferramentas/Simbolo";

export type SubItemNav = {
  href: string;
  rotulo: string;
  resumo?: string;
  /** Chave do emblema em `SimboloDaFerramenta`. */
  chave?: string;
};

export type ItemNav = {
  href: string;
  rotulo: string;
  /** Quando existe, o item vira menu: no desktop abre painel, no celular lista. */
  filhos?: SubItemNav[];
};

/**
 * Navegação principal.
 *
 * No desktop é uma lista simples com indicação da rota ativa. No celular vira
 * gaveta: antes os links ficavam sempre visíveis, o que só funcionava porque
 * são três e curtos. Qualquer item novo quebrava a linha em 360px.
 *
 * As ferramentas entram como submenu, e não como mais um link solto. Elas são
 * o conteúdo que mais rende no portal, e um item "Ferramentas" que só leva a um
 * índice esconde o que existe lá dentro. Aqui cada uma aparece pelo nome, com
 * emblema, nos dois tamanhos de tela.
 */
export function NavPrincipal({ itens }: { itens: ItemNav[] }) {
  const rota = usePathname();
  const [aberto, setAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const gaveta = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const barra = useRef<HTMLElement>(null);

  const ativo = (href: string) => rota === href || rota.startsWith(`${href}/`);
  const ativoComFilhos = (i: ItemNav) =>
    ativo(i.href) || (i.filhos ?? []).some((f) => ativo(f.href));

  // Fecha ao trocar de página.
  useEffect(() => {
    setAberto(false);
    setMenuAberto(null);
  }, [rota]);

  // Painel do desktop: Esc fecha, clique fora fecha.
  useEffect(() => {
    if (!menuAberto) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(null);
    };
    const aoClicar = (e: MouseEvent) => {
      if (barra.current && !barra.current.contains(e.target as Node)) {
        setMenuAberto(null);
      }
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [menuAberto]);

  // Esc fecha e devolve o foco ao botão. Enquanto aberta, a página não rola.
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !gaveta.current) return;

      // Prende o foco dentro da gaveta.
      const focaveis = gaveta.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  const classeDoLink = (estaAtivo: boolean) =>
    `relative py-2 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-300 hover:text-brand-nav hover:after:scale-x-100 ${
      estaAtivo ? "text-brand-nav after:scale-x-100" : "text-ink/80"
    }`;

  return (
    <>
      {/* Desktop */}
      <nav ref={barra} aria-label="Principal" className="hidden md:block">
        <ul className="flex items-center gap-8 text-apoio font-medium">
          {itens.map((i) =>
            i.filhos?.length ? (
              <li
                key={i.href}
                className="relative"
                onMouseEnter={() => setMenuAberto(i.href)}
                onMouseLeave={() => setMenuAberto(null)}
              >
                {/* O item é LINK, não botão. Como o painel já abre no hover,
                    um botão que alterna faria o clique fechar o menu que o
                    próprio mouse acabou de abrir. Assim o clique leva ao índice,
                    que é o destino esperado, e o painel continua servindo de
                    atalho. */}
                <Link
                  href={i.href}
                  aria-haspopup="true"
                  aria-expanded={menuAberto === i.href}
                  aria-current={ativo(i.href) ? "page" : undefined}
                  onFocus={() => setMenuAberto(i.href)}
                  className={`${classeDoLink(ativoComFilhos(i))} flex items-center gap-1.5`}
                >
                  {i.rotulo}
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={`transition-transform duration-300 ${
                      menuAberto === i.href ? "rotate-180" : ""
                    }`}
                  />
                </Link>

                {menuAberto === i.href ? (
                  // O respiro de cima é padding, não margem: com margem o mouse
                  // sai do item antes de chegar no painel e o menu pisca.
                  // Alinhado pela DIREITA do item: a navegação vive no canto
                  // direito do cabeçalho, e um painel centralizado no item
                  // escapava da tela em janela estreita.
                  <div className="absolute right-0 top-full z-50 w-[23rem] max-w-[calc(100vw-2rem)] pt-3">
                    {/* Quase opaco, e não vidro: o painel cai em cima de
                        conteúdo (às vezes um desenho), e vidro translúcido
                        deixava o texto do menu ilegível. */}
                    <div className="etapa rounded-lg border border-brand/20 bg-[#faf8f4]/97 p-2 shadow-[var(--jk-sombra-menu)] backdrop-blur-xl">
                      <ul>
                        {i.filhos.map((f) => (
                          <li key={f.href}>
                            <Link
                              href={f.href}
                              aria-current={ativo(f.href) ? "page" : undefined}
                              className={`group flex items-start gap-3 rounded-sm p-3 transition-colors hover:bg-brand/10 ${
                                ativo(f.href) ? "bg-brand/10" : ""
                              }`}
                            >
                              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-brand/25 bg-brand/10 text-brand-nav transition-colors group-hover:border-brand/50">
                                <SimboloDaFerramenta chave={f.chave ?? ""} className="h-5 w-5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-ink">
                                  {f.rotulo}
                                </span>
                                {f.resumo ? (
                                  <span className="mt-0.5 block text-nota leading-snug text-muted">
                                    {f.resumo}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={i.href}
                        className="mt-1 flex items-center justify-between rounded-sm border-t border-border/70 px-3 py-2.5 text-nota font-semibold text-brand-nav transition-colors hover:bg-brand/10"
                      >
                        Ver todas as ferramentas
                        <span aria-hidden>&rarr;</span>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            ) : (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={ativo(i.href) ? "page" : undefined}
                  className={classeDoLink(ativo(i.href))}
                >
                  {i.rotulo}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      {/* Celular */}
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="gaveta-navegacao"
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:text-brand-nav md:hidden"
      >
        {aberto ? <X size={22} /> : <Menu size={22} />}
      </button>

      {aberto ? (
        <div className="fixed inset-0 top-16 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
          />
          <div
            ref={gaveta}
            id="gaveta-navegacao"
            className="etapa relative max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-brand/25 bg-background px-5 pb-8 pt-3 shadow-[var(--jk-sombra-painel)] backdrop-blur-xl"
          >
            <nav aria-label="Principal">
              <ul className="flex flex-col">
                {itens.map((i) => (
                  <li key={i.href} className="border-b border-border/60 last:border-0">
                    <Link
                      href={i.href}
                      aria-current={ativo(i.href) ? "page" : undefined}
                      className={`flex min-h-14 items-center justify-between text-titulo-bloco font-display transition-colors ${
                        ativoComFilhos(i) ? "text-brand-nav" : "text-ink"
                      }`}
                    >
                      {i.rotulo}
                      <span aria-hidden className="text-apoio text-brand-nav">
                        &rarr;
                      </span>
                    </Link>

                    {/* As ferramentas não ficam escondidas atrás do índice: no
                        celular elas são o motivo de a pessoa abrir o menu. */}
                    {i.filhos?.length ? (
                      <ul className="-mt-1 mb-3 grid gap-2">
                        {i.filhos.map((f) => (
                          <li key={f.href}>
                            <Link
                              href={f.href}
                              aria-current={ativo(f.href) ? "page" : undefined}
                              className={`flex min-h-13 items-center gap-3 rounded-sm border px-3 py-2.5 transition-colors ${
                                ativo(f.href)
                                  ? "border-brand/45 bg-brand/12"
                                  : "border-border/70 bg-white/45"
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-brand/25 bg-brand/10 text-brand-nav">
                                <SimboloDaFerramenta chave={f.chave ?? ""} className="h-5 w-5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-apoio font-semibold text-ink">
                                  {f.rotulo}
                                </span>
                                {f.resumo ? (
                                  <span className="mt-0.5 block text-nota leading-snug text-muted">
                                    {f.resumo}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
