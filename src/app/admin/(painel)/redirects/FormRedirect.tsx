"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarRedirect, type LinhaDeRedirect, type RedirectsState } from "./actions";

const campo =
  "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

function Botao({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : editando ? "Salvar alterações" : "Criar redirect"}
    </button>
  );
}

export function FormRedirect({ redirect }: { redirect?: LinhaDeRedirect }) {
  const [state, formAction] = useActionState<RedirectsState, FormData>(salvarRedirect, {});
  const [status, setStatus] = useState(redirect?.status ?? "301");

  return (
    <form action={formAction} className="space-y-5">
      {redirect ? <input type="hidden" name="id" value={redirect.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Endereço antigo
          <input
            name="source_path"
            required
            defaultValue={redirect?.origem}
            className={campo}
            placeholder="/alianca-antiga"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Começa com barra. É o endereço que as pessoas ainda pedem e não
            existe mais.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Tipo
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LinhaDeRedirect["status"])}
            className={campo}
          >
            <option value="301">Mudou de lugar, para sempre (301)</option>
            <option value="302">Mudou por enquanto (302)</option>
            <option value="410">Saiu de vez, não existe substituto (410)</option>
          </select>
          <span className="mt-1.5 block text-xs text-muted">
            {status === "301"
              ? "O Google passa a força do endereço antigo para o novo. É o caso comum."
              : status === "302"
                ? "O Google mantém o endereço antigo no índice. Use só quando a mudança for temporária de verdade."
                : "Tira a página do índice mais rápido que um 404, e mostra uma página da marca com saídas."}
          </span>
        </label>
      </div>

      {status === "410" ? null : (
        <label className="block text-sm font-medium text-ink">
          Levar para
          <input
            name="destination_url"
            defaultValue={redirect?.destino}
            className={campo}
            placeholder="/alianca-de-namoro-como-escolher"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Endereço interno começando com barra, ou endereço completo com
            https:// para mandar para fora. Mande para a página que responde a
            mesma dúvida, não para a home: redirect para a home é tratado como
            página de erro pelo Google.
          </span>
        </label>
      )}

      <label className="block text-sm font-medium text-ink">
        Motivo
        <input
          name="reason"
          defaultValue={redirect?.motivo ?? ""}
          className={campo}
          placeholder="O guia de prata virou dois artigos separados."
        />
        <span className="mt-1.5 block text-xs text-muted">
          Redirect sem explicação vira mistério em seis meses, quando ninguém
          lembra por que aquele endereço aponta para outro.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-[12px] bg-brand/15 px-4 py-3 text-sm text-ink">
          {state.success}
        </p>
      ) : null}

      <Botao editando={Boolean(redirect)} />
    </form>
  );
}
