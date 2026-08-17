"use client";

import { useEffect } from "react";
import { semBasePath } from "@/lib/seo/base-path";

/**
 * Rastreia cliques que importam para o negócio, sem precisar de código em cada
 * botão. Basta o elemento ter data-evento, e o card de produto já tem.
 *
 * Escuta um único clique na página inteira, então não pesa e continua
 * funcionando para conteúdo inserido depois.
 */
export function RastreioCliques() {
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const alvo = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-evento]");
      if (!alvo) return;

      const evento = alvo.dataset.evento;
      if (!evento) return;

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: evento,
        destino: alvo.dataset.produtoNome ?? alvo.dataset.destino ?? null,
        url: alvo.getAttribute("href"),
        // Sem o prefixo, para a origem do clique continuar comparável com o
        // caminho das rotas e com o que já foi medido antes do /guias.
        origem: semBasePath(window.location.pathname),
      });
    };

    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);

  return null;
}
