"use client";

import Link from "next/link";
import { BookCheck, BookPlus, Check, CornerUpLeft, Ellipsis, ImageOff, Loader2, MessageCircleQuestion, RotateCcw, Trash2 } from "lucide-react";
import { ROLE_LABEL, type AppRole } from "@/lib/auth/acessos";
import { COR_DO_TOM } from "@/lib/painel/tons";
import {
  esperaDoPedido, estaEsperando, horaCurta, iniciais, partesDoTexto, rotuloDoDia, trechoDe, type Linha, type Mensagem, type Sala,
} from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";
import type { ImagemEscolhida } from "./Imagens";

/**
 * A conversa de uma sala, desenhada: o separador de cada dia, a linha "Novas
 * mensagens", as falas e as mensagens que ainda estão indo.
 *
 * A minha fala fica à direita, com a cor do setor por baixo; a dos outros, à
 * esquerda, com as iniciais e o nome. É o desenho que o time já conhece do
 * aplicativo de conversa que usa todo dia.
 *
 * O PEDIDO é a mensagem que pede resposta. Ele leva um selo com ícone e
 * palavra (a cor nunca vem sozinha): esperando, parado, atrasado ou
 * respondido, pela mesma régua de `esperaDoPedido`.
 */

/** A mensagem que a pessoa mandou e ainda não voltou gravada do banco. */
export type Pendente = {
  chave: string;
  sala: Sala;
  texto: string;
  respondeA: Mensagem | null;
  pede: boolean;
  imagens: ImagemEscolhida[];
  erro: string | null;
};

export type AcaoDaFala = "responder" | "resolver" | "pedir" | "apagar" | "guardar";

const papel = (p: string | null) => (p ? (ROLE_LABEL[p as AppRole] ?? null) : null);

/** A bolinha com as iniciais de quem fala. Decorativa: o nome vem escrito ao lado. */
export function Bolinha({ nome, pequena }: { nome: string | null; pequena?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`painel-selo grid shrink-0 place-items-center rounded-full font-bold ${pequena ? "h-6 w-6 text-[0.58rem]" : "h-8 w-8 text-[0.68rem]"}`}
    >
      {iniciais(nome)}
    </span>
  );
}

function Texto({ escrito }: { escrito: string }) {
  return (
    <p className="whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-ink">
      {partesDoTexto(escrito).map((p, i) =>
        p.tipo === "link" ? (
          <a
            key={i}
            href={p.valor}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="font-medium underline decoration-ink/30 underline-offset-2 [overflow-wrap:anywhere]"
          >
            {p.valor}
          </a>
        ) : (
          <span key={i}>{p.valor}</span>
        ),
      )}
    </p>
  );
}

