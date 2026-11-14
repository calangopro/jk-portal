"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { comBasePath } from "@/lib/seo/base-path";
import { aoAvisar, avisarAqui, pegarCliente } from "./ao-vivo";
import { avisosDoSistema, estadoDoAviso, lerParaAvisar, type AvisoDoSistema, type EstadoDoAviso } from "./chat";

/**
 * O aviso do sistema do chat: a notificação do computador quando chega
 * mensagem e o painel está em segundo plano.
 *
 * É ESCOLHA DE CADA PESSOA, EM CADA NAVEGADOR. O navegador só deixa pedir a
 * permissão a partir de um clique, e a escolha fica guardada nele
 * (`localStorage`), junto da permissão, que também é dele. Quem liga no
 * computador da loja não liga no de casa.
 *
 * SÓ FUNCIONA COM O PAINEL ABERTO EM ALGUMA ABA. Aviso com o navegador
 * fechado pede um service worker, e o painel não tem um de propósito (guardar
 * página de um painel de faturamento é receita para número velho). No iPhone
 * o navegador não mostra aviso de site, e no Android ele só mostra por service
 * worker: nos dois a tela diz que não há suporte.
 *
 * O QUE VIRA AVISO é decisão do banco (`chat_para_avisar`, 0081), pela mesma
 * régua do número do menu: a sala geral, as salas do setor da pessoa e
 * resposta a ela. O canal ao vivo só diz "há novidade"; o texto do aviso vem
 * dessa função, que confere o acesso.
 *
 * SÓ AVISA DO QUE CHEGOU DEPOIS QUE A PESSOA SAIU. Ao perder o foco, a tela
 * marca como já visto o que existia; a mensagem das 10h, que ela viu no
 * número do menu, não vira aviso às 10h05 quando chega outra.
 */

const CHAVE = "jk:chat:aviso";
const ICONE = comBasePath("/painel-icone-192.png");

const ouvintes = new Set<() => void>();
/** A tentativa de mostrar um aviso falhou neste aparelho (é o caso do Android, que só aceita aviso por service worker). */
let semSuporteAqui = false;

const emitir = () => ouvintes.forEach((f) => f());

function permissao(): NotificationPermission | null {
  return typeof Notification === "undefined" ? null : Notification.permission;
}

function escolheuLigar(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function guardar(valor: "1" | "0") {
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    // Navegador sem armazenamento: a escolha vale só até recarregar.
  }
}

function ler(): EstadoDoAviso {
  return semSuporteAqui ? "sem_suporte" : estadoDoAviso(permissao(), escolheuLigar());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  // Outra aba do painel ligou ou desligou o aviso: esta acompanha.
  window.addEventListener("storage", f);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", f);
  };
}

/**
 * Liga o aviso: pede a permissão ao navegador (se ainda não foi dada) e mostra
 * um aviso de exemplo, que é também o teste de que este aparelho consegue
 * mostrar. Precisa ser chamado a partir de um clique.
 */
export async function ligarAviso(): Promise<EstadoDoAviso> {
  if (typeof Notification === "undefined") return ler();
  let dada = Notification.permission;
  if (dada === "default") {
    try {
      dada = await Notification.requestPermission();
    } catch {
      dada = Notification.permission;
    }
  }
  if (dada === "granted") {
    try {
      const exemplo = new Notification("Aviso do chat ligado", {
        body: "É assim que a mensagem nova aparece quando o painel estiver em segundo plano.",
        tag: "jk-chat-exemplo",
        icon: ICONE,
        lang: "pt-BR",
      });
      setTimeout(() => exemplo.close(), 7000);
      guardar("1");
    } catch {
      semSuporteAqui = true;
    }
  }
  emitir();
  return ler();
}

export function desligarAviso() {
  guardar("0");
  emitir();
}

/** O estado do aviso neste navegador, para desenhar o botão. No servidor é "sem suporte": o botão só aparece depois que o navegador responde. */
export function useAvisoDoSistema(): EstadoDoAviso {
  return useSyncExternalStore(assinar, ler, () => "sem_suporte" as const);
}

