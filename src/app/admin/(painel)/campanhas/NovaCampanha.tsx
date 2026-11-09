"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { novaCampanha, type NovaCampanhaState } from "./actions";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
    >
      <Plus size={14} /> {pending ? "Criando…" : "Criar campanha"}
    </button>
  );
}

export function NovaCampanha() {
  const [estado, acao] = useActionState<NovaCampanhaState, FormData>(novaCampanha, {});
  const campo = "mt-1 h-10 w-full rounded-[10px] border border-border bg-white/80 px-3 text-sm text-ink outline-none focus:border-brand";
  return (
    <form action={acao} className="glass mt-8 grid gap-3 rounded-[20px] p-5 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] sm:items-end">
      <label className="text-xs font-semibold text-ink">
        Nome da campanha
        <input name="nome" required minLength={2} maxLength={80} placeholder="Black Friday 2026" className={campo} />
      </label>
      <label className="text-xs font-semibold text-ink">
        Começa em
        <input name="inicio" type="date" required className={campo} />
      </label>
      <label className="text-xs font-semibold text-ink">
        Termina em
        <input name="fim" type="date" required className={campo} />
      </label>
      <Botao />
      {estado.erro ? (
        <p role="alert" className="text-xs text-wine sm:col-span-4">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
