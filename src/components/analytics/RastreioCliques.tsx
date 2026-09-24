"use client";

import { useEffect } from "react";
import { semBasePath } from "@/lib/seo/base-path";
import { registrarEvento } from "@/lib/analytics/eventos";

/**
 * Parte da página onde o clique aconteceu. Substitui o `utm_medium` que os
 * links para a loja carregavam (cabecalho, rodape...), sem mexer na origem da
 * sessão.
 *
 * Lê `data-regiao`, posto no cabeçalho e no rodapé do SITE, e não a tag
 * `<header>`: a capa do guia e a página de loja também usam `<header>`, e o
 * botão de WhatsApp no topo de uma loja não é clique no cabeçalho do site.
 */
function posicaoDo(alvo: HTMLElement): string {
  return alvo.closest<HTMLElement>("[data-regiao]")?.dataset.regiao ?? "conteudo";
}

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

      registrarEvento(evento, {
        destino: alvo.dataset.produtoNome ?? alvo.dataset.destino ?? null,
        url: alvo.getAttribute("href"),
        posicao: posicaoDo(alvo),
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
