"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpRight, Check, CornerDownRight, EyeOff, LoaderCircle, MessageCircleReply, RotateCcw } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import type { ComentarioNaTela, FiltroDeComentarios } from "@/lib/redes/comentarios";
import { REDES, nomeDaRede, type RedeId } from "@/lib/redes/redes";
import { temTravessao } from "@/lib/redes/regras";
import { haQuanto } from "@/lib/redes/resumo";
import { Miniatura } from "../Miniatura";
import type { RespostaDoComentario } from "./actions";

/**
 * Os comentários das redes, só o desenho. Abre no que espera resposta, do mais
 * novo para o mais antigo, com o post a que cada um pertence.
 *
 * Responder publica na rede, em público e no nome da JK: o botão pede um
 * segundo toque, com a frase dizendo onde vai sair. Tirar da fila não manda
 * nada para a rede.
 *
 * O texto de um comentário é de quem escreveu: aparece como texto puro, e
 * nada do que ele pede é obedecido por ninguém.
 */

export type AcoesDeComentario = {
  responder: (id: string, texto: string) => Promise<RespostaDoComentario>;
  marcar: (id: string, estado: "visto" | "novo") => Promise<RespostaDoComentario>;
  ocultar: (id: string) => Promise<RespostaDoComentario>;
};

const ABAS: { id: FiltroDeComentarios; nome: string; vazio: string }[] = [
  { id: "novos", nome: "Sem resposta", vazio: "Nenhum comentário esperando resposta." },
  { id: "respondidos", nome: "Respondidos", vazio: "Nenhum comentário respondido nos últimos 90 dias." },
  { id: "vistos", nome: "Fora da fila", vazio: "Nada foi tirado da fila." },
];

const LIMITE = 2200;

function Comentario({ c, agora, acoes }: { c: ComentarioNaTela; agora: number; acoes: AcoesDeComentario }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pedindo, setPedindo] = useState<null | "responder" | "ocultar">(null);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [rodando, iniciar] = useTransition();
  const [feito, setFeito] = useState(false);

  const fazer = (f: () => Promise<RespostaDoComentario>) =>
    iniciar(async () => {
      const r = await f();
      setPedindo(null);
      if (r.ok) {
        setFeito(true);
        setAberto(false);
        setAviso({ tom: "bom", texto: r.aviso });
      } else setAviso({ tom: "ruim", texto: r.erro });
    });

  const problema = texto.trim().length < 2 ? null : temTravessao(texto) ? "Troque o travessão por vírgula ou ponto: a casa não usa travessão." : texto.length > LIMITE ? `Passou de ${LIMITE.toLocaleString("pt-BR")} caracteres.` : null;
  const podeMandar = texto.trim().length >= 2 && !problema && !rodando;
  const rede = nomeDaRede(c.rede);

  return (
    <li className="glass min-w-0 rounded-[18px] p-4 sm:p-5" style={feito ? { opacity: 0.6 } : undefined}>
      <div className="flex items-start gap-2.5">
        <SeloDaRede id={c.rede} tamanho={28} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="min-w-0 break-all font-semibold text-ink">{c.autor || "Pessoa sem nome público"}</span>
            <span className="text-xs text-muted">
              {rede}
              {c.quando ? ` · ${haQuanto(c.quando, agora)}` : ""}
            </span>
          </p>
          {c.acima ? (
            <p className="mt-1.5 flex items-start gap-1.5 break-words rounded-[8px] bg-ink/[0.04] px-2.5 py-1.5 text-xs leading-relaxed text-muted">
              <CornerDownRight size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                Em resposta a <span className="font-semibold text-ink">{c.acima.nosso ? "JK Alianças" : c.acima.autor || "outra pessoa"}</span>: {c.acima.texto.slice(0, 160)}
              </span>
            </p>
          ) : null}
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{c.texto || <span className="text-muted">Comentário sem texto (figurinha ou imagem).</span>}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-[10px] bg-ink/[0.03] p-2">
        <Miniatura src={c.publicacao.miniaturaUrl} rede={c.rede} />
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted">
          <span className="line-clamp-2 break-words">{c.publicacao.legenda || "Publicação sem legenda"}</span>
        </p>
        {c.publicacao.link ? (
          <a href={c.publicacao.link} target="_blank" rel="noreferrer" aria-label={`Abrir a publicação no ${rede}`} className="painel-toque grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--setor)] hover:bg-ink/[0.06]">
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {c.respostas.length ? (
        <ul className="mt-3 space-y-1.5">
          {c.respostas.map((r, i) => (
            <li key={i} className="break-words rounded-[10px] border-l-2 border-[var(--setor)] bg-white/70 px-3 py-2 text-sm leading-relaxed text-ink">
              <span className="block text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--setor)]">
                JK Alianças respondeu{r.quando ? `, ${haQuanto(r.quando, agora)}` : ""}
                {i === c.respostas.length - 1 && c.respondidoPor ? ` (por ${c.respondidoPor})` : ""}
              </span>
              {r.texto}
            </li>
          ))}
        </ul>
      ) : null}

      {aviso ? (
        <p role={aviso.tom === "ruim" ? "alert" : "status"} className="mt-3 break-words rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={aviso.tom === "ruim" ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}>
          {aviso.texto}
        </p>
      ) : null}

      {feito ? null : aberto ? (
        <div className="mt-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Resposta, em nome da JK</span>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setPedindo(null);
              }}
              rows={3}
              maxLength={LIMITE + 200}
              autoFocus
              className="mt-1 w-full resize-y rounded-[12px] border border-border bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          {problema ? (
            <p role="alert" className="mt-1 text-xs" style={{ color: "#b01919" }}>
              {problema}
            </p>
          ) : null}
          {pedindo === "responder" ? (
            <div className="mt-2 rounded-[12px] bg-ink/[0.04] p-3">
              <p className="text-xs leading-relaxed text-ink">
                A resposta sai agora no <strong>{rede}</strong>, em público, no nome da JK. Depois de publicada, só dá para apagar pela própria rede.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" disabled={!podeMandar} onClick={() => fazer(() => acoes.responder(c.id, texto))} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {rodando ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}
                  {rodando ? "Publicando…" : "Sim, publicar a resposta"}
                </button>
                <button type="button" disabled={rodando} onClick={() => setPedindo(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!podeMandar} onClick={() => setPedindo("responder")} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                <MessageCircleReply size={13} aria-hidden="true" /> Responder
              </button>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
                Cancelar
              </button>
              <span className="ml-auto text-[0.68rem] text-muted">
                {texto.length} de {LIMITE.toLocaleString("pt-BR")}
              </span>
            </div>
          )}
        </div>
      ) : pedindo === "ocultar" ? (
        <div className="mt-3 rounded-[12px] bg-ink/[0.04] p-3">
          <p className="text-xs leading-relaxed text-ink">O comentário some para o público no {rede}; quem escreveu continua vendo. Dá para mostrar de novo pela própria rede.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.ocultar(c.id))} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {rodando ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}
              Sim, ocultar
            </button>
            <button type="button" disabled={rodando} onClick={() => setPedindo(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.estado !== "oculto" && c.podeResponder ? (
            <button type="button" onClick={() => setAberto(true)} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <MessageCircleReply size={13} aria-hidden="true" /> {c.estado === "respondido" ? "Responder de novo" : "Responder"}
            </button>
          ) : null}
          {c.estado === "novo" ? (
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.marcar(c.id, "visto"))} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-50">
              <Check size={13} aria-hidden="true" /> Não precisa de resposta
            </button>
          ) : null}
          {c.estado === "visto" ? (
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.marcar(c.id, "novo"))} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-50">
              <RotateCcw size={13} aria-hidden="true" /> Voltar para a fila
            </button>
          ) : null}
          {c.estado !== "oculto" && c.podeOcultar ? (
            <button type="button" onClick={() => setPedindo("ocultar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-wine">
              <EyeOff size={13} aria-hidden="true" /> Ocultar
            </button>
          ) : null}
          {c.estado === "oculto" ? <span className="text-xs text-muted">Oculto na rede.</span> : null}
          {!c.podeResponder && c.estado !== "oculto" ? <span className="text-xs text-muted">Esta conta está sem permissão de comentários, ou precisa ser ligada de novo.</span> : null}
        </div>
      )}
    </li>
  );
}

