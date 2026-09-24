"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { AvisoDeErro, CAMPO_DE_ACESSO } from "../_acesso/Moldura";
import { BotaoDeAcesso } from "../_acesso/BotaoDeAcesso";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

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
          className={CAMPO_DE_ACESSO}
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
          className={CAMPO_DE_ACESSO}
          placeholder="••••••••"
        />
      </label>

      {state.error ? <AvisoDeErro>{state.error}</AvisoDeErro> : null}

      <BotaoDeAcesso texto="Entrar" esperando="Entrando…" />
    </form>
  );
}