/** As imagens de uma fala. `undefined` no link é "ainda chegando"; `null` é "não deu para abrir". */
function Imagens({ anexos, linkDe }: { anexos: string[]; linkDe: (anexo: string) => string | null | undefined }) {
  if (anexos.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {anexos.map((a, n) => {
        const link = linkDe(a);
        return (
          <li key={a}>
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Abrir a imagem ${n + 1} em tamanho inteiro`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={link} alt={`Imagem ${n + 1} da mensagem`} loading="lazy" className="h-32 w-32 rounded-[10px] border border-ink/10 bg-white object-cover sm:h-40 sm:w-40" />
              </a>
            ) : link === null ? (
              <span className="grid h-32 w-32 place-items-center gap-1 rounded-[10px] border border-dashed border-ink/20 p-2 text-center text-[0.68rem] leading-snug text-muted">
                <ImageOff size={16} aria-hidden="true" />
                Imagem indisponível agora
              </span>
            ) : (
              <span role="status" className="grid h-32 w-32 animate-pulse place-items-center rounded-[10px] bg-ink/[0.06] sm:h-40 sm:w-40">
                <span className="sr-only">Carregando a imagem</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A mensagem citada em cima da resposta. Toque leva até ela, quando está na tela. */
function Citada({ nome, trecho, onIr }: { nome: string; trecho: string; onIr?: () => void }) {
  const dentro = (
    <>
      <span className="painel-cor block text-[0.68rem] font-bold leading-tight">{nome}</span>
      <span className="block truncate text-xs leading-snug text-ink/70">{trecho || "Mensagem"}</span>
    </>
  );
  const classe = "painel-ramo mb-1.5 block w-full min-w-0 rounded-r-[8px] bg-ink/[0.04] py-1 pl-2 pr-2 text-left";
  if (!onIr) return <span className={classe}>{dentro}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onIr();
      }}
      className={`${classe} painel-toque`}
    >
      {dentro}
    </button>
  );
}

const botaoDeAcao = "painel-toque inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink disabled:opacity-60";

function Fala({
  m, cabeca, minha, souAdmin, agora, linkDe, aberta, ocupada, destacada, apagando, onAlternar, onAcao, onIrPara,
}: {
  m: Mensagem;
  cabeca: boolean;
  minha: boolean;
  souAdmin: boolean;
  agora: number;
  linkDe: (anexo: string) => string | null | undefined;
  aberta: boolean;
  ocupada: boolean;
  destacada: boolean;
  /** A pessoa tocou em apagar uma vez: o botão vira a confirmação. */
  apagando: boolean;
  onAlternar: () => void;
  onAcao: (qual: AcaoDaFala) => void;
  onIrPara: (id: number) => void;
}) {
  const espera = esperaDoPedido(m, agora);
  const nome = minha ? "Você" : (m.autorNome ?? "Alguém do time");
  const cargo = minha ? null : papel(m.autorPapel);
  const podeApagar = !m.apagada && (minha || souAdmin);
  const podePedir = !m.apagada && (minha || souAdmin) && !estaEsperando(m);

  return (
    <li id={`fala-${m.id}`} data-fala={m.id} className={`flex gap-2 ${minha ? "flex-row-reverse" : ""} ${cabeca ? "mt-3" : "mt-0.5"}`}>
      {/* A coluna das iniciais existe em toda fala dos outros, para o texto ficar alinhado mesmo sem a bolinha. */}
      {minha ? null : <span className="w-8 shrink-0">{cabeca ? <Bolinha nome={m.autorNome} /> : null}</span>}

      <div className={`group flex min-w-0 max-w-[86%] flex-col sm:max-w-[72%] ${minha ? "items-end" : "items-start"}`}>
        {cabeca && !minha ? (
          <p className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5 px-1 text-xs">
            <span className="font-bold text-ink">{nome}</span>
            {cargo ? <span className="text-muted">{cargo}</span> : null}
          </p>
        ) : null}

        <div className={`flex max-w-full items-center gap-1 ${minha ? "flex-row-reverse" : ""}`}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            onClick={m.apagada ? undefined : onAlternar}
            className={`min-w-0 rounded-[16px] px-3 py-2 transition-shadow ${m.apagada ? "" : "cursor-pointer"} ${
              minha ? "rounded-br-[6px] bg-[color-mix(in_srgb,var(--setor)_11%,#fff)]" : "rounded-bl-[6px] border border-ink/[0.07] bg-white"
            } ${destacada ? "ring-2 ring-[var(--setor)]" : ""}`}
          >
            {m.respondeA && !m.apagada ? (
              <Citada
                nome={m.respondeA.autorNome ?? "Alguém do time"}
                trecho={trechoDe(m.respondeA)}
                onIr={() => onIrPara(m.respondeA!.id)}
              />
            ) : null}

            {m.apagada ? (
              <p className="text-sm italic text-muted">Mensagem apagada</p>
            ) : (
              <>
                {m.texto ? <Texto escrito={m.texto} /> : null}
                <Imagens anexos={m.anexos} linkDe={linkDe} />
              </>
            )}

            <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 ${minha ? "justify-end" : ""}`}>
              {espera ? (
                <SeloDeTom tom={espera.tom}>
                  {espera.tom === "neutro" ? <MessageCircleQuestion size={11} aria-hidden="true" /> : null}
                  {espera.palavra}
                </SeloDeTom>
              ) : null}
              {m.naBiblioteca ? (
                <span className="inline-flex items-center gap-1 text-[0.68rem] font-semibold" style={{ color: COR_DO_TOM.bom.texto }}>
                  <BookCheck size={11} aria-hidden="true" /> Na biblioteca
                </span>
              ) : null}
              <time dateTime={m.em} className="numeros text-[0.66rem] leading-none text-muted">
                {horaCurta(m.em)}
              </time>
            </p>
          </div>

          {m.apagada ? null : (
            <button
              type="button"
              onClick={onAlternar}
              aria-expanded={aberta}
              aria-label={`Ações da mensagem de ${nome}`}
              className={`painel-toque grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-opacity hover:bg-ink/[0.06] focus-visible:opacity-100 group-hover:opacity-100 ${
                aberta ? "bg-ink/[0.06] opacity-100" : "opacity-40 sm:opacity-0"
              }`}
            >
              <Ellipsis size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {aberta && !m.apagada ? (
          <div className={`mt-1 flex max-w-full flex-wrap gap-1.5 ${minha ? "justify-end" : ""}`} role="group" aria-label={`Ações da mensagem de ${nome}`}>
            <button type="button" disabled={ocupada} onClick={() => onAcao("responder")} className={botaoDeAcao}>
              <CornerUpLeft size={12} aria-hidden="true" /> Responder
            </button>
            {estaEsperando(m) ? (
              <button type="button" disabled={ocupada} onClick={() => onAcao("resolver")} className={botaoDeAcao}>
                {ocupada ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />} Resolvido
              </button>
            ) : null}
            {podePedir ? (
              <button type="button" disabled={ocupada} onClick={() => onAcao("pedir")} className={botaoDeAcao}>
                {m.pede ? <RotateCcw size={12} aria-hidden="true" /> : <MessageCircleQuestion size={12} aria-hidden="true" />}
                {m.pede ? "Ainda preciso" : "Pedir resposta"}
              </button>
            ) : null}
            {m.naBiblioteca ? (
              <Link href={`/admin/biblioteca?r=${m.naBiblioteca}`} className={botaoDeAcao}>
                <BookCheck size={12} aria-hidden="true" /> Ver na biblioteca
              </Link>
            ) : m.respostas > 0 ? (
              <button type="button" disabled={ocupada} onClick={() => onAcao("guardar")} className={botaoDeAcao}>
                <BookPlus size={12} aria-hidden="true" /> Guardar na biblioteca
              </button>
            ) : null}
            {podeApagar ? (
              <button
                type="button"
                disabled={ocupada}
                onClick={() => onAcao("apagar")}
                className={`${botaoDeAcao} ${apagando ? "border-transparent text-white" : ""}`}
                style={apagando ? { background: COR_DO_TOM.ruim.texto } : undefined}
              >
                <Trash2 size={12} aria-hidden="true" /> {apagando ? "Apagar mesmo?" : "Apagar"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** A mensagem que está indo: já aparece na conversa, mais clara, e diz se falhou. */
function Indo({ p, onDeNovo, onDescartar }: { p: Pendente; onDeNovo: () => void; onDescartar: () => void }) {
  return (
    <li className="mt-1.5 flex flex-row-reverse gap-2">
      <div className="flex min-w-0 max-w-[86%] flex-col items-end sm:max-w-[72%]">
        <div className={`min-w-0 rounded-[16px] rounded-br-[6px] bg-[color-mix(in_srgb,var(--setor)_11%,#fff)] px-3 py-2 ${p.erro ? "" : "opacity-60"}`}>
          {p.respondeA ? <Citada nome={p.respondeA.autorNome ?? "Alguém do time"} trecho={trechoDe(p.respondeA)} /> : null}
          {p.texto ? <Texto escrito={p.texto} /> : null}
          {p.imagens.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {p.imagens.map((i, n) => (
                <li key={i.chave}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.previa} alt={`Imagem ${n + 1} sendo enviada`} className="h-32 w-32 rounded-[10px] border border-ink/10 bg-white object-cover sm:h-40 sm:w-40" />
                </li>
              ))}
            </ul>
          ) : null}
          {p.erro ? null : (
            <p role="status" className="mt-1 flex items-center justify-end gap-1 text-[0.66rem] text-muted">
              <Loader2 size={10} className="animate-spin" aria-hidden="true" /> Enviando
            </p>
          )}
        </div>
        {p.erro ? (
          <div role="alert" className="mt-1 flex max-w-full flex-wrap items-center justify-end gap-1.5">
            <span className="text-xs font-semibold" style={{ color: COR_DO_TOM.ruim.texto }}>
              Não foi. {p.erro}
            </span>
            <button type="button" onClick={onDeNovo} className={botaoDeAcao}>
              <RotateCcw size={12} aria-hidden="true" /> Tentar de novo
            </button>
            <button type="button" onClick={onDescartar} className={botaoDeAcao}>
              <Trash2 size={12} aria-hidden="true" /> Descartar
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function Conversa({
  linhas, pendentes, meuId, souAdmin, agora, linkDe, aberta, ocupada, destaque, apagando, onAlternar, onAcao, onIrPara, onDeNovo, onDescartar,
}: {
  linhas: Linha[];
  pendentes: Pendente[];
  meuId: string;
  souAdmin: boolean;
  agora: number;
  linkDe: (anexo: string) => string | null | undefined;
  /** A fala com as ações à vista. */
  aberta: number | null;
  /** A fala cuja ação está sendo gravada. */
  ocupada: number | null;
  /** A fala para onde a pessoa pulou: fica com a borda do setor por um instante. */
  destaque: number | null;
  apagando: number | null;
  onAlternar: (id: number) => void;
  onAcao: (m: Mensagem, qual: AcaoDaFala) => void;
  onIrPara: (id: number) => void;
  onDeNovo: (p: Pendente) => void;
  onDescartar: (p: Pendente) => void;
}) {
  return (
    <ol aria-label="A conversa da sala" className="flex flex-col">
      {linhas.map((l) =>
        l.tipo === "dia" ? (
          <li key={l.chave} className="mb-1 mt-4 flex items-center gap-3 first:mt-1" aria-label={rotuloDoDia(l.dia, agora)}>
            <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
            <span className="rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wider text-muted">{rotuloDoDia(l.dia, agora)}</span>
            <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
          </li>
        ) : l.tipo === "novas" ? (
          <li key={l.chave} data-novas className="mt-3 flex items-center gap-3">
            <span className="painel-ponto h-px flex-1 opacity-50" aria-hidden="true" />
            <span className="painel-cor text-[0.66rem] font-bold uppercase tracking-wider">Novas mensagens</span>
            <span className="painel-ponto h-px flex-1 opacity-50" aria-hidden="true" />
          </li>
        ) : (
          <Fala
            key={l.chave}
            m={l.m}
            cabeca={l.cabeca}
            minha={l.m.autor === meuId}
            souAdmin={souAdmin}
            agora={agora}
            linkDe={linkDe}
            aberta={aberta === l.m.id}
            ocupada={ocupada === l.m.id}
            destacada={destaque === l.m.id}
            apagando={apagando === l.m.id}
            onAlternar={() => onAlternar(l.m.id)}
            onAcao={(qual) => onAcao(l.m, qual)}
            onIrPara={onIrPara}
          />
        ),
      )}
      {pendentes.map((p) => (
        <Indo key={p.chave} p={p} onDeNovo={() => onDeNovo(p)} onDescartar={() => onDescartar(p)} />
      ))}
    </ol>
  );
}
