"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowUpRight, CalendarDays, Check, Flame, Lightbulb, LoaderCircle, MessageCircleQuestion, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { fatorEmPalavra } from "@/lib/redes/conteudos";
import { quandoEmPalavra } from "@/lib/redes/datas";
import type { DadosDaIdeia, EstadoDaIdeia, FontesDeIdeia, IdeiaNaTela, OrigemDaIdeia } from "@/lib/redes/ideias";
import { NOME_DO_FORMATO, nomeDaRede, type Formato } from "@/lib/redes/redes";
import { temTravessao } from "@/lib/redes/regras";
import { Miniatura } from "../Miniatura";
import type { RespostaDaIdeia } from "./actions";

/**
 * O banco de ideias, só o desenho. Em cima, guardar uma ideia em uma linha.
 * No meio, as ideias por estado. Embaixo, de onde tirar ideia: o que rendeu
 * acima do normal, as perguntas dos comentários e as datas que vêm aí.
 *
 * "Virar post" abre o compositor com a ideia ao lado; o rascunho fica ligado a
 * ela, e daí o estado anda sozinho (agendada, publicada).
 */

export type AcoesDaIdeia = {
  criar: (dados: DadosDaIdeia) => Promise<RespostaDaIdeia>;
  editar: (id: string, dados: DadosDaIdeia) => Promise<RespostaDaIdeia>;
  mover: (id: string, estado: "ideia" | "produzindo" | "descartada") => Promise<RespostaDaIdeia>;
};

const COLUNAS: { estado: EstadoDaIdeia; nome: string; vazio: string }[] = [
  { estado: "ideia", nome: "Para fazer", vazio: "Nenhuma ideia guardada. Escreva uma em cima, ou tire uma das sugestões embaixo." },
  { estado: "produzindo", nome: "Em produção", vazio: "Nada em produção." },
  { estado: "agendada", nome: "Agendadas", vazio: "Nenhuma ideia com post na fila." },
  { estado: "publicada", nome: "Publicadas", vazio: "Nada publicado nos últimos 30 dias a partir de uma ideia." },
];

const ORIGEM: Record<OrigemDaIdeia, string | null> = { manual: null, em_alta: "Fazer de novo", comentario: "Dos comentários", data: "Data", conector: "Pelo Claude" };
const FORMATOS: Formato[] = ["post", "video_curto", "story", "video", "texto"];
const NOME_CURTO: Partial<Record<Formato, string>> = { post: "Post", carrossel: "Carrossel", video_curto: "Reels e Shorts", story: "Story", video: "Vídeo longo", texto: "Só texto" };
const campo = "w-full rounded-[12px] border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-[var(--setor)]";

const diaCurto = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

/** O endereço do compositor para uma ideia: o formato dela e, se tiver dia futuro, às 19h desse dia. */
function paraCompor(i: IdeiaNaTela, agora: number): string {
  const q = new URLSearchParams({ ideia: i.id });
  if (i.formato) q.set("formato", i.formato === "carrossel" ? "post" : i.formato);
  if (i.quando && Date.parse(`${i.quando}T19:00:00-03:00`) > agora + 30 * 60_000) q.set("quando", `${i.quando}T19:00`);
  return `/admin/redes/publicar/novo?${q.toString()}`;
}

