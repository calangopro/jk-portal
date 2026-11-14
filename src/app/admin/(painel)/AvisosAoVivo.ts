"use client";

import { useEffect, useRef, useState } from "react";
import { comBasePath } from "@/lib/seo/base-path";
import { aoAvisar } from "@/lib/time/ao-vivo";
import { tituloComAviso } from "@/lib/time/chat";
import type { Avisos } from "./Navegacao";

/**
 * Os números do menu que precisam andar sozinhos: hoje, o chat do time.
 *
 * O `layout.tsx` do painel NÃO é refeito quando a pessoa troca de tela, então
 * o número que ele mandou fica parado até alguém recarregar. Para comentário
 * de site isso serve; para conversa, não: a mensagem chegou e a pessoa precisa
 * saber sem ir olhar. São dois caminhos, e o segundo cobre o primeiro:
 *
 *   ao vivo  o canal do time avisa que há mensagem nova (ou a tela do chat
 *            avisa que a pessoa leu), e a moldura pergunta o número na hora;
 *   relógio  a cada minuto, com a aba à vista, ela pergunta de novo. É o que
 *            segura o número certo quando o canal ao vivo não entrou.
 *
 * O endereço consultado devolve só contagem, nunca texto de mensagem.
 */

/** A cada quanto a moldura pergunta mesmo sem aviso. Um minuto: leve o bastante para ficar ligado o dia inteiro. */
const INTERVALO = 60_000;
/** Vários avisos seguidos (uma conversa animada) viram uma pergunta só. */
const JUNTAR_AVISOS_MS = 700;

export function useAvisosAoVivo(doServidor: Avisos | undefined, ligado: boolean): Avisos | undefined {
  const [avisos, setAvisos] = useState(doServidor);
  // O que o servidor mandar de novo (depois de uma ação, por exemplo) vale mais do que o que estava na tela.
  useEffect(() => setAvisos(doServidor), [doServidor]);

  const temAvisos = doServidor !== undefined;
  useEffect(() => {
    if (!ligado || !temAvisos) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | null = null;
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
    const logo = () => {
      if (espera) return;
      espera = setTimeout(() => {
        espera = null;
        void perguntar();
      }, JUNTAR_AVISOS_MS);
    };
    const id = setInterval(perguntar, INTERVALO);
    const parar = aoAvisar(logo);
    document.addEventListener("visibilitychange", perguntar);
    return () => {
      vivo = false;
      clearInterval(id);
      if (espera) clearTimeout(espera);
      parar();
      document.removeEventListener("visibilitychange", perguntar);
    };
  }, [ligado, temAvisos]);

  return avisos;
}

/**
 * Põe o número do que espera a pessoa na frente do título da aba: "(3) Chat do
 * time". É como ela vê, de OUTRA aba, que chegou mensagem.
 *
 * O Next troca o título a cada tela, e às vezes depois de a tela já ter
 * aparecido. Por isso, além de aplicar quando o número ou o endereço mudam, um
 * vigia olha o próprio `<title>` e repõe o número quando ele some.
 */
export function useTituloComAviso(avisos: Avisos | undefined, caminho: string) {
  const total = Object.values(avisos ?? {}).reduce((n, v) => n + (v > 0 ? v : 0), 0);
  const atual = useRef(total);
  atual.current = total;
  useEffect(() => {
    const aplicar = () => {
      const certo = tituloComAviso(document.title, atual.current);
      if (document.title !== certo) document.title = certo;
    };
    aplicar();
    if (typeof MutationObserver === "undefined") return;
    const vigia = new MutationObserver(aplicar);
    vigia.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => vigia.disconnect();
  }, [total, caminho]);
  // Ao sair do painel (para o login), o título volta a ser o da página.
  useEffect(() => () => {
    document.title = tituloComAviso(document.title, 0);
  }, []);
}
