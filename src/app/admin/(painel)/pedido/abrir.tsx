"use client";

import { useSyncExternalStore } from "react";
import { History } from "lucide-react";

/**
 * Abrir o histórico de um pedido de QUALQUER tela, com um clique: o cartão do
 * suporte, a prévia do /pedido no chat, a ficha do cliente, a fila da
 * fábrica. Quem abre chama `abrirHistoricoDoPedido(número)`; a moldura do
 * painel desenha a gaveta (`NaMoldura.tsx`), que só é baixada na primeira vez.
 *
 * Arquivo leve de propósito: o botão entra em telas que nunca abrem o
 * histórico, e não pode trazer a gaveta junto.
 */

type Aberto = { numero: number; vez: number };

let aberto: Aberto | null = null;
let vezes = 0;
let quemAbriu: HTMLElement | null = null;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

export function abrirHistoricoDoPedido(numero: number, origem?: HTMLElement | null) {
  if (!Number.isInteger(numero) || numero <= 0) return;
  quemAbriu = origem ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  vezes += 1;
  aberto = { numero, vez: vezes };
  avisar();
}

/** Fecha a gaveta e devolve o foco a quem abriu, se ele ainda estiver na tela. */
export function fecharHistoricoDoPedido() {
  aberto = null;
  avisar();
  const volta = quemAbriu;
  quemAbriu = null;
  requestAnimationFrame(() => {
    // `getClientRects`, e não `offsetParent`: o botão pode estar dentro de algo `fixed` (a janela do chat).
    if (volta && volta.isConnected && volta.getClientRects().length > 0) volta.focus();
  });
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};

export function useHistoricoAberto(): Aberto | null {
  return useSyncExternalStore(
    assinar,
    () => aberto,
    () => null,
  );
}

/** O botão que abre o histórico. Pequeno, para caber ao lado de qualquer número de pedido. */
export function BotaoDoHistorico({ numero, rotulo = "Histórico", className }: { numero: number; rotulo?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => abrirHistoricoDoPedido(numero, e.currentTarget)}
      aria-label={`Histórico do pedido ${numero}`}
      title="Tudo o que aconteceu com o pedido"
      className={
        className ??
        "painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink hover:bg-ink/[0.04]"
      }
    >
      <History size={12} aria-hidden="true" /> {rotulo}
    </button>
  );
}
