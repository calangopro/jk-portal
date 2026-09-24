"use client";

import { useId } from "react";

/**
 * Campos do editor da bio.
 *
 * Todo campo de texto avisa travessão na hora, porque o servidor recusa o
 * salvamento com travessão (REGRAS.md §1) e descobrir isso só no fim, ao
 * salvar, é o tipo de surpresa que faz a pessoa desistir do painel.
 */

export const classeDoCampo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const TRAVESSAO = /[—–]/;

function Rotulo({ id, rotulo, ajuda }: { id: string; rotulo: string; ajuda?: string }) {
  return (
    <>
      <label htmlFor={id} className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {rotulo}
      </label>
      {ajuda ? <p className="mt-0.5 text-[0.68rem] leading-snug text-muted">{ajuda}</p> : null}
    </>
  );
}

function Avisos({ valor, maximo }: { valor: string; maximo?: number }) {
  const excedeu = maximo !== undefined && valor.length > maximo;
  const temTravessao = TRAVESSAO.test(valor);
  if (maximo === undefined && !temTravessao) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 text-[0.66rem]">
      {maximo !== undefined ? (
        <span className={excedeu ? "font-semibold text-wine" : "text-muted"}>
          {valor.length}/{maximo}
          {excedeu ? " (fica comprido no celular)" : ""}
        </span>
      ) : null}
      {temTravessao ? (
        <span className="font-semibold text-wine">Travessão não entra. Use vírgula, dois pontos ou parênteses.</span>
      ) : null}
    </div>
  );
}

export function Texto({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  maximo,
  placeholder,
  longo = false,
}: {
  rotulo: string;
  ajuda?: string;
  valor: string;
  aoMudar: (v: string) => void;
  maximo?: number;
  placeholder?: string;
  longo?: boolean;
}) {
  const id = useId();
  const ruim = TRAVESSAO.test(valor) || (maximo !== undefined && valor.length > maximo);
  const classe = `${classeDoCampo} ${ruim ? "border-wine focus:border-wine" : ""}`;
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} ajuda={ajuda} />
      <div className="mt-1.5">
        {longo ? (
          <textarea
            id={id}
            value={valor}
            rows={3}
            placeholder={placeholder}
            onChange={(e) => aoMudar(e.target.value)}
            className={`${classe} resize-y leading-relaxed`}
          />
        ) : (
          <input
            id={id}
            value={valor}
            placeholder={placeholder}
            onChange={(e) => aoMudar(e.target.value)}
            className={classe}
          />
        )}
      </div>
      <Avisos valor={valor} maximo={maximo} />
    </div>
  );
}

/** Endereço de link, com o aviso de formato antes de salvar. */
export function Endereco({
  rotulo,
  ajuda,
  valor,
  aoMudar,
}: {
  rotulo: string;
  ajuda?: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const id = useId();
  const v = valor.trim();
  const valido = !v || v.startsWith("/") || /^https?:\/\/[^\s]+\.[^\s]+/.test(v);
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} ajuda={ajuda} />
      <input
        id={id}
        value={valor}
        inputMode="url"
        placeholder="https://www.jkaliancas.com.br/..."
        onChange={(e) => aoMudar(e.target.value)}
        className={`${classeDoCampo} mt-1.5 ${valido ? "" : "border-wine focus:border-wine"}`}
      />
      {!valido ? (
        <p className="mt-1 text-[0.66rem] font-semibold text-wine">
          Use o endereço completo (https://...) ou um caminho do site começando com /.
        </p>
      ) : null}
    </div>
  );
}

export function Data({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  limpavel = true,
}: {
  rotulo: string;
  ajuda?: string;
  valor: string | null;
  aoMudar: (v: string | null) => void;
  /** Data de campanha é obrigatória: sem o "Limpar", que só apertaria o campo. */
  limpavel?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} ajuda={ajuda} />
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="date"
          value={valor ?? ""}
          onChange={(e) => aoMudar(e.target.value || null)}
          className={classeDoCampo}
        />
        {valor && limpavel ? (
          <button
            type="button"
            onClick={() => aoMudar(null)}
            className="shrink-0 text-[0.68rem] font-semibold text-muted hover:text-wine"
          >
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Selecao<T extends string>({
  rotulo,
  ajuda,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  ajuda?: string;
  valor: T;
  opcoes: readonly (readonly [T, string])[];
  aoMudar: (v: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} ajuda={ajuda} />
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value as T)}
        className={`${classeDoCampo} mt-1.5`}
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Caixa({
  rotulo,
  ajuda,
  marcado,
  aoMudar,
}: {
  rotulo: string;
  ajuda?: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-strong)]"
      />
      <span>
        {rotulo}
        {ajuda ? <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted">{ajuda}</span> : null}
      </span>
    </label>
  );
}

/** Subtítulo dentro do cartão do bloco, para agrupar campos que andam juntos. */
export function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-border/70 pt-4 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full text-xs font-semibold text-ink">{titulo}</legend>
      <div className="clear-both grid gap-3 sm:grid-cols-2 [&>*:has(textarea)]:sm:col-span-2">{children}</div>
    </fieldset>
  );
}
