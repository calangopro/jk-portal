"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2, MessageCircle, Undo2, X } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import {
  NOME_DO_TIPO, dataPorExtenso, prazoEmPalavra, tomDoPrazo, type Decisao, type Oportunidade,
} from "@/lib/clientes/oportunidades";
import { SeloDeTom } from "../Pecas";

/**
 * Uma oportunidade de venda na tela: quando, por quê, o que oferecer e as duas
 * decisões ("já falei" e "não vale"). Serve à lista de oportunidades e à ficha
 * do cliente.
 *
 * QUEM GUARDA O "DESFAZER" É A LISTA, NÃO O CARTÃO. Marcar grava no banco e
 * manda a página se redesenhar, e a oportunidade marcada deixa de vir do
 * servidor: o cartão dela some. Na primeira versão o "Desfazer" morava dentro
 * do cartão, e no ar aconteceram as duas coisas erradas: na lista ele sumia
 * junto, e na ficha o botão ficava travado para sempre, esperando um redesenho
 * que tirava o próprio cartão de baixo dele. Por isso a marcação mora em
 * `useMarcacao`, usado por quem FICA na tela (a lista), no mesmo padrão do
 * salvar da ficha: espera a ação, guarda o que foi marcado e só então pede o
 * redesenho.
 *
 * O botão do WhatsApp só ABRE a conversa. O painel não escreve nem manda
 * mensagem para cliente.
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

type Fechada = Exclude<Decisao, "reaberta">;

export type MarcadaAgora = { o: OportunidadeNaTela; decisao: Fechada };

export const idDaOportunidade = (o: Pick<OportunidadeNaTela, "ref" | "tipo" | "ocorrencia">) => `${o.ref}|${o.tipo}|${o.ocorrencia}`;

const DECISAO_EM_PALAVRA: Record<Fechada, string> = { falei: "já falei", nao_vale: "não vale" };

/**
 * A marcação de oportunidades de uma lista: o que foi marcado NESTA visita
 * (para oferecer o "Desfazer"), qual está indo ao servidor e o último erro.
 *
 * A ação vem de fora, como propriedade de quem usa, para a tela poder ser
 * vista sem sessão.
 */
export function useMarcacao(marcar: Marcar) {
  const router = useRouter();
  const [agora, setAgora] = useState<MarcadaAgora[]>([]);
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);
  const [, comecar] = useTransition();

  const decidir = (o: OportunidadeNaTela, decisao: Decisao) => {
    const id = idDaOportunidade(o);
    setEmCurso(id);
    setErro(null);
    comecar(async () => {
      const r = await marcar(o.ref, o.tipo, o.ocorrencia, decisao);
      setEmCurso(null);
      if (!r.ok) {
        setErro({ id, texto: r.erro });
        return;
      }
      setAgora((lista) => {
        const semEla = lista.filter((m) => idDaOportunidade(m.o) !== id);
        return decisao === "reaberta" ? semEla : [...semEla, { o, decisao }];
      });
      // Só agora a página é redesenhada: o que foi marcado já está guardado aqui.
      router.refresh();
    });
  };

  /** A oportunidade ainda está aberta, ou seja, não foi marcada nesta visita. */
  const aberta = (o: OportunidadeNaTela) => !agora.some((m) => idDaOportunidade(m.o) === idDaOportunidade(o));

  return { agora, emCurso, erro, decidir, aberta };
}

const botao = "painel-toque inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60";

/** O que foi marcado nesta visita, com o "Desfazer": dedo erra de botão. */
export function MarcadasAgora({
  marcadas, emCurso, erro, aoDesfazer,
}: {
  marcadas: MarcadaAgora[];
  emCurso: string | null;
  erro: { id: string; texto: string } | null;
  aoDesfazer: (o: OportunidadeNaTela) => void;
}) {
  if (marcadas.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2" aria-label="Marcadas agora">
      {marcadas.map(({ o, decisao }) => {
        const id = idDaOportunidade(o);
        return (
          <li key={id} className="glass flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[16px] px-4 py-3">
            <p className="min-w-0 text-xs text-muted">
              <span className="font-semibold text-ink">{o.cliente ?? NOME_DO_TIPO[o.tipo]}</span>
              {o.cliente ? `, ${NOME_DO_TIPO[o.tipo].toLowerCase()}` : ""} de {dataPorExtenso(o.ocorrencia).slice(0, 5)}: marcada como{" "}
              {DECISAO_EM_PALAVRA[decisao]}.
            </p>
            <button type="button" disabled={emCurso !== null} onClick={() => aoDesfazer(o)} className={`${botao} border border-ink/12 bg-white text-ink`}>
              {emCurso === id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Undo2 size={13} aria-hidden="true" />} Desfazer
            </button>
            {erro?.id === id ? <p className="basis-full text-xs font-semibold text-[#b01919]">{erro.texto}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CartaoDaOportunidade({
  o, emCurso, erro, aoDecidir,
}: {
  o: OportunidadeNaTela;
  /** A oportunidade que está indo ao servidor agora. Enquanto houver uma, nenhum botão aceita toque. */
  emCurso: string | null;
  erro: { id: string; texto: string } | null;
  aoDecidir: (o: OportunidadeNaTela, decisao: Fechada) => void;
}) {
  const id = idDaOportunidade(o);
  const ocupado = emCurso !== null;
  const tom = tomDoPrazo(o.emDias);
  const prazo = o.emDias < 0 ? `passou ${prazoEmPalavra(o.emDias)}` : prazoEmPalavra(o.emDias);
  const lugar = [o.cidade, o.uf].filter(Boolean).join(", ");

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
        <button type="button" disabled={ocupado} onClick={() => aoDecidir(o, "falei")} className={`${botao} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}>
          {emCurso === id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Já falei
        </button>
        <button type="button" disabled={ocupado} onClick={() => aoDecidir(o, "nao_vale")} className={`${botao} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}>
          <X size={14} aria-hidden="true" /> Não vale
        </button>
      </div>
      {erro?.id === id ? <p className="mt-2 text-xs font-semibold text-[#b01919]">{erro.texto}</p> : null}
    </li>
  );
}
