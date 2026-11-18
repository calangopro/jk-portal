"use client";

import { useEffect, useState } from "react";
import { comBasePath } from "@/lib/seo/base-path";
import type { Avisos } from "./Navegacao";

/**
 * As contagens do menu: números que aparecem no item sem serem AVISO. Hoje, as
 * oportunidades de venda abertas (para quem vende) e as sugestões de melhoria
 * novas (para a diretoria).
 *
 * A diferença para `AvisosAoVivo` é o que se faz com o número. Aviso (mensagem
 * do chat, caso de suporte) vai para o título da aba e para o botão flutuante,
 * porque alguém está esperando a pessoa. Contagem só aparece no menu: sete
 * oportunidades abertas o dia inteiro no título da aba enterrariam o aviso de
 * mensagem nova, que é o que ele existe para mostrar.
 *
 * A moldura pergunta ao abrir, de dez em dez minutos e quando a própria tela
 * avisa que o número mudou (alguém marcou "Já falei"). A conta é pesada para o
 * banco, e por isso não anda no relógio de um minuto dos avisos.
 */
const INTERVALO = 10 * 60_000;
const EVENTO = "jk:contagens-do-menu";

/** Quem muda o número (marcar uma oportunidade, por exemplo) chama isto, e a moldura pergunta de novo na hora. */
export function avisarQueAsContagensMudaram() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

export function useContagensDoMenu(ligado: boolean): Avisos | undefined {
  const [contagens, setContagens] = useState<Avisos | undefined>(undefined);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    let ultima = 0;
    const perguntar = async (semGuardado: boolean) => {
      if (document.visibilityState !== "visible") return;
      ultima = Date.now();
      try {
        // `fetch` escrito por extenso não recebe o prefixo do site sozinho. Depois de uma marcação, a resposta guardada no navegador não serve.
        const r = await fetch(comBasePath("/api/painel/contagens"), { cache: semGuardado ? "reload" : "default", credentials: "same-origin" });
        if (!r.ok) return;
        const d = (await r.json()) as { contagens?: Avisos | null };
        if (vivo && d.contagens && typeof d.contagens === "object") setContagens(d.contagens);
      } catch {
        // Sem rede: fica o último número. A próxima volta tenta de novo.
      }
    };
    void perguntar(false);
    const id = setInterval(() => void perguntar(false), INTERVALO);
    const aoVoltar = () => {
      if (Date.now() - ultima > INTERVALO) void perguntar(false);
    };
    const aoMudar = () => void perguntar(true);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO, aoMudar);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO, aoMudar);
    };
  }, [ligado]);
  return contagens;
}
