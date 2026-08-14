"use client";

import { useEffect } from "react";
import { ShieldCheck, X, ExternalLink } from "lucide-react";
import type { Fonte } from "./actions";

/**
 * Escolhe qual fonte vai aparecer no texto.
 *
 * Lista só o que já está registrado NESTE conteúdo, e não a base inteira: o
 * bloco existe para mostrar ao leitor a evidência que sustenta aquele trecho,
 * então oferecer uma fonte que o conteúdo não usa seria convidar ao erro.
 *
 * Quando não há nenhuma, o caminho é claro: registrar primeiro, pelo painel de
 * fatos ou à mão, e voltar.
 */
export function SeletorDeFonte({
  fontes,
  aoEscolher,
  aoFechar,
}: {
  fontes: Fonte[];
  aoEscolher: (f: Fonte) => void;
  aoFechar: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const dominio = (url: string | null) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escolher a fonte que vai aparecer no texto"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-24 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="glass w-full max-w-xl rounded-[20px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-ink">Mostrar a fonte no texto</h2>
            <p className="mt-1 text-sm text-muted">
              O leitor vê de onde veio a informação, e a IA consegue atribuir.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {fontes.length === 0 ? (
          <p className="mt-6 rounded-[12px] border border-dashed border-border px-4 py-4 text-sm leading-relaxed text-muted">
            Este conteúdo ainda não tem fonte registrada. Cite um fato pelo painel
            de fontes, ou registre a evidência à mão, e volte aqui.
          </p>
        ) : (
          <ul className="mt-6 max-h-80 space-y-2 overflow-y-auto pr-1">
            {fontes.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(f)}
                  className="flex w-full items-start gap-2.5 rounded-[12px] border border-border bg-white/60 px-4 py-3 text-left transition-colors hover:border-brand/50 hover:bg-white"
                >
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-ink">{f.evidence}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.7rem] text-muted">
                      {dominio(f.source_url) ? (
                        <span className="inline-flex items-center gap-1 text-brand-strong">
                          <ExternalLink size={10} /> {dominio(f.source_url)}
                        </span>
                      ) : (
                        <span>registro interno</span>
                      )}
                      {f.captured_at ? (
                        <span>conferida em {f.captured_at.split("-").reverse().join("/")}</span>
                      ) : null}
                      {f.fact_id ? <span className="text-brand-strong">da base de fatos</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          O texto do bloco é seu para escrever. O vínculo com a fonte fica
          guardado à parte, então reescrever a frase não desfaz a atribuição.
        </p>
      </div>
    </div>
  );
}
