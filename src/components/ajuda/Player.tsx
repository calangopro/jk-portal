"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import { TAMANHO_DO_PRINT, type Passo } from "@/lib/ajuda/tipos";

const INTERVALO = 5200;
const ZOOM_MAXIMO = 2.2;
/** Quanto da moldura a região ocupa depois do zoom, em porcentagem. */
const PREENCHE = 68;

/** Onde o cursor vai parar dentro da região: um pouco para a direita e para baixo do meio, como quem aponta. */
function pontaDoCursor(p: Passo) {
  return { x: p.regiao.x + p.regiao.l * 0.62, y: p.regiao.y + p.regiao.a * 0.6 };
}

/** O zoom e o deslocamento que põem a região no meio da moldura, sem mostrar borda vazia. */
export function enquadrar(p: Passo) {
  const { x, y, l, a } = p.regiao;
  const s = Math.max(1, Math.min(ZOOM_MAXIMO, PREENCHE / Math.max(l, 1), PREENCHE / Math.max(a, 1)));
  const limita = (v: number) => Math.min(0, Math.max(1 - s, v));
  const tx = limita(0.5 - ((x + l / 2) / 100) * s);
  const ty = limita(0.5 - ((y + a / 2) / 100) * s);
  return { s, tx: tx * 100, ty: ty * 100 };
}

/**
 * O player dos tutoriais: o print, um cursor que desliza até a região, um anel
 * que pulsa em volta dela e um zoom leve nela, com a legenda do passo embaixo.
 * Avança sozinho a cada uns 5 segundos; tem pausar, voltar, avançar, pontos de
 * progresso e teclado (setas e espaço). Sem biblioteca de animação: é CSS.
 *
 * Com `prefers-reduced-motion` não há movimento nenhum: nem cursor, nem zoom,
 * nem pulso, nem avanço sozinho. Fica só a moldura de destaque no print.
 */
