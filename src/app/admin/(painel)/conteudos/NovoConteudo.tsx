"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { MODELOS } from "@/lib/editor/modelos";
import { criarConteudo } from "./actions";

/**
 * Criar conteúdo já escolhendo o modelo.
 *
 * Começar de página em branco é onde o texto perde a estrutura: a resposta
 * rápida some, os subtítulos viram tema em vez de pergunta e o fecho fica sem
 * ação. O modelo entrega o esqueleto certo e sobra só escrever.
 */
export function NovoConteudo() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative z-40">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light"
      >
        <Plus size={15} /> Novo conteúdo
        <ChevronDown size={14} className={aberto ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[16px] border border-border bg-[#fdfbf7] shadow-xl"
        >
          <p className="border-b border-border px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Começar de um modelo
          </p>
          {MODELOS.map((m) => (
            <form key={m.id} action={criarConteudo} role="none">
              <input type="hidden" name="modelo" value={m.id} />
              <button
                type="submit"
                role="menuitem"
                className="block w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-brand/10"
              >
                <span className="block text-sm font-semibold text-ink">{m.nome}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{m.descricao}</span>
                <span className="mt-1 block text-[0.68rem] leading-snug text-brand-strong">{m.quando}</span>
              </button>
            </form>
          ))}
          <form action={criarConteudo} role="none">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-brand/10 hover:text-ink"
            >
              Página em branco
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
