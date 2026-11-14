"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

/**
 * As peças pequenas que a Biblioteca e os Chamados dividem: os dois botões, o
 * campo de texto, a ficha de filtro, o botão de copiar e os relógios da tela.
 */

export const botaoClaro =
  "painel-toque inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60";
export const botaoCheio =
  "painel-toque painel-aba-ativa inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold disabled:opacity-60";

/** Campo de texto. `text-base` (16 px) de propósito: abaixo disso o iPhone amplia a tela ao focar. */
export const campo =
  "mt-1 block w-full rounded-[12px] border border-ink/15 bg-white px-3 py-2.5 text-base leading-snug text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]";

export type Feito = { ok: true } | { ok: false; erro: string };

/** Botão que copia um texto e diz que copiou. */
export function Copiar({ texto, children, cheio }: { texto: string; children: React.ReactNode; cheio?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className={cheio ? botaoCheio : botaoClaro}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          // Navegador sem permissão de copiar: a pessoa ainda pode selecionar o texto na tela.
        }
      }}
    >
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copiado ? "Copiado" : children}</span>
    </button>
  );
}

/** Ficha de filtro: uma pílula que liga e desliga, com a contagem ao lado quando há. */
export function Ficha({
  ativa, onClick, children, contagem,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
  contagem?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={onClick}
      className={`painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.82rem] font-semibold ${
        ativa ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink/75"
      }`}
    >
      {children}
      {contagem !== undefined ? <span className={`numeros text-[0.7rem] ${ativa ? "opacity-80" : "text-muted"}`}>{contagem}</span> : null}
    </button>
  );
}

/**
 * Fila de fichas. No celular rola de lado e sangra até a borda da tela (uma
 * linha só, para a lista começar mais cedo); no computador quebra de linha.
 */
export function FilaDeFichas({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="painel-fila -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {children}
    </div>
  );
}

const FUSO = "America/Sao_Paulo";

/** "14/11/2026", no dia de São Paulo. O fuso fixo faz servidor e navegador escreverem a mesma coisa. */
export function dia(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("pt-BR", { timeZone: FUSO }) : "";
}

/** "14/11, 18:05", no relógio de São Paulo. */
export function diaEHora(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * O "agora" da tela. Começa no instante que o SERVIDOR mandou (para o primeiro
 * desenho do navegador sair igual ao do servidor) e depois anda sozinho, a
 * cada meio minuto, para "aberto há 12 min" não ficar parado em 12.
 */
export function useAgora(doServidor: string): number {
  const [agora, setAgora] = useState(() => Date.parse(doServidor));
  useEffect(() => {
    setAgora(Date.parse(doServidor));
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [doServidor]);
  return agora;
}

/**
 * Pede a página de novo de tempos em tempos, só com a aba à vista. É o que faz
 * a resposta de outra pessoa aparecer sem ninguém recarregar. O que a pessoa
 * está digitando não se perde: a tela é a mesma, só os dados chegam de novo.
 */
export function useAtualizarSozinho(aCada = 45_000, parado = false) {
  const router = useRouter();
  useEffect(() => {
    if (parado) return;
    const pedir = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(pedir, aCada);
    document.addEventListener("visibilitychange", pedir);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", pedir);
    };
  }, [router, aCada, parado]);
}
