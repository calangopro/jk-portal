"use client";

import { useEffect, useState } from "react";
import { comBasePath } from "@/lib/seo/base-path";
import type { Avisos } from "./Navegacao";

/**
 * Os números do menu que precisam andar sozinhos: hoje, os chamados.
 *
 * O `layout.tsx` do painel NÃO é refeito quando a pessoa troca de tela, então
 * o número que ele mandou fica parado até alguém recarregar. Para comentário
 * de site isso serve; para chamado, não: a resposta chegou e a pessoa precisa
 * saber sem ir olhar. Por isso a moldura pergunta de novo ao servidor a cada
 * minuto, só com a aba à vista, num endereço que devolve dois números e nada
 * mais.
 */

/** A cada quanto a moldura pergunta. Um minuto: rápido o bastante para uma resposta, leve o bastante para ficar ligado o dia inteiro. */
const INTERVALO = 60_000;

export function useAvisosAoVivo(doServidor: Avisos | undefined, ligado: boolean): Avisos | undefined {
  const [avisos, setAvisos] = useState(doServidor);
  // O que o servidor mandar de novo (depois de uma ação, por exemplo) vale mais do que o que estava na tela.
  useEffect(() => setAvisos(doServidor), [doServidor]);

  const temAvisos = doServidor !== undefined;
  useEffect(() => {
    if (!ligado || !temAvisos) return;
    let vivo = true;
    const perguntar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        // `fetch` escrito por extenso não recebe o prefixo do site sozinho.
        const r = await fetch(comBasePath("/api/painel/avisos"), { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) return;
        const d = (await r.json()) as { avisos?: Avisos };
        if (vivo && d.avisos && typeof d.avisos === "object") setAvisos(d.avisos);
      } catch {
        // Sem rede: fica o último número. A próxima volta tenta de novo.
      }
    };
    const id = setInterval(perguntar, INTERVALO);
    document.addEventListener("visibilitychange", perguntar);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", perguntar);
    };
  }, [ligado, temAvisos]);

  return avisos;
}
