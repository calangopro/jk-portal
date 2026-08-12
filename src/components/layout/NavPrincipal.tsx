"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export type ItemNav = { href: string; rotulo: string };

/**
 * Navegação principal.
 *
 * No desktop é uma lista simples com indicação da rota ativa. No celular vira
 * gaveta: antes os links ficavam sempre visíveis, o que só funcionava porque
 * são três e curtos. Qualquer item novo quebrava a linha em 360px.
 */
export function NavPrincipal({ itens }: { itens: ItemNav[] }) {
  const rota = usePathname();
  const [aberto, setAberto] = useState(false);
  const gaveta = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const ativo = (href: string) => rota === href || rota.startsWith(`${href}/`);

  // Fecha ao trocar de página.
  useEffect(() => setAberto(false), [rota]);

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

  return (
    <>
      {/* Desktop */}
      <nav aria-label="Principal" className="hidden md:block">
        <ul className="flex items-center gap-8 text-apoio font-medium">
          {itens.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo(i.href) ? "page" : undefined}
                className={`relative py-2 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-300 hover:text-brand-nav hover:after:scale-x-100 ${
                  ativo(i.href) ? "text-brand-nav after:scale-x-100" : "text-ink/80"
                }`}
              >
                {i.rotulo}
              </Link>
            </li>
          ))}
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
            className="etapa relative border-b border-brand/25 bg-background px-5 pb-7 pt-3 shadow-[0_24px_50px_-24px_rgb(75_53_23/0.45)] backdrop-blur-xl"
          >
            <nav aria-label="Principal">
              <ul className="flex flex-col">
                {itens.map((i) => (
                  <li key={i.href} className="border-b border-border/60 last:border-0">
                    <Link
                      href={i.href}
                      aria-current={ativo(i.href) ? "page" : undefined}
                      className={`flex min-h-14 items-center justify-between text-titulo-bloco font-display transition-colors ${
                        ativo(i.href) ? "text-brand-nav" : "text-ink"
                      }`}
                    >
                      {i.rotulo}
                      <span aria-hidden className="text-apoio text-brand-nav">
                        &rarr;
                      </span>
                    </Link>
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
