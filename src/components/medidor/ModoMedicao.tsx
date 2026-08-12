"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Minus, Plus, Check, ArrowLeft, Hand, Coins, CreditCard } from "lucide-react";
import { Anel } from "./Anel";
import { ObjetoReferencia } from "./ObjetoReferencia";
import {
  REFERENCIAS,
  type ReferenciaId,
  aroRecomendado,
  aroExatoPorDiametro,
  diametroDoAro,
  ARO_MINIMO,
  ARO_MAXIMO,
} from "@/lib/medidor/aros";

export const DIAMETRO_MIN = diametroDoAro(ARO_MINIMO) - 0.6;
export const DIAMETRO_MAX = diametroDoAro(ARO_MAXIMO) + 0.6;

const PX_POR_MM_MIN = 1.2;
const PX_POR_MM_MAX = 9;

type Etapa = "escolha" | "calibrar" | "medir";

function limitar(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function mm(v: number, casas = 2) {
  return v.toFixed(casas).replace(".", ",");
}

/**
 * Modo de medição: a ferramenta em tela cheia, sobre fundo carvão.
 *
 * O palco escuro não é enfeite. O dourado da marca sobre marfim nunca tem
 * contraste suficiente para o anel virar protagonista, e aqui a pessoa precisa
 * enxergar a borda do furo com precisão, encostando a aliança de verdade na
 * tela. Fora daqui a página continua clara e indexável.
 *
 * Acessibilidade: arrastar e pinçar são atalhos de ponteiro. Quem usa teclado
 * ou leitor de tela tem o controle deslizante, que carrega `aria-valuetext`
 * com o aro por extenso, e o resultado é anunciado por `aria-live`.
 */
export function ModoMedicao({
  pxPorMm,
  referencia,
  diametroMm,
  aoDefinirCalibragem,
  aoDefinirDiametro,
  aoFechar,
}: {
  pxPorMm: number | null;
  referencia: ReferenciaId;
  diametroMm: number;
  aoDefinirCalibragem: (px: number, ref: ReferenciaId) => void;
  aoDefinirDiametro: (mm: number) => void;
  aoFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(pxPorMm ? "medir" : "escolha");
  const [refEscolhida, setRefEscolhida] = useState<ReferenciaId>(referencia);
  const [rascunho, setRascunho] = useState(pxPorMm ?? 3.8);

  const painel = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  const aro = aroRecomendado(diametroMm);
  const exato = aroExatoPorDiametro(diametroMm);
  const entreDois = Math.abs(exato - Math.round(exato)) > 0.3;

  /* ------------------------------------------------- teclado e rolagem */

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        aoFechar();
        return;
      }
      if (e.key !== "Tab" || !painel.current) return;

      const focaveis = painel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fechar.current?.focus();

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aoFechar]);

  /* -------------------------------------------- manipulação direta */

  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const base = useRef<{ medida: number; diametro: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // Devolve uma medida em pixels comparável entre gestos: com um dedo é o
  // diâmetro implícito (distância ao centro vezes dois), com dois é a
  // distância entre eles. Como só usamos a VARIAÇÃO, o anel nunca salta para
  // debaixo do dedo quando o toque começa.
  const medidaEmPx = useCallback((): number | null => {
    const pts = [...ponteiros.current.values()];
    if (pts.length === 0 || !palco.current) return null;
    if (pts.length === 1) {
      const r = palco.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return Math.hypot(pts[0].x - cx, pts[0].y - cy) * 2;
    }
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }, []);

  const rebasear = useCallback(
    (diametroAtual: number) => {
      const medida = medidaEmPx();
      base.current = medida == null ? null : { medida, diametro: diametroAtual };
    },
    [medidaEmPx],
  );

  const aoDescer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pxPorMm) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A captura é conveniência: sem ela o gesto ainda funciona enquanto o
      // dedo estiver sobre o palco. Não pode derrubar o arrasto inteiro.
    }
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebasear(diametroMm);
    setArrastando(true);
  };

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pxPorMm || !ponteiros.current.has(e.pointerId)) return;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const medida = medidaEmPx();
    if (medida == null || !base.current) return;

    const delta = (medida - base.current.medida) / pxPorMm;
    aoDefinirDiametro(
      limitar(base.current.diametro + delta, DIAMETRO_MIN, DIAMETRO_MAX),
    );
  };

  const aoSubir = (e: React.PointerEvent<HTMLDivElement>) => {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size === 0) {
      base.current = null;
      setArrastando(false);
    } else {
      // Soltou um dedo e continuou com o outro: recomeça a contagem para não
      // dar um pulo na medida.
      rebasear(diametroMm);
    }
  };

  // Roda do mouse para ajuste fino. Precisa de listener nativo não passivo,
  // senão a página rola junto.
  useEffect(() => {
    const el = palco.current;
    if (!el || etapa !== "medir" || !pxPorMm) return;

    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      const passo = e.deltaY > 0 ? -0.05 : 0.05;
      aoDefinirDiametro(limitar(diametroMm + passo, DIAMETRO_MIN, DIAMETRO_MAX));
    };

    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  }, [etapa, pxPorMm, diametroMm, aoDefinirDiametro]);

  /* ------------------------------------------------------------ etapas */

  const passo = etapa === "escolha" ? 1 : etapa === "calibrar" ? 2 : 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo de medição do aro"
      // h-dvh em vez de inset-0: em celular a barra do navegador entra e sai, e
      // com bottom:0 o painel de controle fica escondido atrás dela.
      className="palco-noite fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col"
    >
      <div ref={painel} className="flex h-full flex-col">
        {/* Barra superior */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {etapa !== "escolha" ? (
              <button
                type="button"
                onClick={() => setEtapa(etapa === "medir" ? "calibrar" : "escolha")}
                aria-label="Voltar um passo"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#f3ece1]/70 transition-colors hover:bg-white/10 hover:text-[#f3ece1]"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <p className="eyebrow text-brand-light">Passo {passo} de 3</p>
          </div>

          <button
            ref={fechar}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar o modo de medição"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#f3ece1]/70 transition-colors hover:bg-white/10 hover:text-[#f3ece1]"
          >
            <X size={20} />
          </button>
        </div>

        {/* ------------------------------------------------ 1. escolha */}
        {etapa === "escolha" ? (
          <div key="escolha" className="etapa flex flex-1 flex-col justify-center overflow-y-auto px-5 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-2xl">
              <h2 className="font-display text-titulo-secao text-[#f6efe4]">
                Escolha um objeto para calibrar a tela
              </h2>
              <p className="mt-3 max-w-prose text-apoio leading-relaxed text-[#f3ece1]/65">
                Cada tela mostra o mesmo desenho num tamanho diferente. Para a
                medida sair certa, o site precisa aprender a escala real da sua
                tela usando algo que você tem em mãos.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {(["moeda", "cartao"] as ReferenciaId[]).map((id) => {
                  const r = REFERENCIAS[id];
                  const Icone = id === "moeda" ? Coins : CreditCard;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setRefEscolhida(id);
                        setRascunho(pxPorMm ?? 3.8);
                        setEtapa("calibrar");
                      }}
                      className="glass-escuro group rounded-lg p-5 text-left transition-colors hover:border-brand/60 hover:bg-white/[0.09]"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-sm border border-brand/40 bg-brand/15 text-brand-light transition-transform duration-500 group-hover:scale-110">
                        <Icone size={20} aria-hidden />
                      </span>
                      <span className="font-display mt-4 block text-titulo-bloco text-[#f6efe4]">
                        {r.nome}
                      </span>
                      <span className="mt-2 block text-apoio leading-relaxed text-[#f3ece1]/60">
                        {r.dica}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* ---------------------------------------------- 2. calibrar */}
        {etapa === "calibrar" ? (
          <div key="calibrar" className="etapa flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-5 pt-6 text-center sm:px-8">
              <h2 className="font-display text-titulo-secao text-[#f6efe4]">
                Encoste {refEscolhida === "moeda" ? "a moeda" : "o cartão"} na tela
              </h2>
              <p className="mx-auto mt-2 max-w-md text-apoio leading-relaxed text-[#f3ece1]/65">
                Ajuste o desenho até ele ficar exatamente do tamanho{" "}
                {refEscolhida === "moeda" ? "da moeda" : "do cartão"} de verdade,
                encostado na tela.
              </p>
            </div>

            {/* O desenho pode ficar maior que a tela (o cartão tem 85,6 mm).
                Por isso a área rola nos dois eixos em vez de estourar. */}
            {/* Rolagem por fora, centralização por dentro num invólucro que
                nunca fica menor que o desenho (`min-w-max`). Centralizar direto
                no container que rola deixaria a metade esquerda de um desenho
                grande inalcançável. */}
            <div className="flex-1 overflow-auto">
              <div className="flex min-h-full min-w-max items-center justify-center p-5">
                <ObjetoReferencia id={refEscolhida} pxPorMm={rascunho} className="shrink-0" />
              </div>
            </div>

            <div className="shrink-0 border-t border-white/10 px-5 py-5 sm:px-8">
              <div className="mx-auto max-w-md">
                <div className="flex items-center gap-3">
                  <BotaoFino
                    aoClicar={() =>
                      setRascunho((v) => limitar(+(v - 0.02).toFixed(3), PX_POR_MM_MIN, PX_POR_MM_MAX))
                    }
                    rotulo="Diminuir o desenho"
                  >
                    <Minus size={16} />
                  </BotaoFino>

                  <input
                    type="range"
                    min={PX_POR_MM_MIN}
                    max={PX_POR_MM_MAX}
                    step={0.01}
                    value={rascunho}
                    onChange={(e) => setRascunho(Number(e.target.value))}
                    aria-label="Tamanho do desenho na tela"
                    aria-valuetext={`${mm(rascunho)} pixels por milímetro`}
                    className="jk-slider flex-1"
                  />

                  <BotaoFino
                    aoClicar={() =>
                      setRascunho((v) => limitar(+(v + 0.02).toFixed(3), PX_POR_MM_MIN, PX_POR_MM_MAX))
                    }
                    rotulo="Aumentar o desenho"
                  >
                    <Plus size={16} />
                  </BotaoFino>
                </div>

                <p className="numeros mt-3 text-center text-nota text-[#f3ece1]/60">
                  Escala atual: {mm(rascunho)} px por mm
                </p>

                <button
                  type="button"
                  onClick={() => {
                    aoDefinirCalibragem(rascunho, refEscolhida);
                    setEtapa("medir");
                  }}
                  className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-apoio font-semibold text-ink transition-colors hover:bg-brand-light"
                >
                  <Check size={16} aria-hidden /> Está do tamanho certo
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------- 3. medir */}
        {etapa === "medir" && pxPorMm ? (
          <div key="medir" className="etapa flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-5 pt-5 text-center">
              <p className="text-apoio text-[#f3ece1]/65">
                Apoie a aliança na tela e ajuste o anel até encostar por dentro dela.
              </p>
            </div>

            {/* Palco do anel. `touch-action: none` é o que permite arrastar e
                pinçar sem a página tentar rolar junto. */}
            <div
              ref={palco}
              onPointerDown={aoDescer}
              onPointerMove={aoMover}
              onPointerUp={aoSubir}
              onPointerCancel={aoSubir}
              className={`flex flex-1 touch-none items-center justify-center overflow-hidden ${
                arrastando ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <Anel furoPx={diametroMm * pxPorMm} />
            </div>

            <div className="shrink-0 border-t border-white/10 px-5 py-5 sm:px-8">
              <div className="mx-auto max-w-md">
                {/* Resultado. O aria-live é o que faz quem usa leitor de tela
                    saber o aro: antes o número só existia visualmente. */}
                <div className="text-center" aria-live="polite">
                  <p className="eyebrow text-brand-light">Seu aro é</p>
                  <p
                    key={aro}
                    className="font-display troca mt-1 text-display leading-none text-[#f6efe4]"
                  >
                    {aro}
                  </p>
                  <p className="numeros mt-2 text-nota text-[#f3ece1]/55">
                    {mm(diametroMm)} mm de diâmetro interno, {mm(diametroMm * Math.PI, 1)} mm de circunferência
                  </p>
                </div>

                {entreDois ? (
                  <p className="mt-4 rounded-sm border border-brand/30 bg-brand/10 px-4 py-2.5 text-center text-nota leading-relaxed text-brand-light">
                    A medida ficou entre dois tamanhos. Vale escolher o maior,
                    porque a aliança precisa passar pela junta do dedo.
                  </p>
                ) : null}

                <div className="mt-5 flex items-center gap-3">
                  <BotaoFino
                    aoClicar={() =>
                      aoDefinirDiametro(limitar(+(diametroMm - 0.05).toFixed(2), DIAMETRO_MIN, DIAMETRO_MAX))
                    }
                    rotulo="Diminuir o anel"
                  >
                    <Minus size={16} />
                  </BotaoFino>

                  <input
                    type="range"
                    min={DIAMETRO_MIN}
                    max={DIAMETRO_MAX}
                    step={0.01}
                    value={diametroMm}
                    onChange={(e) => aoDefinirDiametro(Number(e.target.value))}
                    aria-label="Diâmetro interno da aliança"
                    aria-valuetext={`Aro ${aro}, ${mm(diametroMm)} milímetros de diâmetro`}
                    className="jk-slider flex-1"
                  />

                  <BotaoFino
                    aoClicar={() =>
                      aoDefinirDiametro(limitar(+(diametroMm + 0.05).toFixed(2), DIAMETRO_MIN, DIAMETRO_MAX))
                    }
                    rotulo="Aumentar o anel"
                  >
                    <Plus size={16} />
                  </BotaoFino>
                </div>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-nota text-[#f3ece1]/60">
                  <Hand size={12} aria-hidden />
                  Arraste o anel, pince com dois dedos ou use o controle
                </p>

                <button
                  type="button"
                  onClick={aoFechar}
                  className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-apoio font-semibold text-ink transition-colors hover:bg-brand-light"
                >
                  <Check size={16} aria-hidden /> Guardar aro {aro}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BotaoFino({
  children,
  aoClicar,
  rotulo,
}: {
  children: React.ReactNode;
  aoClicar: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[#f3ece1] transition-all hover:border-brand hover:bg-brand/20 active:scale-95"
    >
      {children}
    </button>
  );
}
