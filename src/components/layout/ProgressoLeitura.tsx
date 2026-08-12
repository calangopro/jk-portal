"use client";

import { useEffect, useState } from "react";

/**
 * Filete de progresso da leitura, grudado na base do cabeçalho.
 *
 * Só entra nas páginas de artigo. É um sinal pequeno, mas é dos que fazem um
 * site parecer publicação em vez de página solta.
 */
export function ProgressoLeitura() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let quadro = 0;

    const medir = () => {
      quadro = 0;
      const alturaRolavel =
        document.documentElement.scrollHeight - window.innerHeight;
      if (alturaRolavel <= 0) {
        setPct(0);
        return;
      }
      setPct(Math.min(100, Math.max(0, (window.scrollY / alturaRolavel) * 100)));
    };

    const aoRolar = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);

    return () => {
      if (quadro) cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-brand-light to-brand"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
