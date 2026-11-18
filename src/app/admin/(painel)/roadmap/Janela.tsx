"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A janela do Roadmap: um `<dialog>` nativo aberto com `showModal()`, como a
 * de sugerir melhoria. Fica na camada de cima do navegador (nenhuma pilha da
 * moldura passa por cima) e prende o foco. `lateral` é a gaveta do cartão:
 * a tela inteira no celular e uma coluna à direita no computador.
 */
export function Janela({
  titulo, aoFechar, lateral = false, segurarEsc = false, children,
}: {
  titulo: string;
  aoFechar: () => void;
  lateral?: boolean;
  /** Com algo escrito, o Esc não fecha: perder um texto por uma tecla é pior que clicar em Fechar. */
  segurarEsc?: boolean;
  children: React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-label={titulo}
      onClose={aoFechar}
      onCancel={(e) => {
        if (segurarEsc) e.preventDefault();
      }}
      className={
        lateral
          ? "m-0 ml-auto h-[100dvh] max-h-[100dvh] w-full max-w-xl border-0 bg-[#fbf8f3] p-0 text-ink shadow-2xl backdrop:bg-[rgb(23_21_18/0.45)] sm:rounded-l-[20px]"
          : "m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-[20px] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-[rgb(23_21_18/0.45)]"
      }
    >
      <div className={lateral ? "flex h-full flex-col" : "max-h-[calc(100dvh-2rem)] overflow-y-auto"}>
        <div className={`flex items-center gap-3 ${lateral ? "border-b border-ink/[0.08] px-4 py-3 sm:px-5" : "px-5 pt-5 sm:px-6 sm:pt-6"}`}>
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="painel-toque inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={16} aria-hidden="true" /> Fechar
          </button>
        </div>
        <div className={lateral ? "min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-5" : "px-5 pb-5 pt-3 sm:px-6 sm:pb-6"}>{children}</div>
      </div>
    </dialog>
  );
}