export function Player({ passos, tela }: { passos: Passo[]; /** O nome da tela, para o texto alternativo. */ tela: string }) {
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(true);
  const [semMovimento, setSemMovimento] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => {
      setSemMovimento(m.matches);
      if (m.matches) setTocando(false);
    };
    ler();
    m.addEventListener("change", ler);
    return () => m.removeEventListener("change", ler);
  }, []);

  const ultimo = passos.length - 1;
  const passo = passos[Math.min(i, ultimo)];

  useEffect(() => {
    if (!tocando || semMovimento) return;
    const t = setTimeout(() => {
      if (i >= ultimo) setTocando(false);
      else setI(i + 1);
    }, INTERVALO);
    return () => clearTimeout(t);
  }, [i, tocando, semMovimento, ultimo]);

  // A janela abre com o foco no player, para as setas valerem sem clicar antes.
  useEffect(() => {
    raiz.current?.focus({ preventScroll: true });
  }, []);

  const ir = (n: number) => {
    setI(Math.max(0, Math.min(ultimo, n)));
  };
  const alternar = () => {
    if (!tocando && i >= ultimo) setI(0);
    setTocando((t) => !t);
  };
  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(i - 1);
    } else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      alternar();
    }
  };

  const celular = Boolean(passo.celular);
  const tam = celular ? TAMANHO_DO_PRINT.celular : TAMANHO_DO_PRINT.computador;
  const { s, tx, ty } = useMemo(() => enquadrar(passo), [passo]);
  const zoom = semMovimento ? 1 : s;
  const mexe = semMovimento ? { tx: 0, ty: 0 } : { tx, ty };
  const ponta = pontaDoCursor(passo);
  const r = passo.regiao;
  // Print de celular é alto: a moldura trava a altura e a largura sai da proporção.
  const alturaMax = "min(62dvh, 540px)";
  const larguraDaMoldura = celular ? `min(100%, calc(${alturaMax} * ${tam.l} / ${tam.a}))` : "100%";

  return (
    <div ref={raiz} tabIndex={0} onKeyDown={aoTeclar} className="outline-none" role="group" aria-roledescription="tutorial animado" aria-label={`Tutorial: ${tela}`}>
      <style>{`
        @keyframes jk-ajuda-pulso { 0% { transform: scale(1); opacity: 1 } 70% { transform: scale(1.05); opacity: .35 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes jk-ajuda-ponto { from { width: 0 } to { width: 100% } }
        .jk-ajuda-anel { animation: jk-ajuda-pulso 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .jk-ajuda-anel, .jk-ajuda-ponto { animation: none !important } .jk-ajuda-palco, .jk-ajuda-cursor { transition: none !important } }
      `}</style>

      <div
        className="relative mx-auto overflow-hidden rounded-[14px] border border-ink/10 bg-ink/[0.04]"
        style={{ width: larguraDaMoldura, aspectRatio: `${tam.l} / ${tam.a}` }}
      >
        <div
          className="jk-ajuda-palco absolute inset-0 origin-top-left"
          style={{ transform: `translate(${mexe.tx}%, ${mexe.ty}%) scale(${zoom})`, transition: "transform 900ms cubic-bezier(.45,.05,.25,1)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={passo.print}
            src={comBasePath(`/ajuda/${passo.print}`)}
            alt={passo.alt ?? `Tela ${tela}: ${passo.titulo}`}
            width={tam.l}
            height={tam.a}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover object-top"
          />
          {/* O anel escurece o resto do print com a própria sombra e pulsa em volta da região. */}
          <div
            aria-hidden="true"
            className="jk-ajuda-anel pointer-events-none absolute rounded-[10px] border-[3px] border-[#f2b84b]"
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.l}%`,
              height: `${r.a}%`,
              boxShadow: "0 0 0 9999px rgb(23 21 18 / 0.38)",
              transition: "all 900ms cubic-bezier(.45,.05,.25,1)",
            }}
          />
          {semMovimento ? null : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="jk-ajuda-cursor pointer-events-none absolute drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
              style={{
                left: `${ponta.x}%`,
                top: `${ponta.y}%`,
                width: `${26 / zoom}px`,
                height: `${26 / zoom}px`,
                transition: "left 900ms cubic-bezier(.45,.05,.25,1), top 900ms cubic-bezier(.45,.05,.25,1)",
              }}
            >
              <path d="M5 3l14 7.2-6.1 1.9L10.6 19z" fill="#fff" stroke="#171512" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      <div className="mt-3 min-h-[5.5rem]" aria-live="polite" aria-atomic="true">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
          Passo {i + 1} de {passos.length}
        </p>
        <h3 className="mt-0.5 font-display text-lg leading-snug text-ink">{passo.titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{passo.texto}</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Passo anterior" className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/12 bg-white text-ink disabled:opacity-40">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={alternar} aria-label={tocando ? "Pausar" : i >= ultimo ? "Ver de novo" : "Continuar"} className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white">
          {tocando ? <Pause size={16} aria-hidden="true" /> : i >= ultimo ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => ir(i + 1)} disabled={i === ultimo} aria-label="Próximo passo" className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/12 bg-white text-ink disabled:opacity-40">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <ol className="ml-1 flex min-w-0 flex-1 items-center gap-1.5" aria-label="Progresso">
          {passos.map((p, n) => (
            <li key={n} className="min-w-0 flex-1">
              <button type="button" onClick={() => ir(n)} aria-label={`Ir ao passo ${n + 1}: ${p.titulo}`} aria-current={n === i ? "step" : undefined} className="relative block h-5 w-full">
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-ink/12">
                  <span
                    key={n === i ? `${i}-${tocando}` : n}
                    className="jk-ajuda-ponto absolute inset-y-0 left-0 rounded-full bg-[#b8841f]"
                    style={
                      n === i && tocando && !semMovimento
                        ? { animation: `jk-ajuda-ponto ${INTERVALO}ms linear forwards` }
                        : { width: n <= i ? "100%" : "0%" }
                    }
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
