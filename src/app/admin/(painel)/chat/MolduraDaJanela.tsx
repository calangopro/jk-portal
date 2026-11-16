"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Maximize2, X } from "lucide-react";

/**
 * As peças da janela flutuante do chat que precisam existir ANTES de a
 * conversa chegar: o cabeçalho e o "abrindo". Ficam neste arquivo pequeno
 * porque a casca (`ChatFlutuante.tsx`, que vai em toda tela) mostra o
 * "abrindo" enquanto a conversa é buscada, e a conversa (`Janela.tsx`) usa o
 * mesmo cabeçalho depois.
 */

const botaoRedondo = "painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/75 hover:bg-ink/[0.06]";

export function CabecalhoDaJanela({
  idTitulo, titulo, apoio, voltar, telaCheia, fechar, tituloRef, extra,
}: {
  idTitulo: string;
  titulo: string;
  apoio?: React.ReactNode;
  /** Na conversa de uma sala: volta para a lista de salas. */
  voltar?: () => void;
  /** O endereço da tela cheia, para quem quer mais espaço. */
  telaCheia?: string;
  fechar: () => void;
  tituloRef?: React.Ref<HTMLHeadingElement>;
  extra?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-ink/[0.07] px-1.5 py-1.5">
      {voltar ? (
        <button type="button" onClick={voltar} aria-label="Voltar às salas" className={botaoRedondo}>
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
      ) : (
        <span className="painel-selo ml-1.5 mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full" aria-hidden="true">
          <span className="painel-ponto h-2.5 w-2.5 rounded-full" />
        </span>
      )}
      <div className="min-w-0 flex-1 py-0.5">
        <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="truncate text-[0.98rem] font-bold leading-tight text-ink outline-none">
          {titulo}
        </h2>
        {apoio ? <div className="truncate text-[0.7rem] leading-snug text-muted">{apoio}</div> : null}
      </div>
      {extra}
      {telaCheia ? (
        <Link href={telaCheia} aria-label="Abrir o chat em tela cheia" title="Abrir em tela cheia" className={botaoRedondo}>
          <Maximize2 size={17} aria-hidden="true" />
        </Link>
      ) : null}
      <button type="button" onClick={fechar} aria-label="Fechar o chat" title="Fechar (Esc)" className={botaoRedondo}>
        <X size={19} aria-hidden="true" />
      </button>
    </header>
  );
}

/** Enquanto a conversa é buscada (a primeira vez, ou quando a leitura falhou e está tentando de novo). */
export function Abrindo({ idTitulo, fechar, erro, deNovo }: { idTitulo: string; fechar: () => void; erro?: boolean; deNovo?: () => void }) {
  return (
    <>
      <CabecalhoDaJanela idTitulo={idTitulo} titulo="Chat do time" fechar={fechar} telaCheia="/admin/chat" />
      <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
        {erro ? (
          <div role="alert">
            <p className="text-sm font-bold text-ink">Não deu para abrir a conversa agora</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Costuma ser a conexão. Tente de novo em alguns segundos.</p>
            {deNovo ? (
              <button type="button" onClick={deNovo} className="painel-toque painel-aba-ativa mt-3 inline-flex h-10 items-center rounded-full px-4 text-xs font-semibold">
                Tentar de novo
              </button>
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Abrindo a conversa
          </p>
        )}
      </div>
    </>
  );
}
