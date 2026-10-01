"use client";

import { useId, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { medirCapturaAberta } from "@/lib/bio/medicao";
import type { BlocoDe } from "@/lib/bio/tipos";
import { cadastroAnterior, FormularioDeCaptura, linkDoGrupo, SucessoDaCaptura } from "./FormularioDeCaptura";
import { IconeWhatsapp } from "./Icones";

/**
 * Grupo de ofertas no WhatsApp: o botão da bio e a folha com o formulário.
 *
 * É a mesma captura do tema Esquenta da loja (`campanha-captura.html`). O
 * formulário em si mora em `FormularioDeCaptura`, que também serve à página
 * /grupo do anúncio.
 *
 * A folha é um `<dialog>` nativo: prende o foco, fecha no Esc e devolve o foco
 * ao botão sem uma linha de código para isso. No celular ela sobe de baixo,
 * que é onde está o polegar.
 */

type Props = { bloco: BlocoDe<"captura">; campanha: string };

export function Captura({ bloco, campanha }: Props) {
  const folha = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  // `undefined` é formulário; string ou null é a tela de pronto (null: sem id).
  const [leadId, setLeadId] = useState<string | null | undefined>(undefined);

  function abrir() {
    // Quem já se cadastrou vai direto para o botão do grupo.
    const anterior = cadastroAnterior();
    if (anterior) setLeadId(anterior.id ?? null);
    folha.current?.showModal();
    medirCapturaAberta({ campanha, origem: "bio" });
  }

  function fechar() {
    folha.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className="group flex w-full items-center gap-3 rounded-[20px] bg-[var(--bio-acao)] px-4 py-3.5 text-left text-[var(--bio-acao-texto)] shadow-[0_14px_30px_-16px_rgb(0_0_0/0.55)] transition-colors hover:bg-[var(--bio-acao-realce)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bio-acao-texto)]/10">
          <IconeWhatsapp size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold leading-tight">{bloco.rotulo}</span>
          {bloco.detalhe ? (
            <span className="mt-0.5 block text-[0.75rem] leading-snug opacity-85">{bloco.detalhe}</span>
          ) : null}
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
      </button>

      <dialog
        ref={folha}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          // Toque no fundo escuro fecha, como em qualquer folha de celular.
          if (e.target === e.currentTarget) fechar();
        }}
        className="m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-y-auto rounded-t-[26px] border-0 bg-[var(--bio-superficie)] p-0 text-[var(--bio-texto)] backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-[26px]"
      >
        <div className="relative px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--bio-linha-forte)] sm:hidden" />
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-[var(--bio-apoio)] hover:bg-[var(--bio-superficie-alta)] hover:text-[var(--bio-texto)]"
          >
            <X size={20} aria-hidden />
          </button>

          {leadId !== undefined ? (
            <SucessoDaCaptura
              bloco={bloco}
              campanha={campanha}
              origem="bio"
              href={bloco.grupoLink ? linkDoGrupo(bloco.grupoLink, leadId) : ""}
              idTitulo={idTitulo}
            />
          ) : (
            <FormularioDeCaptura
              bloco={bloco}
              campanha={campanha}
              origem="bio"
              idTitulo={idTitulo}
              aoEnviar={setLeadId}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
