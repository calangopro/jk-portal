"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Area } from "@/lib/auth/acessos";
import { Navegacao } from "./Navegacao";

/**
 * Menu do painel no celular: um botão na barra de topo que abre uma gaveta.
 *
 * Antes, abaixo de 1024 px a barra lateral inteira era desenhada ANTES do
 * conteúdo, em toda página: eram 1.700 px de menu para rolar até chegar no
 * primeiro número. Agora o menu só existe quando a pessoa pede.
 *
 * A gaveta vai por portal para o `body`. O cabeçalho do painel é de vidro
 * (`backdrop-filter`), e `position: fixed` dentro de vidro se ancora no
 * cabeçalho, não na janela: a gaveta sairia do tamanho da barra.
 *
 * Fecha sozinha ao trocar de página, no Esc e no toque fora. Enquanto está
 * aberta, a página de trás não rola.
 */
export function MenuDoCelular({
  pendentes, areas, nome, papel,
}: {
  pendentes: number;
  areas: Area[];
  nome: string;
  papel: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const caminho = usePathname();
  const botao = useRef<HTMLButtonElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => setMontado(true), []);
  useEffect(() => setAberto(false), [caminho]);

  useEffect(() => {
    if (!aberto) return;
    const noEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", noEsc);
    fechar.current?.focus();
    const quemAbriu = botao.current;
    return () => {
      document.body.style.overflow = rolagem;
      document.removeEventListener("keydown", noEsc);
      quemAbriu?.focus();
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto(true)}
        aria-expanded={aberto}
        aria-controls="menu-do-painel"
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/60 px-3.5 py-2 text-sm font-medium text-ink lg:hidden"
      >
        <Menu size={15} aria-hidden /> Menu
      </button>

      {aberto && montado
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <button type="button" aria-label="Fechar o menu" className="absolute inset-0 bg-ink/45" onClick={() => setAberto(false)} />
              <div
                id="menu-do-painel"
                role="dialog"
                aria-modal="true"
                aria-label="Menu do painel"
                className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto overscroll-contain shadow-2xl"
                style={{ background: "rgb(var(--jk-bg-rgb))" }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight text-ink">{nome}</p>
                    <p className="text-xs leading-tight text-muted">{papel}</p>
                  </div>
                  <button
                    ref={fechar}
                    type="button"
                    onClick={() => setAberto(false)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    <X size={13} aria-hidden /> Fechar
                  </button>
                </div>
                <div className="px-3 py-4">
                  <Navegacao pendentes={pendentes} areas={areas} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
