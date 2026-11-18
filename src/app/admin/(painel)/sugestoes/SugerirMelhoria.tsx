"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb } from "lucide-react";
import { EVENTO_DE_SUGERIR, abrirSugestao } from "./abrir";

// A janela só baixa no primeiro clique: a moldura fica leve em toda tela.
const Janela = dynamic(() => import("./Janela"), { ssr: false });

/**
 * A janela de sugerir melhoria, desenhada UMA vez pela moldura. Os botões só
 * avisam (`abrirSugestao`). Ao fechar, o foco volta para quem abriu.
 */
export function SugerirMelhoria({ caminho, telaNome }: { caminho: string; telaNome: string }) {
  const [aberta, setAberta] = useState(false);
  const deOndeVeio = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = () => {
      deOndeVeio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAberta(true);
    };
    window.addEventListener(EVENTO_DE_SUGERIR, abrir);
    return () => window.removeEventListener(EVENTO_DE_SUGERIR, abrir);
  }, []);

  const fechar = useCallback(() => {
    setAberta(false);
    const voltar = deOndeVeio.current;
    if (voltar && voltar.getClientRects().length > 0) requestAnimationFrame(() => voltar.focus());
  }, []);

  return aberta ? <Janela caminho={caminho} telaNome={telaNome} aoFechar={fechar} /> : null;
}

/** O botão da barra de topo: com a palavra no computador, só o ícone no celular. */
export function BotaoDeSugerir({ compacto = false }: { compacto?: boolean }) {
  // Passar o mouse adianta a busca da janela, para o clique abrir na hora.
  const adiantar = () => void import("./Janela");
  if (compacto) {
    return (
      <button
        type="button"
        onClick={abrirSugestao}
        onPointerEnter={adiantar}
        aria-label="Sugerir melhoria"
        title="Sugerir melhoria"
        className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/80 text-ink"
      >
        <Lightbulb size={17} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={abrirSugestao}
      onPointerEnter={adiantar}
      onFocus={adiantar}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/12 bg-white/80 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand/60 hover:bg-white"
    >
      <Lightbulb size={14} aria-hidden="true" /> Sugerir melhoria
    </button>
  );
}
