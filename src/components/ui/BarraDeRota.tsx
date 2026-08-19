"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Barra fina de progresso no topo, para toda troca de página.
 *
 * O defeito que ela resolve: no App Router o clique num link não muda nada na
 * tela enquanto o servidor não responde. A pessoa clica, olha para uma tela
 * parada, clica de novo, e a página aparece depois. Parece site lento mesmo
 * quando a resposta leva 300 ms.
 *
 * Por que interceptar o clique em vez de usar `useLinkStatus`: aquele hook só
 * enxerga o Link em que ele está montado, então serviria para o item do menu,
 * não para uma barra que vale no site inteiro. Aqui um único ouvinte no
 * documento cobre todo link, inclusive os que estão dentro de artigo.
 *
 * O ouvinte fica na fase de CAPTURA, e isso não é detalhe. O `next/link`
 * chama `preventDefault()` no próprio clique para trocar a página pelo lado do
 * cliente, então na fase de bolha todo link interno chega aqui já com
 * `defaultPrevented`. Escutando assim, a primeira versão nunca desenhou barra
 * nenhuma. Na captura passamos antes do React.
 *
 * O preço da captura é não saber se alguém vai cancelar o clique depois. No
 * projeto nenhum `<a>` faz isso (menu e gaveta são `<button>`, e os
 * `preventDefault` que existem são de teclado), e mesmo se passasse a fazer, a
 * barra some sozinha em `DESISTIR`.
 */

/** Espera antes de desenhar. Navegação que resolve em 90 ms não pisca barra. */
const ATRASO = 90;
/** Rede travada não deixa barra eterna na tela. */
const DESISTIR = 10_000;

export function BarraDeRota() {
  const caminho = usePathname();
  // null = fora da tela. 0 a 1 = quanto da barra está preenchido.
  const [progresso, setProgresso] = useState<number | null>(null);
  const relogios = useRef<number[]>([]);
  const andando = useRef(false);

  const limpar = useCallback(() => {
    for (const id of relogios.current) window.clearTimeout(id);
    relogios.current = [];
  }, []);

  const agendar = useCallback((fn: () => void, ms: number) => {
    relogios.current.push(window.setTimeout(fn, ms));
  }, []);

  /**
   * Começa a andar. A curva é assíntota: cada passo cobre uma fração do que
   * falta para 90%, então a barra nunca chega ao fim sozinha. Barra que enche
   * antes da página promete o que não pode cumprir.
   */
  const comecar = useCallback(() => {
    if (andando.current) return;
    andando.current = true;
    limpar();

    agendar(() => {
      setProgresso(0.08);
      const passo = () => {
        setProgresso((atual) => {
          if (atual === null) return atual;
          return atual + (0.9 - atual) * 0.14;
        });
        agendar(passo, 220);
      };
      agendar(passo, 220);
    }, ATRASO);

    agendar(() => {
      andando.current = false;
      setProgresso(null);
    }, DESISTIR);
  }, [agendar, limpar]);

  /** Fecha a barra: empurra para 100% e some. */
  const terminar = useCallback(() => {
    limpar();
    andando.current = false;
    setProgresso((atual) => (atual === null ? null : 1));
    agendar(() => setProgresso(null), 320);
  }, [agendar, limpar]);

  // A página trocou, então a espera acabou. Vale para clique em link, para
  // voltar do navegador e para `router.push` escrito no código.
  useEffect(() => {
    if (andando.current || progresso !== null) terminar();
    // Só o caminho dispara: `progresso` aqui viraria laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      if (evento.defaultPrevented) return;
      if (evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

      const alvo = (evento.target as Element | null)?.closest?.("a[href]");
      if (!(alvo instanceof HTMLAnchorElement)) return;
      if (alvo.hasAttribute("download")) return;
      if (alvo.target && alvo.target !== "_self") return;

      let destino: URL;
      try {
        destino = new URL(alvo.href);
      } catch {
        return;
      }

      // Outro domínio, `mailto:`, `tel:` e afins: quem desenha o progresso é o
      // navegador, não nós.
      if (destino.origin !== window.location.origin) return;
      if (!/^https?:$/.test(destino.protocol)) return;

      // Âncora dentro da mesma página não é troca de página.
      const mesmoEndereco =
        destino.pathname === window.location.pathname &&
        destino.search === window.location.search;
      if (mesmoEndereco) return;

      comecar();
    };

    // Voltar e avançar do navegador também são espera, mesmo que curta.
    const aoVoltar = () => comecar();

    document.addEventListener("click", aoClicar, true);
    window.addEventListener("popstate", aoVoltar);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener("popstate", aoVoltar);
      limpar();
    };
  }, [comecar, limpar]);

  if (progresso === null) return null;

  return (
    <div className="barra-rota" role="presentation">
      <div
        className="barra-rota-trilho"
        style={{ transform: `scaleX(${progresso})`, opacity: progresso === 1 ? 0 : 1 }}
      />
    </div>
  );
}
