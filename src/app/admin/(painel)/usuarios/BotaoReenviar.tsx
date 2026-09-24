"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reenviarConvite, type UsersState } from "./actions";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Reenviar convite"}
    </button>
  );
}

/** Reenvia o convite de quem ainda não criou a senha. */
export function BotaoReenviar({ userId }: { userId: string }) {
  const [state, formAction] = useActionState<UsersState, FormData>(
    reenviarConvite,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <Botao />
      {state.success ? (
        <span role="status" className="text-xs text-brand-strong">
          {state.success}
        </span>
      ) : null}
      {state.error ? (
        <span role="alert" className="text-xs text-wine">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
