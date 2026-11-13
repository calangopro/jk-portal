"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/** Botão de formulário da fila, com giro enquanto a ação vai ao servidor. */
export function BotaoDeAcao({ children, forte = false }: { children: React.ReactNode; forte?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        (forte
          ? "bg-ink text-white hover:bg-ink/85 "
          : "border border-ink/15 bg-white/60 text-ink hover:border-brand/60 hover:text-brand-nav ") +
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
      }
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
