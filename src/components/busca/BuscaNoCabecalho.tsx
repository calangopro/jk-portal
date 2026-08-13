"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CampoDeBusca } from "./CampoDeBusca";

/**
 * Busca compacta no cabeçalho.
 *
 * Some na home enquanto o hero está visível, e aparece depois que a pessoa
 * rola. Duas buscas na mesma tela, uma grande e uma pequena a três centímetros
 * dela, é ruído: a pessoa hesita sobre qual usar. Fora da home ela fica sempre
 * disponível, que era o pedido: quem está lendo um guia precisa poder buscar de
 * onde está, sem voltar ao início.
 */
export function BuscaNoCabecalho() {
  const caminho = usePathname();
  const naHome = caminho === "/";
  const [passouDoHero, setPassouDoHero] = useState(false);

  useEffect(() => {
    if (!naHome) return;

    // rAF para não recalcular a cada evento de rolagem, que é o que faz o
    // cabeçalho engasgar em celular mais fraco.
    let agendado = false;
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => {
        setPassouDoHero(window.scrollY > 420);
        agendado = false;
      });
    };

    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, [naHome]);

  const visivel = !naHome || passouDoHero;

  return (
    <div
      // `aria-hidden` junto do `invisible` para o leitor de tela não anunciar um
      // campo que ninguém enxerga nem consegue focar.
      aria-hidden={!visivel}
      className={`hidden min-w-0 max-w-sm flex-1 transition-opacity duration-300 sm:block ${
        visivel ? "opacity-100" : "pointer-events-none invisible opacity-0"
      }`}
    >
      <CampoDeBusca compacto placeholder="Buscar no portal" />
    </div>
  );
}
