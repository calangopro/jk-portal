"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Film, LoaderCircle, MessageSquarePlus, Trash2, X } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { NOME_DO_FORMATO, nomeDaRede, nomeDoFormatoNaRede } from "@/lib/redes/redes";
import type { PostNaTela } from "@/lib/redes/posts";
import { MAX_TEXTO_DA_NOTA, rotuloDaNota, type NotaDeRevisao } from "@/lib/redes/revisao-regra";
import type { Resposta } from "./actions";

/**
 * A janela de revisão de um post: o carrossel inteiro, grande, do jeito que vai
 * aparecer, e dois botões. Aprovar, ou recusar dizendo ONDE está o erro.
 *
 * Na lista o post é uma miniatura de 80 px: ninguém lê um carrossel assim. Aqui
 * cada card ocupa a tela, arrasta para o lado (dedo, mouse e trackpad), tem
 * setas, teclado e a fileira de miniaturas, e a legenda fica ao lado.
 *
 * Recusar pede ao menos uma nota. A pessoa toca na imagem para marcar o ponto
 * ou comenta o card inteiro, e a observação geral cobre o que não é de um card.
 * Tudo isso fica gravado (`redes_revisoes`) e o Claude lê pelo conector.
 *
 * É `<dialog>` nativo com `showModal()`: fica na camada de cima do navegador,
 * o foco fica preso nele e nenhuma pilha da moldura passa por cima.
 */

export type AcaoDeRevisar = (id: string, decisao: "aprovado" | "recusado", notas: unknown) => Promise<Resposta<{ decisao: "aprovado" | "recusado"; tirouDaFila: boolean }>>;

type NotaLocal = NotaDeRevisao & { k: number };

const quando = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(",", " às");

function Ponto({ n, x, y, cor }: { n: number; x: number; y: number; cor: "novo" | "antes" }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[0.7rem] font-bold text-white shadow-[0_0_0_2px_#fff,0_2px_6px_rgb(0_0_0/0.35)]"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: cor === "novo" ? "#b01919" : "#b8760a" }}
    >
      {n}
    </span>
  );
}

