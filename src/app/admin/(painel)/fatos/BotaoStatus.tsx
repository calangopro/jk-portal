"use client";

import { useState, useTransition } from "react";
import { mudarStatusFato } from "./actions";
import { STATUS_DO_FATO, STATUS_LABEL, type StatusDoFato } from "@/lib/content/fatos";

/**
 * Troca de status em um clique, sem abrir o formulário.
 *
 * Aprovar é a ação mais repetida da tela quando a JK devolve uma lista
 * validada, e obrigar a abrir o fato inteiro para mudar uma palavra faria
 * ninguém manter a base em dia.
 */
export function BotaoStatus({
  id,
  atual,
  usos,
}: {
  id: string;
  atual: StatusDoFato;
  usos: number;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const trocar = (novo: StatusDoFato) => {
    if (novo === atual) return;
    if (
      novo === "desatualizado" &&
      usos > 0 &&
      !window.confirm(
        `Este fato é citado por ${usos === 1 ? "1 conteúdo" : `${usos} conteúdos`}. ` +
          "Marcar como desatualizado não altera o texto já publicado, só avisa que ele precisa de revisão. Continuar?",
      )
    ) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await mudarStatusFato(id, novo);
      if (r.error) setErro(r.error);
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 text-xs text-muted">
        <span className="sr-only">Status do fato</span>
        <select
          value={atual}
          disabled={pendente}
          onChange={(e) => trocar(e.target.value as StatusDoFato)}
          className="rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
        >
          {STATUS_DO_FATO.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {erro ? (
        <span role="alert" className="max-w-xs text-xs text-wine">
          {erro}
        </span>
      ) : null}
    </span>
  );
}
