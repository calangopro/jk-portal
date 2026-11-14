"use client";

import { useState } from "react";
import { BellOff, BellRing, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { EstadoDoAviso } from "@/lib/time/chat";
import { desligarAviso, ligarAviso, useAvisoDoSistema } from "@/lib/time/notificar";
import { botaoCheio, botaoClaro } from "../biblioteca/pecas";

/**
 * O botão que liga e desliga o aviso do sistema: a notificação do computador
 * quando chega mensagem e o painel está em segundo plano.
 *
 * O navegador só deixa pedir a permissão a partir de um clique, e a escolha é
 * de cada pessoa em cada navegador. Onde o navegador não mostra aviso de site
 * (iPhone, Android), o bloco não aparece: não há o que oferecer.
 *
 * `estadoDaPrevia` é só para a prévia de desenvolvimento, que mostra os
 * estados sem pedir permissão de verdade.
 */
export function AvisoDoSistema({ estadoDaPrevia }: { estadoDaPrevia?: EstadoDoAviso }) {
  const doNavegador = useAvisoDoSistema();
  const estado = estadoDaPrevia ?? doNavegador;
  const [ligando, setLigando] = useState(false);

  if (estado === "sem_suporte") return null;

  if (estado === "ligado") {
    return (
      <div className="rounded-[12px] border border-ink/[0.07] bg-white p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: COR_DO_TOM.bom.texto }}>
          <CircleCheck size={13} aria-hidden="true" /> Aviso do sistema ligado
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
          Com o painel em outra aba ou atrás de outra janela, o computador avisa de mensagem na Geral, nas salas do seu setor e em resposta a você. O aviso
          mostra quem escreveu e o começo do texto.
        </p>
        <button type="button" onClick={estadoDaPrevia ? undefined : desligarAviso} className={`${botaoClaro} mt-2 h-9`}>
          <BellOff size={13} aria-hidden="true" /> Desligar o aviso
        </button>
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="rounded-[12px] p-3" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
        <p className="flex items-center gap-1.5 text-xs font-bold">
          <TriangleAlert size={13} aria-hidden="true" /> O navegador bloqueou os avisos deste site
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed">
          Para receber aviso de mensagem nova, clique no cadeado ao lado do endereço, libere as notificações e recarregue a página.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-ink/[0.07] bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
        <BellRing size={13} className="painel-cor" aria-hidden="true" /> Aviso do sistema
      </p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
        Receba o aviso do computador quando chegar mensagem e o painel estiver em outra aba ou atrás de outra janela. Vale só neste navegador, com o
        painel aberto.
      </p>
      <button
        type="button"
        disabled={ligando}
        onClick={async () => {
          if (estadoDaPrevia) return;
          setLigando(true);
          await ligarAviso();
          setLigando(false);
        }}
        className={`${botaoCheio} mt-2 h-9`}
      >
        {ligando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <BellRing size={13} aria-hidden="true" />}
        {ligando ? "Esperando o navegador" : "Ligar o aviso"}
      </button>
    </div>
  );
}