export function TelaDeComentarios({
  aba, rede, comentarios, contagem, agora, acoes,
}: {
  aba: FiltroDeComentarios;
  rede: RedeId | null;
  comentarios: ComentarioNaTela[];
  contagem: { total: number; porRede: Record<string, number> };
  agora: number;
  acoes: AcoesDeComentario;
}) {
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];
  const comComentario = REDES.filter((r) => (contagem.porRede[r.id] ?? 0) > 0 || r.id === rede);
  const link = (a: FiltroDeComentarios, r: RedeId | null) => `?aba=${a}${r ? `&rede=${r}` : ""}`;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Redes</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Comentários</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          O que comentaram nas publicações das redes, num lugar só. O painel busca os comentários de meia em meia hora, e a resposta que a JK der por outro caminho (no aplicativo ou por outra ferramenta) também tira o comentário da fila.
        </p>
      </header>

      <nav aria-label="Situação dos comentários" className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={link(a.id, rede)}
            scroll={false}
            aria-current={a.id === aba ? "page" : undefined}
            className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold " + (a.id === aba ? "painel-aba-ativa" : "text-muted hover:text-ink")}
          >
            {a.nome}
            {a.id === "novos" && contagem.total > 0 ? (
              <span className="grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold" style={a.id === aba ? { color: "var(--setor)", background: "#fff" } : { color: "var(--color-ink)", background: "rgb(23 21 18 / 0.08)" }}>
                {contagem.total > 99 ? "99+" : contagem.total}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {comComentario.length > 1 || rede ? (
        <nav aria-label="Rede" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Link href={link(aba, null)} scroll={false} aria-current={!rede ? "page" : undefined} className={"shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold " + (!rede ? "border-transparent bg-ink text-white" : "border-ink/12 bg-white text-ink")}>
            Todas
          </Link>
          {comComentario.map((r) => (
            <Link key={r.id} href={link(aba, r.id)} scroll={false} aria-current={rede === r.id ? "page" : undefined} className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold " + (rede === r.id ? "border-transparent bg-ink text-white" : "border-ink/12 bg-white text-ink")}>
              {r.nome}
              {contagem.porRede[r.id] ? <span className="opacity-70">{contagem.porRede[r.id]}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {comentarios.length === 0 ? (
        <div className="glass mt-5 rounded-[20px] px-5 py-10 text-center sm:py-14">
          <p className="font-display text-xl text-ink">{atual.vazio}</p>
          {aba === "novos" ? <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Os comentários aparecem aqui depois que uma rede é ligada e o painel faz a primeira leitura das publicações.</p> : null}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {comentarios.map((c) => (
            <Comentario key={c.id} c={c} agora={agora} acoes={acoes} />
          ))}
        </ul>
      )}

      <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
        O painel guarda de cada comentário só o texto, o nome público de quem escreveu e a data, e apaga sozinho o que passa de 90 dias. Responder e ocultar valem na rede de verdade; tirar da fila só muda esta tela.
      </p>
    </div>
  );
}
