"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { criarPauta, type PautasState } from "./actions";
import { MODELOS } from "@/lib/editor/modelos";

const campo =
  "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Criando…" : "Criar pauta"}
    </button>
  );
}

/**
 * Pauta escrita à mão.
 *
 * Nem toda pauta nasce do Search Console: a JK pede um assunto, a fábrica muda
 * um processo, o atendimento vê a mesma dúvida dez vezes na semana. O que não
 * pode é a pauta existir só na cabeça de alguém.
 */
export function FormPauta({ clusters }: { clusters: string[] }) {
  const [state, formAction] = useActionState<PautasState, FormData>(criarPauta, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Consulta que a página quer ganhar
          <input
            name="target_query"
            required
            className={campo}
            placeholder="prata 925 ou 950"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Escreva do jeito que a pessoa digita no Google. É por esta consulta
            que o resultado vai ser medido depois.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Título provisório
          <input name="title" className={campo} placeholder="Prata 925 ou 950, qual escolher" />
          <span className="mt-1.5 block text-xs text-muted">
            Dá para mudar no editor. Serve para reconhecer a pauta na fila.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-ink">
          Intenção
          <select name="search_intent" defaultValue="informacional" className={campo}>
            <option value="informacional">Informacional</option>
            <option value="comercial">Comercial</option>
            <option value="transacional">Transacional</option>
            <option value="navegacional">Navegacional</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-ink">
          Cluster
          <input name="cluster" list="clusters-existentes" className={campo} placeholder="alianças de namoro" />
          <datalist id="clusters-existentes">
            {clusters.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm font-medium text-ink">
          Modelo
          <select name="modelo" defaultValue="artigo" className={campo}>
            {MODELOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        Dúvida principal e objetivo da página
        <textarea
          name="notes"
          rows={3}
          className={`${campo} resize-y`}
          placeholder="Qual pergunta esta página resolve, e o que a pessoa faz depois de ler."
        />
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

      <Botao />
    </form>
  );
}
