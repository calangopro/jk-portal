"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  const field =
    "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

  return (
    <form action={formAction} className="mt-8 text-left">
      <input type="hidden" name="next" value={next} />

      <label className="block text-sm font-medium text-ink" htmlFor="email">
        E-mail
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={field}
          placeholder="voce@jkaliancas.com.br"
        />
      </label>

      <label
        className="mt-5 block text-sm font-medium text-ink"
        htmlFor="password"
      >
        Senha
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
          placeholder="••••••••"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="mt-5 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-sm text-wine"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