const emSegundoPlano = () => document.visibilityState !== "visible" || !document.hasFocus();

/**
 * Mostra o aviso do sistema quando chega mensagem para a pessoa e o painel
 * está em segundo plano. A moldura do painel liga isto em toda tela.
 *
 * `noChat`: a tela aberta é a do chat. Aí o clique no aviso leva até a
 * mensagem sem trocar de página.
 */
export function useNotificarMensagens(ligado: boolean, noChat: boolean) {
  const router = useRouter();
  const estado = useAvisoDoSistema();
  const estouNoChat = useRef(noChat);
  estouNoChat.current = noChat;

  useEffect(() => {
    if (!ligado || estado !== "ligado") return;
    let vivo = true;
    let desde: string | null = null;
    const avisadas = new Set<number>();
    let ocupado = false;
    let pedidoNaFila = false;
    let espera: ReturnType<typeof setTimeout> | null = null;

    const mostrar = (a: AvisoDoSistema) => {
      try {
        const n = new Notification(a.titulo, { body: a.corpo, tag: a.marca, icon: ICONE, lang: "pt-BR" });
        n.onclick = () => {
          try {
            window.focus();
          } catch {
            // Alguns navegadores não deixam a página se pôr na frente: a pessoa clica na aba.
          }
          n.close();
          if (estouNoChat.current) avisarAqui({ tipo: "abrir", sala: a.sala, mensagem: a.mensagem });
          else router.push(`/admin/chat?sala=${a.sala}&m=${a.mensagem}`);
        };
      } catch {
        semSuporteAqui = true;
        emitir();
      }
    };

    /**
     * Pergunta ao banco o que chegou para a pessoa desde a última pergunta.
     * `avisar` falso é a marcação feita ao sair de cena: anota o que já existe
     * como visto, sem mostrar nada.
     */
    const conferir = async (avisar: boolean) => {
      if (ocupado) {
        pedidoNaFila = pedidoNaFila || avisar;
        return;
      }
      ocupado = true;
      try {
        const db = await pegarCliente();
        const { data, error } = await db.rpc("chat_para_avisar", { p_desde: desde });
        if (error || !vivo) return;
        const r = lerParaAvisar(data);
        if (r.agora) desde = r.agora;
        const novas = r.mensagens.filter((m) => !avisadas.has(m.id));
        novas.forEach((m) => avisadas.add(m.id));
        // Confere de novo na hora de mostrar: a pessoa pode ter voltado enquanto o banco respondia.
        if (avisar && emSegundoPlano()) avisosDoSistema(novas).forEach(mostrar);
      } catch {
        // Sem rede: o próximo aviso do canal, ou a volta do relógio, tenta de novo.
      } finally {
        ocupado = false;
        if (pedidoNaFila && vivo) {
          pedidoNaFila = false;
          void conferir(true);
        }
      }
    };

    // Uma conversa animada manda vários avisos seguidos: vira uma pergunta só.
    const logo = () => {
      if (espera || !emSegundoPlano()) return;
      espera = setTimeout(() => {
        espera = null;
        void conferir(true);
      }, 400);
    };

    const pararDeOuvir = aoAvisar((a) => {
      if (a.tipo === "mensagem" || a.tipo === "voltou") logo();
    });
    // Ao sair de cena, o que já existe fica marcado como visto.
    const aoSair = () => {
      if (emSegundoPlano()) void conferir(false);
    };
    document.addEventListener("visibilitychange", aoSair);
    window.addEventListener("blur", aoSair);
    // O relógio cobre o aviso que o canal perdeu (ou o canal que não entrou). Em segundo plano o navegador já segura isto em uma vez por minuto.
    const relogio = setInterval(() => {
      if (emSegundoPlano()) void conferir(true);
    }, 60_000);

    return () => {
      vivo = false;
      pararDeOuvir();
      document.removeEventListener("visibilitychange", aoSair);
      window.removeEventListener("blur", aoSair);
      clearInterval(relogio);
      if (espera) clearTimeout(espera);
    };
  }, [ligado, estado, router]);
}
