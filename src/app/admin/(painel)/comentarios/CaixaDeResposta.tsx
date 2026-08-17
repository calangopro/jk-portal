"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CornerDownRight } from "lucide-react";
import { responder, type ResponderState } from "./actions";

/**
 * A caixa de responder, dentro do cartão do comentário.
 *
 * Fica fechada até alguém clicar: a fila de moderação é uma lista de leitura
 * rápida, e seis campos de texto abertos ao mesmo tempo transformam ela num
 * formulário. Abre no lugar, com o comentário à vista, porque responder sem
 * reler a pergunta é como se escreve resposta errada.
 *
 * `useActionState` em vez de `action` seco para a mensagem de erro nascer ao
 * lado do campo. A ação recusa quem não é admin, e o banco recusa de novo.
 */
export function CaixaDeResposta({
  comentarioId,
  slug,
}: {
  comentarioId: string;
  slug: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [estado, acao] = useActionState<ResponderState, FormData>(responder, {});
  const campo = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  useEffect(() => {
    if (!estado.ok) return;
    form.current?.reset();
    setAberta(false);
  }, [estado.ok]);

  if (!aberta) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setAberta(true)}
          className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
        >
          <CornerDownRight size={12} /> Responder
        </button>
        {estado.ok ? (
          <p role="status" className="mt-2 text-xs text-brand-strong">
            {estado.ok}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form ref={form} action={acao} className="mt-4 border-l-2 border-brand/30 pl-4">
      <input type="hidden" name="parent_id" value={comentarioId} />
      <input type="hidden" name="slug" value={slug} />

      <label className="block">
        <span className="text-xs font-semibold text-ink">
          Resposta da loja, publicada assinada como JK Alianças
        </span>
        <textarea
          ref={campo}
          name="corpo"
          rows={3}
          required
          maxLength={2000}
          placeholder="Responda como quem atende no balcão: direto, sem promessa que a loja não cumpre."
          className="mt-1.5 w-full resize-y rounded-[12px] border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
        />
      </label>

      {estado.erro ? (
        <p role="alert" className="mt-2 text-xs text-wine">
          {estado.erro}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Publicar />
        <button
          type="button"
          onClick={() => setAberta(false)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
        >
          Cancelar
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        A resposta vai ao ar na hora, e leva o comentário junto se ele ainda
        estiver na fila.
      </p>
    </form>
  );
}

function Publicar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Publicando…" : "Publicar resposta"}
    </button>
  );
}
