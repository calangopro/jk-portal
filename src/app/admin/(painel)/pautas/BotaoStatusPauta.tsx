"use client";

import { useState, useTransition } from "react";
import { mudarStatusDaPauta } from "./actions";
import { STATUS_DA_PAUTA, STATUS_DA_PAUTA_LABEL, type StatusDaPauta } from "@/lib/content/pautas";

export function BotaoStatusPauta({ id, atual }: { id: string; atual: StatusDaPauta }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <label>
        <span className="sr-only">Status da pauta</span>
        <select
          value={atual}
          disabled={pendente}
          onChange={(e) => {
            const novo = e.target.value as StatusDaPauta;
            setErro(null);
            iniciar(async () => {
              const r = await mudarStatusDaPauta(id, novo);
              if (r.error) setErro(r.error);
            });
          }}
          className="rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
        >
          {STATUS_DA_PAUTA.map((s) => (
            <option key={s} value={s}>
              {STATUS_DA_PAUTA_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {erro ? (
        <span role="alert" className="text-xs text-wine">
          {erro}
        </span>
      ) : null}
    </span>
  );
}
