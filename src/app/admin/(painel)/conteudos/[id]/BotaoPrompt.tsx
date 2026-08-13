"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Sparkles, X } from "lucide-react";
import { montarPrompt } from "@/lib/editor/prompt";

/**
 * Copia um prompt pronto para pedir o conteúdo a uma IA de fora.
 *
 * O prompt já sai com as regras do projeto, os limites de caractere que o
 * analisador cobra e a lista do que já está publicado, para a IA não propor
 * conteúdo que canibaliza o que está no ar. A pessoa só escreve o tema.
 */
export function BotaoPrompt({
  publicados,
  consultaAlvo,
}: {
  publicados: string[];
  consultaAlvo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const prompt = montarPrompt({ publicados, consultaAlvo: consultaAlvo.trim() || undefined });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Área de transferência bloqueada (contexto sem HTTPS, permissão negada).
      // Abrir o texto deixa a pessoa copiar na mão em vez de ficar sem saída.
      setAberto(true);
    }
  }

  return (
    <>
      <div className="glass rounded-[18px] p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Sparkles size={14} className="text-brand-nav" />
          Escrever com IA de fora
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Copie o prompt, cole no ChatGPT, Gemini ou Claude e escreva só o tema. A
          resposta volta dividida campo a campo, já com as regras da marca e sem
          repetir assunto do que já está publicado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            {copiado ? <Check size={12} /> : <ClipboardCopy size={12} />}
            {copiado ? "Copiado" : "Copiar prompt"}
          </button>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
          >
            Ver o prompt
          </button>
        </div>
      </div>

      {aberto ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setAberto(false)}
        >
          <div className="mt-10 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-[18px] border border-border bg-[#fbf8f2] p-5 shadow-[var(--jk-sombra-modal)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">Prompt para a IA</p>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-muted hover:bg-ink/8 hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-3 min-h-0 flex-1 resize-none rounded-[12px] border border-border bg-white/80 p-3 font-mono text-[0.7rem] leading-relaxed text-ink outline-none"
            />
            <button
              type="button"
              onClick={copiar}
              className="mt-3 self-start rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink hover:bg-brand-light"
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
