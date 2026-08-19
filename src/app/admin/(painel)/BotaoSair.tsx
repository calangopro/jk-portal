"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Botão de sair com estado de espera.
 *
 * Sair derruba a sessão no Supabase e redireciona, ou seja, tem ida ao
 * servidor. Era o único botão do painel sem aviso de "estou indo": os
 * formulários das telas já usam `useFormStatus`, este ficou de fora porque
 * mora no layout, que é componente de servidor.
 */
export function BotaoSair() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-full border border-ink/15 bg-white/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand-nav disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
      {pending ? "Saindo" : "Sair"}
    </button>
  );
}
