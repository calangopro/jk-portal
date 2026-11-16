"use client";

import { useEffect, useId, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { SETORES } from "@/lib/painel/setores";
import { corDoSetor } from "../Navegacao";
import { fecharHistoricoDoPedido } from "./abrir";

/**
 * A casca da gaveta do histórico: o fundo, a gaveta à direita (a tela inteira
 * no celular), o título e o fechar. É desenhada na moldura, fora da página
 * animada, e fica por cima de tudo, inclusive da janela flutuante do chat.
 * Esc fecha, o foco vai para o título ao abrir e volta para quem abriu.
 */

const COR = corDoSetor(SETORES.find((s) => s.id === "vendas") ?? null);

export function CascaDoHistorico({ titulo, apoio, children }: { titulo: string; apoio?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  const cabeca = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    cabeca.current?.focus({ preventScroll: true });
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = antes;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70]" style={COR}>
      <div className="painel-fundo absolute inset-0 hidden bg-ink/30 lg:block" onClick={fecharHistoricoDoPedido} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || e.defaultPrevented) return;
          e.preventDefault();
          fecharHistoricoDoPedido();
        }}
        className="painel-entrada absolute inset-y-0 right-0 flex w-full flex-col bg-[rgb(var(--jk-bg-rgb))] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[0_0_60px_rgba(23,21,18,0.22)] lg:max-w-[36rem] lg:pt-0"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-ink/[0.08] bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={id} ref={cabeca} tabIndex={-1} className="truncate text-lg font-bold leading-tight text-ink outline-none">
              {titulo}
            </h2>
            {apoio ? <div className="mt-0.5 text-xs text-muted">{apoio}</div> : null}
          </div>
          <button
            type="button"
            onClick={fecharHistoricoDoPedido}
            className="painel-toque inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink"
          >
            <X size={15} aria-hidden="true" /> Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">{children}</div>
      </section>
    </div>
  );
}

export function AbrindoOHistorico({ numero }: { numero: number }) {
  return (
    <CascaDoHistorico titulo={`Pedido ${numero}`}>
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Juntando o histórico do pedido
      </p>
    </CascaDoHistorico>
  );
}
