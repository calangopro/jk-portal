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
   * A orientação sai do TAMANHO DO PALCO, e só dele.
   *
   * Antes ela saía da escala atual: o cartão era preso pela borda esquerda,
   * crescia só para a direita e, quando não cabia mais, GIRAVA 90 graus no meio
   * do ajuste e trocava a referência de 85,6 mm para os 53,98 mm. Quem estava
   * com o cartão de verdade encostado na tela via o desenho fugir para fora e
   * depois virar de lado sozinho. Eram dois defeitos no mesmo gesto.
   *
   * Agora escolhemos de uma vez a orientação que permite o desenho CHEGAR MAIOR
   * dentro deste palco, comparando as duas possibilidades:
   *
   *   deitado: precisa de 85,6 mm na largura e 53,98 mm na altura
   *   em pé:   precisa de 53,98 mm na largura e 85,6 mm na altura
   *
   * Em tela de computador, larga, ganha o deitado. Em celular, alto e estreito,
   * ganha o em pé. É o que a intuição já dizia, mas derivado da medida em vez
   * de um ponto de corte arbitrário de largura.
   *
   * Duas consequências boas. A referência passa a ser SEMPRE a borda de
   * 85,6 mm, nos dois casos, que é a medida longa e portanto a mais precisa:
   * errar um pixel numa borda de 85,6 mm custa menos que na de 53,98 mm. E como
   * isto não depende de `rascunho`, nada gira enquanto a pessoa ajusta.
   */
  const areaCalibragem = useRef<HTMLDivElement>(null);
  const [areaPalco, setAreaPalco] = useState({ largura: 0, altura: 0 });

  useEffect(() => {
    const el = areaCalibragem.current;
    if (!el) return;
    const medir = (w: number, h: number) => setAreaPalco({ largura: w, altura: h });
    medir(el.clientWidth, el.clientHeight);
    const observador = new ResizeObserver(([entrada]) =>
      medir(entrada.contentRect.width, entrada.contentRect.height),
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [etapa]);

  /** Folga para o desenho não morder a borda do palco. Pequena de propósito:
      cada pixel aqui é pixel a menos de escala máxima, e é a escala máxima que
      decide se a pessoa CONSEGUE calibrar nesta tela. */
  const FOLGA = 12;

  const { deitado, escalaMax } = useMemo(() => {
    const larg = Math.max(0, areaPalco.largura - FOLGA * 2);
    const alt = Math.max(0, areaPalco.altura - FOLGA * 2);
    if (!larg || !alt) return { deitado: true, escalaMax: PX_POR_MM_MAX };

    const c = REFERENCIAS.cartao;
    if (refEscolhida === "moeda") {
      // Círculo não tem orientação: cabe pelo menor lado do palco.
      const s = Math.min(larg, alt) / REFERENCIAS.moeda.medidaMm;
      return { deitado: true, escalaMax: Math.min(PX_POR_MM_MAX, s) };
    }

    const sDeitado = Math.min(larg / c.medidaMm, alt / c.alturaMm);
    const sEmPe = Math.min(larg / c.alturaMm, alt / c.medidaMm);
    const escolhido = sDeitado >= sEmPe;
    return {
      deitado: escolhido,
      escalaMax: Math.min(PX_POR_MM_MAX, escolhido ? sDeitado : sEmPe),
    };
  }, [areaPalco, refEscolhida]);

  /**
   * O limite superior do controle acompanha o que CABE no palco.
   *
   * Sem isto, arrastar o controle até o fim empurraria o desenho para fora da
   * tela de novo, que é exatamente o defeito que estamos consertando. O limite
   * de baixo continua fixo: desenho pequeno demais não atrapalha ninguém.
   */
  const escalaTeto = Math.max(PX_POR_MM_MIN + 0.1, +escalaMax.toFixed(3));

  // Se o palco encolher (girar o aparelho, teclado abrir), a escala desce junto
  // em vez de deixar o desenho estourando a borda.
  useEffect(() => {
    setRascunho((v) => (v > escalaTeto ? escalaTeto : v));
  }, [escalaTeto]);

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
          <div key="calibrar" className="etapa relative flex flex-1 flex-col overflow-hidden">
            {/* Véu atrás do texto. Ele flutua sobre o desenho para o palco
                ficar com a altura inteira, e sem o véu a frase some quando cai
                em cima do cartão claro. O gradiente morre antes do meio da
                tela, então a BORDA do desenho, que é o que se compara, nunca
                fica escurecida. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-[9] h-40 bg-gradient-to-b from-[#12100e] via-[#12100e]/85 to-transparent"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-full max-w-3xl px-5 pt-5 text-center sm:px-8">
              <h2 className="font-display text-titulo-bloco text-[#f6efe4]">
                Deixe o desenho do tamanho{" "}
                {refEscolhida === "moeda" ? "da moeda" : "do cartão"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-apoio leading-relaxed text-[#f3ece1]/65">
                {refEscolhida === "moeda"
                  ? "Ponha a moeda em cima do desenho e ajuste até ela cobrir o dourado."
                  : "Ponha o cartão em cima do desenho e ajuste até as bordas baterem."}
              </p>
            </div>

            {/* O desenho fica CENTRADO e cresce por igual para os dois lados.
                Antes ele era preso pela borda esquerda e crescia só para a
                direita: saía do meio da tela conforme a pessoa ajustava, até
                vazar a borda e sumir. E como cresce a partir do centro, o erro
                se divide entre as duas bordas, então um desencontro aparece dos
                dois lados ao mesmo tempo e fica mais fácil de ver do que numa
                borda só.
                Continua sem rolagem: o desenho é posicionado por absoluto, e
                crescer não mexe em layout nenhum. Era a rolagem que fazia a tela
                andar sozinha debaixo da mão com o objeto encostado nela. */}
            <div className="relative flex-1 overflow-hidden">
              <div ref={areaCalibragem} className="relative h-full w-full">
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    // O giro é em torno do CENTRO, então virar o cartão em pé
                    // não tira ele do meio da tela.
                    transform: `translate(-50%, -50%) rotate(${deitado ? 0 : 90}deg)`,
                  }}
                >
                  <ObjetoReferencia id={refEscolhida} pxPorMm={rascunho} />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/10 px-5 py-5 sm:px-8">
              <div className="mx-auto max-w-md">
                <div className="flex items-center gap-3">
                  <BotaoFino
                    aoClicar={() =>
                      setRascunho((v) => limitar(+(v - 0.02).toFixed(3), PX_POR_MM_MIN, escalaTeto))
                    }
                    rotulo="Diminuir o desenho"
                  >
                    <Minus size={16} />
                  </BotaoFino>

                  <input
                    type="range"
                    min={PX_POR_MM_MIN}
                    max={escalaTeto}
                    step={0.01}
                    value={rascunho}
                    onChange={(e) => setRascunho(Number(e.target.value))}
                    aria-label="Tamanho do desenho na tela"
                    aria-valuetext={`${mm(rascunho)} pixels por milímetro`}
                    className="jk-slider flex-1"
                  />

                  <BotaoFino
                    aoClicar={() =>
                      setRascunho((v) => limitar(+(v + 0.02).toFixed(3), PX_POR_MM_MIN, escalaTeto))
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
