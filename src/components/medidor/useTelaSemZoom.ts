"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Trava o zoom da página enquanto o modo de medição está aberto.
 *
 * O medidor desenha em tamanho real, e zoom de qualquer tipo muda o tamanho do
 * desenho sem mudar a conta. No celular isso acontecia sozinho: os dedos que
 * seguram o cartão em cima da tela viravam pinça ou toque duplo, o navegador
 * ampliava a página e a calibração saía errada, com o desenho fugindo para fora.
 *
 * Nenhuma trava sozinha vale para iPhone e Android, então são quatro camadas:
 *
 *   1. `touch-action: none` no modal (quem aplica é o componente). É a trava
 *      padrão, vale para Chrome, Firefox e Safari a partir do iOS 13, e corta
 *      pinça e toque duplo.
 *   2. Meta viewport com `maximum-scale=1` e `user-scalable=no`. O Chrome do
 *      Android obedece, e ao receber o valor novo ainda desfaz um zoom que já
 *      existisse antes de o modal abrir. O Safari ignora `user-scalable` desde
 *      o iOS 10, por isso a camada seguinte.
 *   3. `gesturestart` e companhia cancelados, que é o gesto de pinça do Safari
 *      (no iPhone e no trackpad do Mac), mais qualquer `touchmove` com dois
 *      dedos. O Chrome no computador faz pinça de trackpad como roda com Ctrl,
 *      e essa também é cancelada.
 *   4. Vigia do `visualViewport`. Se mesmo assim a tela estiver ampliada, o
 *      hook devolve onde ela está, para o modal avisar e LIBERAR a pinça: com
 *      tudo travado, quem entrou com zoom não teria como sair dele.
 *
 * Travar zoom é ruim para acessibilidade, e por isso vale só enquanto o modal
 * está aberto. O resto da página continua ampliável.
 */

const VIEWPORT_TRAVADO =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

/** Pedaço da página que está na tela quando há zoom, em px da página. */
export type Visor = { x: number; y: number; largura: number; escala: number };

export function useTelaSemZoom(): Visor | null {
  const [ampliado, setAmpliado] = useState<Visor | null>(null);
  // Os ouvintes leem daqui, e não do estado, para não serem trocados a cada
  // rolagem de uma tela ampliada.
  const liberado = useRef(false);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const original = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", VIEWPORT_TRAVADO);

    const barrarGesto = (e: Event) => {
      if (!liberado.current) e.preventDefault();
    };
    const barrarPinca = (e: TouchEvent) => {
      if (!liberado.current && e.touches.length > 1) e.preventDefault();
    };
    const barrarRoda = (e: WheelEvent) => {
      if (!liberado.current && e.ctrlKey) e.preventDefault();
    };

    const gestos = ["gesturestart", "gesturechange", "gestureend"];
    // Precisa ser não passivo, senão o `preventDefault` é ignorado.
    const opcoes = { passive: false } as const;
    for (const tipo of gestos) document.addEventListener(tipo, barrarGesto, opcoes);
    document.addEventListener("touchmove", barrarPinca, opcoes);
    document.addEventListener("wheel", barrarRoda, opcoes);

    const vv = window.visualViewport;
    const conferir = () => {
      if (!vv) return;
      const fora = vv.scale > 1.02;
      liberado.current = fora;
      setAmpliado(
        fora ? { x: vv.offsetLeft, y: vv.offsetTop, largura: vv.width, escala: vv.scale } : null,
      );
    };
    vv?.addEventListener("resize", conferir);
    vv?.addEventListener("scroll", conferir);
    // A primeira conferência espera o navegador aplicar o viewport novo. Sem a
    // espera, quem abria com zoom via o aviso piscar no instante em que o
    // Android já estava desfazendo o zoom sozinho.
    const primeira = window.setTimeout(conferir, 300);

    return () => {
      window.clearTimeout(primeira);
      vv?.removeEventListener("resize", conferir);
      vv?.removeEventListener("scroll", conferir);
      for (const tipo of gestos) document.removeEventListener(tipo, barrarGesto);
      document.removeEventListener("touchmove", barrarPinca);
      document.removeEventListener("wheel", barrarRoda);
      if (meta && original != null) meta.setAttribute("content", original);
    };
  }, []);

  return ampliado;
}
