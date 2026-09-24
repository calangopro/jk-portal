"use client";

import { useFormStatus } from "react-dom";

/** Botão principal das telas de acesso, com o texto de espera enquanto envia. */
export function BotaoDeAcesso({
  texto,
  esperando,
  desligado = false,
}: {
  texto: string;
  esperando: string;
  desligado?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || desligado}
      className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? esperando : texto}
    </button>
  );
}
