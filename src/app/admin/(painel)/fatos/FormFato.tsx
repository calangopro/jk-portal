"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarFato, type FatosState } from "./actions";
import {
  MODULOS_DO_FATO,
  MODULO_LABEL,
  STATUS_DO_FATO,
  STATUS_EXPLICACAO,
  STATUS_LABEL,
  type Fato,
} from "@/lib/content/fatos";

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
      {pending ? "Salvando…" : editando ? "Salvar alterações" : "Registrar fato"}
    </button>
  );
}

export function FormFato({ fato }: { fato?: Fato }) {
  const [state, formAction] = useActionState<FatosState, FormData>(salvarFato, {});
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-5">
      {fato ? <input type="hidden" name="id" value={fato.id} /> : null}

      <label className="block text-sm font-medium text-ink">
        A afirmação
        <textarea
          name="claim"
          required
          rows={2}
          defaultValue={fato?.claim}
          className={`${campo} resize-y`}
          placeholder="A JK Alianças produz as peças em fábrica própria."
        />
        <span className="mt-1.5 block text-xs text-muted">
          Escreva como se ela fosse ser lida sozinha, fora do texto. É assim que
          a IA cita, e é assim que ela vai aparecer para quem escreve o guia.
          Frase curta, com dado concreto, sem adjetivo de propaganda.
        </span>
      </label>

      <label className="block text-sm font-medium text-ink">
        Contexto para quem escreve
        <textarea
          name="detail"
          rows={3}
          defaultValue={fato?.detail ?? ""}
          className={`${campo} resize-y`}
          placeholder="O que a afirmação não diz, a ressalva, o recorte."
        />
        <span className="mt-1.5 block text-xs text-muted">
          O leitor não vê. Serve para evitar que o fato seja esticado além do que
          a fonte sustenta.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Módulo
          <select name="module" defaultValue={fato?.module ?? "empresa"} className={campo}>
            {MODULOS_DO_FATO.map((m) => (
              <option key={m} value={m}>
                {MODULO_LABEL[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-ink">
          Status
          <select name="status" defaultValue={fato?.status ?? "extraido"} className={campo}>
            {STATUS_DO_FATO.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">
            {STATUS_EXPLICACAO[fato?.status ?? "extraido"]} Só o que está
            aprovado aparece para citar no editor.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Assunto
          <input
            name="subject"
            defaultValue={fato?.subject ?? ""}
            className={campo}
            placeholder="prata-950"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Do que o fato fala, em minúsculas e com hífen. É o que liga o fato à
            linha certa do comparador. Deixe vazio se o fato não é sobre uma
            coisa específica.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Característica
          <input
            name="attribute"
            defaultValue={fato?.attribute ?? ""}
            className={campo}
            placeholder="teor"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Qual coluna do comparador: teor, durabilidade, manutencao, garantia.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Link da fonte
          <input
            name="source_url"
            type="url"
            defaultValue={fato?.sourceUrl ?? ""}
            className={campo}
            placeholder="https://www.jkaliancas.com.br/sobre-nos"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Arquivo da fonte
          <input
            name="file_url"
            type="url"
            defaultValue={fato?.fileUrl ?? ""}
            className={campo}
            placeholder="Endereço do documento ou da planilha"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Conferido em
          <input
            name="captured_at"
            type="date"
            defaultValue={fato?.capturedAt ?? hoje}
            className={campo}
          />
          <span className="mt-1.5 block text-xs text-muted">
            Data em que alguém olhou a fonte, não a data em que o fato aconteceu.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Responsável
          <input
            name="responsible"
            defaultValue={fato?.responsible ?? ""}
            className={campo}
            placeholder="Quem conferiu"
          />
        </label>
      </div>

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

      <Botao editando={Boolean(fato)} />
    </form>
  );
}
