"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, Loader2, MessageCircle, Undo2, X } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import {
  NOME_DO_TIPO, dataPorExtenso, prazoEmPalavra, tomDoPrazo, type Decisao, type Oportunidade,
} from "@/lib/clientes/oportunidades";
import { SeloDeTom } from "../Pecas";

/**
 * Uma oportunidade de venda: quando, por quê, o que oferecer e as duas
 * decisões ("já falei" e "não vale").
 *
 * Serve à lista de oportunidades e à ficha do cliente. Marcada, a oportunidade
 * não some na hora: vira uma linha com "Desfazer", porque dedo erra de botão.
 * Na próxima visita ela já não vem do servidor.
 *
 * O botão do WhatsApp só ABRE a conversa. O painel não escreve nem manda
 * mensagem para cliente.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

export type Marcar = (ref: string, tipo: string, ocorrencia: string, decisao: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

export type OportunidadeNaTela = Oportunidade & {
  ref: string;
  /** Só na lista geral: na ficha o cliente já está no título. */
  cliente?: string | null;
  telefone: string | null;
  cidade?: string | null;
  uf?: string | null;
  responsavel?: string | null;
};

export const idDaOportunidade = (o: Pick<OportunidadeNaTela, "ref" | "tipo" | "ocorrencia">) => `${o.ref}|${o.tipo}|${o.ocorrencia}`;

const DECISAO_EM_PALAVRA: Record<Exclude<Decisao, "reaberta">, string> = { falei: "já falei", nao_vale: "não vale" };

export function CartaoDaOportunidade({
  o, marcar, aoMarcar,
}: {
  o: OportunidadeNaTela;
  marcar: Marcar;
  /** Avisa a lista, para ela refazer as contagens. `null`: desfeita. */
  aoMarcar?: (id: string, decisao: Exclude<Decisao, "reaberta"> | null) => void;
}) {
  const [feita, setFeita] = useState<Exclude<Decisao, "reaberta"> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();

  const decidir = (decisao: Decisao) =>
    comecar(async () => {
      setErro(null);
      const r = await marcar(o.ref, o.tipo, o.ocorrencia, decisao);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      const nova = decisao === "reaberta" ? null : decisao;
      setFeita(nova);
      aoMarcar?.(idDaOportunidade(o), nova);
    });

  const tom = tomDoPrazo(o.emDias);
  const prazo = o.emDias < 0 ? `passou ${prazoEmPalavra(o.emDias)}` : prazoEmPalavra(o.emDias);
  const lugar = [o.cidade, o.uf].filter(Boolean).join(", ");
  const botao = "painel-toque inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60";

  if (feita) {
    return (
      <li className="glass flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[16px] px-4 py-3">
        <p className="min-w-0 text-xs text-muted">
          <span className="font-semibold text-ink">{o.cliente ?? NOME_DO_TIPO[o.tipo]}</span>
          {o.cliente ? `, ${NOME_DO_TIPO[o.tipo].toLowerCase()}` : ""}: marcada como {DECISAO_EM_PALAVRA[feita]}.
        </p>
        <button type="button" disabled={ocupado} onClick={() => decidir("reaberta")} className={`${botao} border border-ink/12 bg-white text-ink`}>
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Undo2 size={13} aria-hidden="true" />} Desfazer
        </button>
        {erro ? <p className="basis-full text-xs font-semibold text-[#b01919]">{erro}</p> : null}
      </li>
    );
  }

  return (
    <li className="glass flex flex-col rounded-[16px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <SeloDeTom tom={tom} titulo={dataPorExtenso(o.ocorrencia)}>
          {tom === "neutro" ? <CalendarDays size={11} aria-hidden="true" /> : null} {dataPorExtenso(o.ocorrencia).slice(0, 5)}, {prazo}
        </SeloDeTom>
        <span className="painel-selo rounded-full px-2 py-0.5 text-[0.68rem] font-bold">{NOME_DO_TIPO[o.tipo]}</span>
      </div>

      {o.cliente !== undefined ? (
        <p className="mt-2.5 min-w-0">
          <LinkRapido href={`/admin/clientes/${o.ref}`} className="break-words text-base font-semibold text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-[var(--setor)]">
            {o.cliente ?? "Cliente sem nome"}
          </LinkRapido>
          {lugar ? <span className="ml-2 text-xs text-muted">{lugar}</span> : null}
        </p>
      ) : null}

      <p className="mt-2 text-sm font-semibold leading-snug text-ink">{o.motivo}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
        <span className="font-semibold text-ink">O que oferecer: </span>
        {o.oferecer}
      </p>

      {o.origem === "gravacao" ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <SeloDeTom tom="atencao">Sugerida pela gravação</SeloDeTom>
          Ninguém confirmou esta data. Confira na ficha antes de chamar.
        </p>
      ) : null}
      {o.responsavel ? <p className="mt-2 text-xs text-muted">Cliente com {o.responsavel}.</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3.5">
        {o.telefone ? (
          <a href={`https://wa.me/${o.telefone}`} target="_blank" rel="noreferrer" className={`${botao} painel-aba-ativa basis-full sm:basis-auto`}>
            <MessageCircle size={15} aria-hidden="true" /> Abrir no WhatsApp
          </a>
        ) : (
          <span className="basis-full text-xs text-muted sm:basis-auto">Sem telefone na ficha.</span>
        )}
        <button type="button" disabled={ocupado} onClick={() => decidir("falei")} className={`${botao} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}>
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Já falei
        </button>
        <button type="button" disabled={ocupado} onClick={() => decidir("nao_vale")} className={`${botao} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}>
          <X size={14} aria-hidden="true" /> Não vale
        </button>
      </div>
      {erro ? <p className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </li>
  );
}