function CartaoDaIdeia({ i, agora, acoes, aoMudar }: { i: IdeiaNaTela; agora: number; acoes: AcoesDaIdeia; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [titulo, setTitulo] = useState(i.titulo);
  const [notas, setNotas] = useState(i.notas);
  const [quando, setQuando] = useState(i.quando ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, iniciar] = useTransition();

  const fazer = (f: () => Promise<RespostaDaIdeia>) =>
    iniciar(async () => {
      const r = await f();
      if (!r.ok) return setErro(r.erro);
      setErro(null);
      setEditando(false);
      setDescartando(false);
      aoMudar();
    });

  const origem = ORIGEM[i.origem];
  const passou = i.quando ? Date.parse(`${i.quando}T23:59:59-03:00`) < agora : false;

  return (
    <li id={i.id} className="glass min-w-0 rounded-[16px] p-3.5">
      {editando ? (
        <div className="space-y-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} aria-label="Ideia" className={campo} />
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={4000} placeholder="Notas: o gancho, o produto, a referência" aria-label="Notas" className={`${campo} resize-y`} />
          <input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Dia pretendido" className={campo} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.editar(i.id, { titulo, notas, quando: quando || null, formato: i.formato, redes: i.redes }))} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
              {rodando ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} Salvar
            </button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{i.titulo}</p>
          {i.notas ? <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">{i.notas}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.68rem] font-semibold">
            {i.formato ? <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-ink">{NOME_CURTO[i.formato] ?? NOME_DO_FORMATO[i.formato]}</span> : null}
            {i.quando ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={passou && (i.estado === "ideia" || i.estado === "produzindo") ? { color: "#9a4a07", background: "#fcefd9" } : { color: "var(--color-ink)", background: "rgb(23 21 18 / 0.06)" }}>
                <CalendarDays size={11} aria-hidden="true" /> {diaCurto(i.quando)}
              </span>
            ) : null}
            {i.redes.map((r) => (
              <SeloDaRede key={r} id={r} tamanho={16} />
            ))}
            {origem ? <span className="text-muted">{origem}</span> : null}
          </p>
        </>
      )}

      {erro ? (
        <p role="alert" className="mt-2 rounded-[8px] px-2.5 py-1.5 text-xs font-semibold" style={{ color: "#b01919", background: "#fde8e8" }}>
          {erro}
        </p>
      ) : null}

      {editando ? null : descartando ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] bg-ink/[0.04] p-2">
          <span className="text-xs text-ink">Descartar esta ideia?</span>
          <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.mover(i.id, "descartada"))} className="painel-toque rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            Sim, descartar
          </button>
          <button type="button" onClick={() => setDescartando(false)} className="rounded-full px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink">
            Voltar
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {i.postId ? (
            <Link href={`/admin/redes/publicar/${i.postId}`} className="painel-toque inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink">
              Abrir o post <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          ) : (
            <Link href={paraCompor(i, agora)} className="painel-toque inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
              <Plus size={13} aria-hidden="true" /> Virar post
            </Link>
          )}
          {i.estado === "ideia" || i.estado === "produzindo" ? (
            <>
              <button type="button" onClick={() => setEditando(true)} aria-label={`Editar a ideia ${i.titulo}`} className="painel-toque inline-flex items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink">
                <Pencil size={12} aria-hidden="true" /> Editar
              </button>
              <button
                type="button"
                disabled={rodando}
                onClick={() => fazer(() => acoes.mover(i.id, i.estado === "ideia" ? "produzindo" : "ideia"))}
                className="painel-toque inline-flex items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink"
              >
                {i.estado === "ideia" ? "Em produção" : <><Undo2 size={12} aria-hidden="true" /> Para fazer</>}
              </button>
              <button type="button" onClick={() => setDescartando(true)} aria-label={`Descartar a ideia ${i.titulo}`} className="painel-toque grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06] hover:text-ink">
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function TelaDeIdeias({ ideias, fontes, agora, acoes }: { ideias: IdeiaNaTela[]; fontes: FontesDeIdeia; agora: number; acoes: AcoesDaIdeia }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState("");
  const [formato, setFormato] = useState<Formato | "">("");
  const [extra, setExtra] = useState<{ origem: OrigemDaIdeia; publicacaoId?: string; redes?: string[] }>({ origem: "manual" });
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [rodando, iniciar] = useTransition();
  const campoDaIdeia = useRef<HTMLInputElement>(null);

  const atualizar = () => router.refresh();

  const guardar = (dados: DadosDaIdeia, depois?: () => void) =>
    iniciar(async () => {
      const r = await acoes.criar(dados);
      if (!r.ok) return setAviso({ tom: "ruim", texto: r.erro });
      setAviso({ tom: "bom", texto: "Ideia guardada em Para fazer." });
      depois?.();
      atualizar();
    });

  /** Preenche o campo de cima e leva a pessoa até ele: a ideia é escrita por ela, não copiada. */
  const preencher = (texto: string, dados: { quando?: string; origem: OrigemDaIdeia; redes?: string[] }) => {
    setTitulo(texto);
    setQuando(dados.quando ?? "");
    setExtra({ origem: dados.origem, redes: dados.redes });
    setAviso(null);
    campoDaIdeia.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => campoDaIdeia.current?.focus(), 300);
  };

  const problema = titulo.trim() && temTravessao(titulo) ? "Troque o travessão por vírgula ou ponto: a casa não usa travessão." : null;
  const porEstado = (e: EstadoDaIdeia) => ideias.filter((i) => i.estado === e);

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Social Media</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Ideias</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">O que postar, guardado num lugar só. Escreva uma ideia, ou tire das sugestões embaixo: o que rendeu acima do normal, as perguntas dos comentários e as datas que vêm aí.</p>
      </header>

      <form
        className="glass mt-5 rounded-[18px] p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titulo.trim() || problema) return;
          guardar({ titulo, quando: quando || null, formato: formato || null, origem: extra.origem, publicacaoId: extra.publicacaoId, redes: extra.redes }, () => {
            setTitulo("");
            setQuando("");
            setFormato("");
            setExtra({ origem: "manual" });
          });
        }}
      >
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Lightbulb size={14} className="text-[var(--setor)]" aria-hidden="true" /> Nova ideia
          </span>
          <input ref={campoDaIdeia} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Ex.: Reels mostrando a gravação a laser por dentro da aliança" className={`${campo} mt-1.5`} />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block min-w-0">
            <span className="sr-only">Dia pretendido (opcional)</span>
            <input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} className={campo} />
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Formato (opcional)</span>
            <select value={formato} onChange={(e) => setFormato(e.target.value as Formato | "")} className={campo}>
              <option value="">Formato (opcional)</option>
              {FORMATOS.map((f) => (
                <option key={f} value={f}>
                  {NOME_CURTO[f]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={rodando || !titulo.trim() || Boolean(problema)} className="painel-toque col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-1">
            {rodando ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />} Guardar
          </button>
        </div>
        {problema || aviso ? (
          <p role={problema || aviso?.tom === "ruim" ? "alert" : "status"} className="mt-2 rounded-[10px] px-3 py-2 text-xs font-semibold" style={problema || aviso?.tom === "ruim" ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}>
            {problema ?? aviso?.texto}
          </p>
        ) : null}
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS.map((c) => {
          const lista = porEstado(c.estado);
          return (
            <section key={c.estado} className="min-w-0" aria-labelledby={`col-${c.estado}`}>
              <h2 id={`col-${c.estado}`} className="flex items-baseline gap-2 text-sm font-semibold text-ink">
                {c.nome} <span className="text-xs font-normal text-muted">{lista.length}</span>
              </h2>
              {lista.length ? (
                <ul className="mt-2 space-y-2">
                  {lista.map((i) => (
                    <CartaoDaIdeia key={i.id} i={i} agora={agora} acoes={acoes} aoMudar={atualizar} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-[14px] border border-dashed border-ink/15 px-3 py-4 text-xs leading-relaxed text-muted">{c.vazio}</p>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-10" aria-labelledby="t-fontes">
        <h2 id="t-fontes" className="font-display text-2xl text-ink">
          De onde tirar ideia
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Flame size={16} style={{ color: "#046c4e" }} aria-hidden="true" /> Fazer de novo
            </h3>
            <p className="mt-0.5 text-xs text-muted">O que rendeu acima do normal nos últimos 30 dias.</p>
            {fontes.emAlta.length ? (
              <ul className="mt-2 divide-y divide-ink/[0.07]">
                {fontes.emAlta.map((c) => {
                  const trecho = (c.legenda ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "publicação sem legenda";
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <Link href={`/admin/redes/conteudos/${c.id}`} className="shrink-0" aria-label="Ver a publicação">
                        <Miniatura src={c.miniatura_url} rede={c.rede} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: "#046c4e" }}>
                          {c.fator !== null ? `${fatorEmPalavra(c.fator)} o normal` : ""}
                          <span className="font-normal text-muted"> · {nomeDaRede(c.rede)}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink">{trecho}</p>
                      </div>
                      <button
                        type="button"
                        disabled={rodando}
                        onClick={() => guardar({ titulo: `Fazer de novo: ${trecho}`.slice(0, 160), formato: c.formato, redes: [c.rede], origem: "em_alta", publicacaoId: c.id })}
                        className="painel-toque shrink-0 rounded-full border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nada acima do normal que ainda não virou ideia.</p>
            )}
          </div>

          <div className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MessageCircleQuestion size={16} className="text-[var(--setor)]" aria-hidden="true" /> Perguntas nos comentários
            </h3>
            <p className="mt-0.5 text-xs text-muted">O que perguntaram nos últimos 30 dias. Uma pergunta repetida é post pronto.</p>
            {fontes.perguntas.length ? (
              <ul className="mt-2 divide-y divide-ink/[0.07]">
                {fontes.perguntas.map((p) => (
                  <li key={p.id} className="py-2.5">
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-ink">
                      <span className="mt-0.5 shrink-0">
                        <SeloDaRede id={p.rede} tamanho={16} />
                      </span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">“{p.texto}”</span>
                    </p>
                    <button type="button" onClick={() => preencher(`Responder em post: ${p.texto}`.slice(0, 160), { origem: "comentario", redes: [p.rede] })} className="mt-1.5 text-xs font-semibold text-[var(--setor)] underline-offset-2 hover:underline">
                      Escrever a ideia
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhuma pergunta nos comentários dos últimos 30 dias.</p>
            )}
          </div>

          <div className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays size={16} className="text-[var(--setor)]" aria-hidden="true" /> Datas que vêm aí
            </h3>
            <p className="mt-0.5 text-xs text-muted">Os próximos 60 dias: as campanhas da casa (as da bio) e as datas do comércio.</p>
            {fontes.datas.length ? (
              <ul className="mt-2 divide-y divide-ink/[0.07]">
                {fontes.datas.map((d) => (
                  <li key={`${d.nome}${d.data}`} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-ink/[0.05] text-center text-[0.68rem] font-bold leading-tight text-ink">{d.tipo === "campanha" && d.faltam === 0 ? "no ar" : diaCurto(d.data)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                      <p className="text-[0.7rem] text-muted">
                        {d.tipo === "campanha" ? "Campanha da casa · " : ""}
                        {quandoEmPalavra(d)}
                      </p>
                    </div>
                    <button type="button" onClick={() => preencher(`${d.nome}: `, { origem: "data", quando: d.faltam === 0 && d.fim ? undefined : d.data })} className="painel-toque shrink-0 rounded-full border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink">
                      Planejar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhuma data nos próximos 60 dias.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