export function RevisorDoPost({ post, revisar, aoFechar }: { post: PostNaTela; revisar: AcaoDeRevisar; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; left: number; moveu: boolean } | null>(null);
  const [atual, setAtual] = useState(0);
  const [recusando, setRecusando] = useState(false);
  const [notas, setNotas] = useState<NotaLocal[]>([]);
  const [foco, setFoco] = useState<number | null>(null);
  const [resposta, setResposta] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [rodando, iniciar] = useTransition();
  const chave = useRef(0);

  const midias = post.midias;
  // A moldura tem a proporção em que o post aparece na rede: 4:5 no feed, 9:16 em story e vídeo curto.
  const proporcao = post.formato === "story" || post.formato === "video_curto" ? { l: 9, a: 16 } : post.formato === "video" ? { l: 16, a: 9 } : { l: 4, a: 5 };
  const total = Math.max(midias.length, 1);
  const anterior = post.revisao.ultima;
  const mostrarAnterior = post.revisao.estado !== "pendente" && anterior;
  const escritas = notas.filter((n) => n.texto.trim());

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Escreveu uma nota nova: o foco vai para o campo dela.
  useEffect(() => {
    if (foco === null) return;
    document.getElementById(`nota-${foco}`)?.focus();
    setFoco(null);
  }, [foco, notas]);

  const irPara = useCallback(
    (i: number) => {
      const el = faixa.current;
      if (!el) return;
      const alvo = Math.min(total - 1, Math.max(0, i));
      const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: alvo * el.clientWidth, behavior: reduzido ? "auto" : "smooth" });
      setAtual(alvo);
    },
    [total],
  );

  // O card que está à vista acompanha a rolagem (dedo, trackpad ou setas).
  const aoRolar = () => {
    const el = faixa.current;
    if (!el || arrasto.current?.moveu) return;
    const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    setAtual((a) => (a === i ? a : Math.min(total - 1, Math.max(0, i))));
  };

  // Arrastar com o mouse. No toque a rolagem é do navegador.
  const aoApertar = (e: React.PointerEvent) => {
    const el = faixa.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0 || total < 2) return;
    arrasto.current = { x: e.clientX, left: el.scrollLeft, moveu: false };
  };
  const aoMover = (e: React.PointerEvent) => {
    const a = arrasto.current;
    const el = faixa.current;
    if (!a || !el) return;
    const dx = e.clientX - a.x;
    if (!a.moveu && Math.abs(dx) < 6) return;
    a.moveu = true;
    el.style.scrollSnapType = "none";
    el.scrollLeft = a.left - dx;
  };
  const aoSoltar = (e: React.PointerEvent) => {
    const a = arrasto.current;
    const el = faixa.current;
    if (!a || !el) return;
    if (a.moveu) {
      const dx = e.clientX - a.x;
      const base = a.left / Math.max(el.clientWidth, 1);
      const passou = Math.abs(dx) > el.clientWidth * 0.12;
      const alvo = passou ? Math.round(base) + (dx < 0 ? 1 : -1) : Math.round(base);
      el.style.scrollSnapType = "";
      irPara(alvo);
      // O clique que vem logo depois do arrasto não pode virar um ponto na imagem.
      window.setTimeout(() => {
        arrasto.current = null;
      }, 0);
    } else {
      arrasto.current = null;
    }
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      irPara(atual + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      irPara(atual - 1);
    }
  };

  const fechar = () => {
    if (escritas.length && !window.confirm("Você escreveu notas que ainda não foram enviadas. Fechar mesmo assim?")) return;
    dialogo.current?.close();
  };

  const acrescentar = (card: number | null, x: number | null = null, y: number | null = null) => {
    const k = ++chave.current;
    setNotas((n) => [...n, { k, card, x, y, texto: "" }]);
    setFoco(k);
  };

  // Tocar na imagem, com o modo de recusa ligado, deixa um ponto numerado e abre a nota dele.
  const aoTocarNaImagem = (e: React.MouseEvent<HTMLDivElement>, i: number) => {
    if (!recusando || arrasto.current?.moveu) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / Math.max(r.width, 1);
    const y = (e.clientY - r.top) / Math.max(r.height, 1);
    acrescentar(i + 1, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  };

  const decidir = (decisao: "aprovado" | "recusado") =>
    iniciar(async () => {
      const r = await revisar(post.id, decisao, decisao === "recusado" ? escritas.map(({ k: _k, ...n }) => n) : []);
      if (!r.ok) {
        setResposta({ tom: "ruim", texto: r.erro });
        return;
      }
      setResposta({
        tom: "bom",
        texto: r.decisao === "aprovado" ? "Aprovado." : r.tirouDaFila ? "Recusado e tirado da fila. As notas ficaram guardadas para o ajuste." : "Recusado. As notas ficaram guardadas para o ajuste.",
      });
      window.setTimeout(() => dialogo.current?.close(), 1100);
    });

  // Pontos que aparecem em cada card: os da recusa que está sendo escrita, ou os da recusa anterior.
  const pontosDoCard = (i: number) => {
    if (recusando) return notas.map((n, idx) => ({ n: idx + 1, ...n })).filter((n) => n.card === i + 1 && n.x !== null && n.y !== null && n.texto.trim() !== "");
    if (!mostrarAnterior) return [];
    return anterior.notas.map((n, idx) => ({ n: idx + 1, k: idx, ...n })).filter((n) => n.card === i + 1 && n.x !== null && n.y !== null);
  };
  const notasNoCard = (i: number) => (recusando ? notas.filter((n) => n.card === i + 1 && n.texto.trim()).length : mostrarAnterior ? anterior.notas.filter((n) => n.card === i + 1).length : 0);

  const redes = post.envios.map((e) => ({ rede: e.rede, texto: `${nomeDaRede(e.rede)} ${e.conta}`.trim(), formato: nomeDoFormatoNaRede(post.formato, e.rede) }));

  return (
    <dialog
      ref={dialogo}
      aria-label="Revisar o post"
      onClose={aoFechar}
      onCancel={(e) => {
        if (escritas.length) e.preventDefault();
      }}
      onKeyDown={aoTeclar}
      className="m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none border-0 bg-[#f4efe7] p-0 text-ink backdrop:bg-[rgb(23_21_18/0.6)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 bg-white px-3 py-2.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{post.titulo || `${NOME_DO_FORMATO[post.formato]} para revisar`}</p>
            <p className="truncate text-xs text-muted">
              {NOME_DO_FORMATO[post.formato]} · {midias.length} {midias.length === 1 ? "mídia" : "mídias"}
              {post.criadoPor ? ` · montado por ${post.criadoPor}${post.origem === "conector" ? ", pelo Claude" : ""}` : ""}
            </p>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar a revisão" className="painel-toque grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden">
          {/* ------------------------------------------------------------ o carrossel */}
          <section aria-label="Carrossel" className="flex min-w-0 flex-col lg:h-full lg:min-h-0">
            {/* O palco só dá o espaço. A moldura tem a proporção do formato (4:5 no carrossel, como no Instagram)
                e é ela que corta: os cards andam DENTRO dela, colados um no outro, e seguem o dedo. */}
            <div className="grid h-[68dvh] shrink-0 place-items-center p-3 [container-type:size] sm:p-5 lg:h-auto lg:min-h-0 lg:flex-1">
              <div
                className="group relative overflow-hidden rounded-[10px] bg-black shadow-[0_8px_30px_rgb(23_21_18/0.22)]"
                style={{ width: `min(100cqw, ${(proporcao.l / proporcao.a) * 100}cqh)`, aspectRatio: `${proporcao.l} / ${proporcao.a}` }}
              >
                <div
                  ref={faixa}
                  onScroll={aoRolar}
                  onPointerDown={aoApertar}
                  onPointerMove={aoMover}
                  onPointerUp={aoSoltar}
                  onPointerLeave={aoSoltar}
                  tabIndex={0}
                  aria-roledescription="carrossel"
                  aria-label={`Card ${atual + 1} de ${total}`}
                  className={"flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden " + (total > 1 ? "cursor-grab active:cursor-grabbing" : "")}
                >
                  {(midias.length ? midias : [null]).map((m, i) => (
                    <div key={m?.url ?? i} role="group" aria-roledescription="card" aria-label={`Card ${i + 1} de ${total}`} className="relative h-full w-full shrink-0 snap-center snap-always">
                      {m?.tipo === "imagem" ? (
                        <div className={"absolute inset-0 " + (recusando ? "cursor-crosshair" : "")} onClick={(e) => aoTocarNaImagem(e, i)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt={m.alt || `Card ${i + 1}`} draggable={false} className="h-full w-full select-none object-contain" />
                          {pontosDoCard(i).map((p) => (
                            <Ponto key={p.k} n={p.n} x={p.x as number} y={p.y as number} cor={recusando ? "novo" : "antes"} />
                          ))}
                        </div>
                      ) : m?.tipo === "video" ? (
                        <video src={m.url} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
                      ) : (
                        <p className="grid h-full place-items-center bg-white p-5 text-center text-sm text-muted">Este post não tem imagem nem vídeo: só o texto da legenda.</p>
                      )}
                    </div>
                  ))}
                </div>

                {total > 1 ? (
                  <>
                    <p aria-live="polite" className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                      {atual + 1}/{total}
                    </p>
                    <button type="button" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Card anterior" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-md transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden max-sm:hidden">
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => irPara(atual + 1)} disabled={atual === total - 1} aria-label="Próximo card" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-md transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden max-sm:hidden">
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                    {/* Os pontinhos do Instagram. Só enfeitam: quem quer pular usa as miniaturas. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
                      {Array.from({ length: total }, (_, i) => (
                        <span key={i} className={"h-1.5 w-1.5 rounded-full shadow-[0_0_2px_rgb(0_0_0/0.5)] " + (i === atual ? "bg-white" : "bg-white/50")} />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {total > 1 ? (
              <ul aria-label="Cards do carrossel" className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 pt-1 sm:px-5">
                {midias.map((m, i) => {
                  const n = notasNoCard(i);
                  return (
                    <li key={m.url} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => irPara(i)}
                        aria-label={`Ir para o card ${i + 1}${n ? `, com ${n} ${n === 1 ? "nota" : "notas"}` : ""}`}
                        aria-current={i === atual ? "true" : undefined}
                        className={"relative grid h-16 w-12 place-items-center overflow-hidden rounded-[8px] bg-ink/10 ring-2 sm:h-20 sm:w-16 " + (i === atual ? "ring-[var(--setor)]" : "ring-transparent opacity-70")}
                      >
                        {m.tipo === "imagem" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                        ) : (
                          <Film size={18} aria-hidden="true" />
                        )}
                        <span className="absolute bottom-0 left-0 rounded-tr bg-ink/80 px-1 text-[0.6rem] font-bold text-white">{i + 1}</span>
                        {n ? <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#b01919] px-1 text-[0.6rem] font-bold text-white">{n}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          {/* ------------------------------------------------------------ a legenda e a decisão */}
          <aside className="flex min-w-0 flex-col gap-3 border-t border-ink/10 bg-white p-4 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
            {mostrarAnterior ? (
              <div className="rounded-[12px] p-3 text-xs leading-relaxed" style={post.revisao.estado === "aprovado" ? { color: "#046c4e", background: "#e3f4ec" } : { color: "#8a4a05", background: "#fcefd9" }}>
                <p className="font-bold">
                  {post.revisao.estado === "aprovado" ? "Aprovado" : post.revisao.estado === "recusado" ? "Recusado" : anterior.decisao === "recusado" ? "Recusado antes, e o post mudou depois" : "Aprovado antes, e o post mudou depois"}
                  {anterior.por ? ` por ${anterior.por}` : ""} em {quando(anterior.em)}.
                </p>
                {post.revisao.estado === "ajustado" ? <p className="mt-0.5">Confira se o que foi pedido foi resolvido e revise de novo.</p> : null}
                {anterior.notas.length ? (
                  <ol className="mt-2 space-y-1.5">
                    {anterior.notas.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-px grid h-5 min-w-5 place-items-center rounded-full bg-[#b8760a] px-1 text-[0.65rem] font-bold text-white">{i + 1}</span>
                        <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                          {n.card !== null ? (
                            <button type="button" onClick={() => irPara((n.card as number) - 1)} className="mr-1 font-bold underline">
                              {rotuloDaNota(n)}
                            </button>
                          ) : (
                            <span className="mr-1 font-bold">{rotuloDaNota(n)}</span>
                          )}
                          {n.texto}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="eyebrow">Legenda</p>
              {post.titulo ? <p className="mt-1 break-words text-sm font-semibold">{post.titulo}</p> : null}
              <p className="mt-1 max-h-[34dvh] overflow-y-auto whitespace-pre-line break-words text-sm leading-relaxed [overflow-wrap:anywhere] lg:max-h-[30dvh]">{post.legenda.trim() || <span className="text-muted">Sem legenda</span>}</p>
            </div>

            {redes.length ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
                {redes.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <SeloDaRede id={r.rede} tamanho={20} /> {r.texto} · {r.formato}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto border-t border-ink/10 pt-3">
              {resposta ? (
                <p role={resposta.tom === "ruim" ? "alert" : "status"} className="mb-3 break-words rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={resposta.tom === "ruim" ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}>
                  {resposta.texto}
                </p>
              ) : null}

              {recusando ? (
                <div>
                  <p className="text-sm font-semibold">O que está errado?</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    Toque na imagem para marcar o lugar, ou comente o card inteiro. Escreva como se explicasse a quem vai ajustar: o Claude lê estas notas.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => acrescentar(midias.length ? atual + 1 : null)} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold">
                      <MessageSquarePlus size={14} aria-hidden="true" /> {midias.length ? `Comentar o card ${atual + 1}` : "Comentar"}
                    </button>
                    {midias.length ? (
                      <button type="button" onClick={() => acrescentar(null)} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold">
                        <MessageSquarePlus size={14} aria-hidden="true" /> Observação geral
                      </button>
                    ) : null}
                  </div>

                  {notas.length ? (
                    <ol className="mt-3 space-y-2.5">
                      {notas.map((n, i) => (
                        <li key={n.k} className="rounded-[12px] bg-ink/[0.04] p-2.5">
                          <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="grid h-5 min-w-5 place-items-center rounded-full bg-[#b01919] px-1 text-[0.65rem] font-bold text-white">
                              {i + 1}
                            </span>
                            <button type="button" onClick={() => n.card !== null && irPara(n.card - 1)} className="text-xs font-bold underline decoration-dotted">
                              {rotuloDaNota(n)}
                              {n.x !== null ? ", ponto marcado" : ""}
                            </button>
                            <button type="button" onClick={() => setNotas((l) => l.filter((x) => x.k !== n.k))} aria-label={`Tirar a nota ${i + 1}`} className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted hover:text-[#b01919]">
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                          <textarea
                            id={`nota-${n.k}`}
                            value={n.texto}
                            onChange={(e) => setNotas((l) => l.map((x) => (x.k === n.k ? { ...x, texto: e.target.value } : x)))}
                            maxLength={MAX_TEXTO_DA_NOTA}
                            rows={3}
                            placeholder="O que precisa mudar aqui?"
                            aria-label={`Nota ${i + 1}, ${rotuloDaNota(n)}`}
                            className="mt-1.5 w-full resize-y rounded-[10px] border border-ink/15 bg-white px-2.5 py-2 text-sm leading-snug outline-none focus-visible:ring-2 focus-visible:ring-[var(--setor)]"
                          />
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={rodando || escritas.length === 0 || resposta?.tom === "bom"}
                      onClick={() => decidir("recusado")}
                      className="painel-toque inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: "#b01919" }}
                    >
                      {rodando ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                      Enviar recusa{escritas.length ? ` (${escritas.length} ${escritas.length === 1 ? "nota" : "notas"})` : ""}
                    </button>
                    <button type="button" disabled={rodando} onClick={() => { setRecusando(false); setResposta(null); }} className="rounded-full px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                      Voltar
                    </button>
                  </div>
                  {escritas.length === 0 ? <p className="mt-2 text-xs text-muted">Escreva ao menos uma nota para poder recusar.</p> : null}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={rodando || resposta?.tom === "bom"}
                    onClick={() => decidir("aprovado")}
                    className="painel-toque inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#046c4e" }}
                  >
                    {rodando ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Aprovar
                  </button>
                  <button type="button" disabled={rodando || resposta?.tom === "bom"} onClick={() => setRecusando(true)} className="painel-toque inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-60" style={{ color: "#b01919", borderColor: "#b01919", background: "#fff" }}>
                    <X size={16} aria-hidden="true" /> Recusar
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
