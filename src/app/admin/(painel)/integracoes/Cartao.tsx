"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";
import { salvarIntegracao, type IntegracaoState } from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function Botoes({ conectado }: { conectado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="submit"
        name="conectar"
        value="1"
        disabled={pending}
        className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      >
        {pending ? "Salvando…" : conectado ? "Salvar" : "Conectar"}
      </button>
      {conectado ? (
        <button
          type="submit"
          name="conectar"
          value="0"
          disabled={pending}
          className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine disabled:opacity-60"
        >
          Desconectar
        </button>
      ) : null}
    </div>
  );
}

export function Cartao({
  provider,
  nome,
  descricao,
  status,
  config,
  campos,
  aviso,
}: {
  provider: string;
  nome: string;
  descricao: string;
  status: string;
  config: Record<string, string>;
  campos: { nome: string; rotulo: string; exemplo?: string; ajuda?: string }[];
  aviso?: string;
}) {
  const [estado, acao] = useActionState<IntegracaoState, FormData>(salvarIntegracao, {});
  const conectado = status === "connected";

  return (
    <form action={acao} className="glass rounded-[18px] p-5">
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="display_name" value={nome} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{nome}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{descricao}</p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            conectado ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
          }`}
        >
          {conectado ? <Check size={11} /> : <Circle size={9} />}
          {conectado ? "Conectado" : "Desconectado"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {campos.map((c) => (
          <label key={c.nome} className="block">
            <span className="text-xs font-semibold text-ink">{c.rotulo}</span>
            <input
              name={c.nome}
              defaultValue={config?.[c.nome] ?? ""}
              placeholder={c.exemplo}
              className={`${campo} mt-1`}
            />
            {c.ajuda ? <span className="mt-1 block text-[0.68rem] text-muted">{c.ajuda}</span> : null}
          </label>
        ))}
      </div>

      {aviso ? (
        <p className="mt-3 rounded-[10px] border border-border bg-white/50 px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
          {aviso}
        </p>
      ) : null}

      {estado.erro ? <p className="mt-3 text-xs text-wine">{estado.erro}</p> : null}
      {estado.ok ? <p className="mt-3 text-xs text-brand-strong">{estado.ok}</p> : null}

      <Botoes conectado={conectado} />
    </form>
  );
}
