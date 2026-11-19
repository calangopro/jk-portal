"use client";

import { Children, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cortar, ITENS_POR_VEZ } from "@/lib/clientes/linha-do-tempo";

/**
 * A linha do tempo longa mostra os 30 itens mais novos e um "ver mais" que
 * abre outros 30 de cada vez. Os itens chegam já desenhados pelo servidor.
 */
export function VerMais({ children }: { children: React.ReactNode }) {
  const [quantos, setQuantos] = useState(ITENS_POR_VEZ);
  const itens = Children.toArray(children);
  const { visiveis, resto } = cortar(itens, quantos);
  return (
    <>
      <ol className="mt-4 space-y-5">{visiveis}</ol>
      {resto > 0 ? (
        <button
          type="button"
          onClick={() => setQuantos((q) => q + ITENS_POR_VEZ)}
          className="painel-toque mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink hover:bg-ink/[0.04] sm:w-auto"
        >
          <ChevronDown size={15} aria-hidden="true" /> Ver mais {Math.min(resto, ITENS_POR_VEZ)}
          <span className="font-normal text-muted">(faltam {resto})</span>
        </button>
      ) : null}
    </>
  );
}
