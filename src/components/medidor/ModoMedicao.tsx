"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Minus,
  Plus,
  Check,
  ArrowLeft,
  Hand,
  Coins,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { Disco } from "./Disco";
import { ComoApoiar } from "./ComoApoiar";
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
  jaMediu = false,
  etapaInicial,
  aoDefinirCalibragem,
  aoDefinirDiametro,
  aoFechar,
}: {
  pxPorMm: number | null;
  referencia: ReferenciaId;
  diametroMm: number;
  /** Quem já mediu antes entra com a instrução recolhida. */
  jaMediu?: boolean;
  /** Força o passo de entrada. É o que faz o atalho de recalibrar cair na
      escolha do objeto em vez de na régua. */
  etapaInicial?: Etapa;
  aoDefinirCalibragem: (px: number, ref: ReferenciaId) => void;
  aoDefinirDiametro: (mm: number) => void;
  aoFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial ?? (pxPorMm ? "medir" : "escolha"));
  const [refEscolhida, setRefEscolhida] = useState<ReferenciaId>(referencia);
  const [rascunho, setRascunho] = useState(pxPorMm ?? 3.8);
  const [dica, setDica] = useState(!jaMediu);

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
    // Começou a ajustar: a instrução já foi lida e vira uma linha só, para o
    // anel ficar com a tela inteira.
    setDica(false);
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

  /* --------------------------------------------- orientação do cartão */

  /**
   * O cartão tem 85,6 mm de largura e a tela de um celular tem cerca de 70 mm.
   * Deitado, ele nunca cabe, e era exatamente por isso que esta etapa rolava de
   * lado. Rolar não resolvia nada: ninguém alinha uma borda que está fora da
   * tela. Quando não cabe, o desenho fica EM PÉ e a calibração passa a ser pela
   * borda menor do cartão, os 53,98 mm do mesmo padrão internacional. A conta
   * continua exata, e o gesto volta a ser possível com uma mão só.
   */
  const areaCalibragem = useRef<HTMLDivElement>(null);
  const [larguraDaArea, setLarguraDaArea] = useState(0);

  // Ao trocar de objeto, a próxima âncora se centra pela escala atual.
  useEffect(() => {
    escalaAoAncorar.current = rascunho;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refEscolhida]);

  useEffect(() => {
    const el = areaCalibragem.current;
    if (!el) return;
    setLarguraDaArea(el.clientWidth);
    const observador = new ResizeObserver(([entrada]) =>
      setLarguraDaArea(entrada.contentRect.width),
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [etapa]);

  const ANCORA_MINIMA = 20;
  const emPe =
    refEscolhida === "cartao" &&
    larguraDaArea > 0 &&
    REFERENCIAS.cartao.medidaMm * rascunho > larguraDaArea - ANCORA_MINIMA - 8;

  /**
   * Onde a borda esquerda do desenho fica presa.
   *
   * Duas exigências que brigam: a âncora não pode se mexer enquanto a pessoa
   * ajusta (foi o que fazia a tela fugir debaixo da mão), e o desenho não pode
   * nascer torto no canto esquerdo de uma tela larga. A saída é congelar a
   * âncora no ponto que CENTRALIZA o objeto na escala em que a etapa abriu.
   * Depois disso ela não se mexe mais: cresce só para a direita, a partir de um
   * desenho que começou no meio da tela.
   */
  const escalaAoAncorar = useRef(rascunho);
  const ancoraX = useMemo(() => {
    const objetoMm = emPe
      ? REFERENCIAS.cartao.alturaMm
      : REFERENCIAS[refEscolhida].medidaMm;
    const largura = objetoMm * escalaAoAncorar.current;
    return Math.max(ANCORA_MINIMA, Math.round((larguraDaArea - largura) / 2));
    // De propósito sem `rascunho`: é justamente o que não pode mover a âncora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refEscolhida, larguraDaArea, emPe]);

  /* ------------------------------------------------------------ etapas */

  const passo = etapa === "escolha" ? 1 : etapa === "calibrar" ? 2 : 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo de medição do aro"
      // h-dvh em vez de inset-0: em celular a barra do navegador entra e sai, e
      // com bottom:0 o painel de controle fica escondido atrás dela.
      className="palco-noite fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col overflow-hidden overscroll-contain"
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
            <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pt-6 text-center sm:px-8">
              <h2 className="font-display text-titulo-secao text-[#f6efe4]">
                Encoste {refEscolhida === "moeda" ? "a moeda" : "o cartão"} na tela
              </h2>
              <p className="mx-auto mt-2 max-w-md text-apoio leading-relaxed text-[#f3ece1]/65">
                {refEscolhida === "moeda" ? (
                  <>
                    Encoste a moeda no filete dourado, pela esquerda, e ajuste o
                    desenho até o outro lado bater com a moeda de verdade.
                  </>
                ) : emPe ? (
                  <>
                    O cartão não cabe deitado nesta tela, então ele entra{" "}
                    <strong className="font-semibold text-[#f6efe4]">em pé</strong>:
                    encoste a borda esquerda dele no filete dourado, também em
                    pé, e ajuste até a borda direita do desenho bater com a do
                    cartão.
                  </>
                ) : (
                  <>
                    Encoste a borda esquerda do cartão no filete dourado e
                    ajuste o desenho até o outro lado bater com o cartão de
                    verdade.
                  </>
                )}
              </p>
            </div>

            {/* Âncora fixa, sem nenhuma rolagem.
                Antes esta área rolava nos dois eixos para caber o cartão de
                85,6 mm. O efeito colateral era pior que o problema: a cada
                toque no controle o desenho crescia, o container recalculava a
                rolagem e a tela andava sozinha debaixo da mão, com o objeto
                real encostado nela. Agora o desenho é posicionado por absoluto,
                preso pela borda esquerda: crescer não mexe em layout nenhum,
                então não há o que rolar. A pessoa encosta a borda esquerda do
                objeto no filete dourado e estica até a direita bater. */}
            <div className="relative flex-1 overflow-hidden">
              <div ref={areaCalibragem} className="relative h-full w-full">
                {/* O filete é a marca de encostar: fica onde a borda esquerda
                    do desenho começou, no meio da tela. */}
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-brand/70 to-transparent"
                  style={{ left: ancoraX }}
                />
                <span
                  className="eyebrow absolute top-2 text-[0.62rem] text-brand-light/70"
                  style={{ left: ancoraX + 8 }}
                >
                  encoste aqui
                </span>

                {emPe ? (
                  // Em pé, o giro é do desenho, não do layout: a borda esquerda
                  // fica presa no mesmo eixo e o cartão desce pela tela.
                  <div
                    className="absolute top-10 origin-top-left"
                    style={{
                      left: ancoraX,
                      transform: `translateX(${REFERENCIAS.cartao.alturaMm * rascunho}px) rotate(90deg)`,
                    }}
                  >
                    <ObjetoReferencia id={refEscolhida} pxPorMm={rascunho} />
                  </div>
                ) : (
                  <div
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: ancoraX }}
                  >
                    <ObjetoReferencia id={refEscolhida} pxPorMm={rascunho} />
                  </div>
                )}
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
          <div key="medir" className="etapa relative flex-1 overflow-hidden">
            {/* Palco do disco, ocupando a etapa INTEIRA.
                `touch-action: none` é o que permite arrastar e pinçar sem a
                página tentar rolar junto.

                O centro do disco é uma fração da altura da etapa, e a etapa não
                muda de altura nunca. Antes o palco era `flex-1` e o painel de
                resultado ficava no fluxo: quando o aviso de "entre dois
                tamanhos" aparecia, o painel crescia, o palco encolhia e o disco
                subia sozinho no meio da medição. Painel e instrução agora
                flutuam POR CIMA, então nada mais empurra o desenho. */}
            <div
              ref={palco}
              onPointerDown={aoDescer}
              onPointerMove={aoMover}
              onPointerUp={aoSubir}
              onPointerCancel={aoSubir}
              className={`absolute inset-0 touch-none ${
                arrastando ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
                <Disco furoPx={diametroMm * pxPorMm} />
              </div>
            </div>

            {/* Instrução do gesto, FLUTUANDO sobre o palco. Aberta para quem
                chega pela primeira vez, recolhida em uma linha depois, e o
                palco continua inteiro nos dois casos. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-4 sm:px-8">
                <div
                  // O toque na instrução não pode virar arrasto do disco.
                  onPointerDown={(e) => e.stopPropagation()}
                  // Fundo quase opaco, e não vidro: o disco passa por trás
                  // dela, e vidro transparente deixava desenho em cima de
                  // desenho.
                  className="pointer-events-auto mx-auto max-w-md rounded-md border border-white/12 bg-[#171410]/95 p-3 shadow-[var(--jk-sombra-modal)] backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={() => setDica((v) => !v)}
                    aria-expanded={dica}
                    className="flex w-full items-center justify-between gap-3 rounded-sm px-1 text-left text-apoio text-[#f3ece1]/85 transition-colors hover:text-[#f6efe4]"
                  >
                    <span>
                      Aliança{" "}
                      <strong className="font-semibold text-[#f6efe4]">
                        deitada em cima da tela
                      </strong>
                      , aumente o dourado até tocar nela
                    </span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={`shrink-0 text-brand-light transition-transform duration-300 ${
                        dica ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {dica ? (
                    <div className="etapa mt-3 border-t border-white/10 px-1 pt-3">
                      <ComoApoiar />
                    </div>
                  ) : null}
                </div>
              </div>

            {/* Painel de resultado, também flutuando. Ele cresce quando o aviso
                de "entre dois tamanhos" aparece, e crescer para CIMA não move o
                disco. */}
            <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#14120f]/95 px-5 py-5 backdrop-blur-md sm:px-8">
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
                    rotulo="Diminuir o círculo dourado"
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
                    rotulo="Aumentar o círculo dourado"
                  >
                    <Plus size={16} />
                  </BotaoFino>
                </div>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-nota text-[#f3ece1]/60">
                  <Hand size={12} aria-hidden />
                  Arraste o dourado, pince com dois dedos ou use o controle
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
