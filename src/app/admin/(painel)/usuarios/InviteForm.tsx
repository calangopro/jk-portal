"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteUser, type UsersState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Enviar convite"}
    </button>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState<UsersState, FormData>(
    inviteUser,
    {},
  );

  const field =
    "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

  return (
    <form action={formAction}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-ink">
          E-mail
          <input
            name="email"
            type="email"
            required
            className={field}
            placeholder="editor@jkaliancas.com.br"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Nome
          <input
            name="full_name"
            type="text"
            className={field}
            placeholder="Nome da pessoa"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Papel
          <select name="role" defaultValue="editor" className={field}>
            <option value="admin">Administrador</option>
            <option value="editor">Editor</option>
            <option value="reviewer">Revisor</option>
            <option value="author">Autor</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mt-5 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-sm text-wine"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="mt-5 rounded-[12px] border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-brand-strong"
        >
          {state.success}
        </p>
      ) : null}

      <div className="mt-5">
        <SubmitButton />
      </div>
    </form>
  );
}
