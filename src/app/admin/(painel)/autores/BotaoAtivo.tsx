"use client";

import { useTransition } from "react";
import { alternarAtivo } from "./actions";

/**
 * Desativar em vez de apagar: conteúdo já publicado aponta para /autor/[slug]
 * pelo `author.url` do schema, e apagar a pessoa deixaria esse link quebrado.
 */
export function BotaoAtivo({
  id,
  ativo,
  nome,
}: {
  id: string;
  ativo: boolean;
  nome: string;
}) {
  const [pendente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (
          ativo &&
          !window.confirm(
            `Desativar ${nome}? A página /autor/ sai do ar e a assinatura volta a ser texto sem link. Nada é apagado.`,
          )
        ) {
          return;
        }
        iniciar(() => {
          void alternarAtivo(id, !ativo);
        });
      }}
      className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
    >
      {pendente ? "Salvando…" : ativo ? "Desativar" : "Reativar"}
    </button>
  );
}
