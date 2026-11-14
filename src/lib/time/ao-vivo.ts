"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { lerPresenca, type Presenca } from "./chat";

/**
 * A ligação ao vivo do painel: quem está online e o aviso de mensagem nova.
 *
 * É UM canal do Realtime do Supabase, `painel:time`, PRIVADO: só entra quem
 * tem a área `time`, e quem confere é o banco (as duas policies de
 * `realtime.messages` na 0079). Pelo canal passam duas coisas, e nenhuma é
 * texto de conversa:
 *
 *   presença  cada aba aberta diz "estou aqui" com o id da pessoa e se a aba
 *             está à vista. O NOME não vai: vem da lista que o banco entrega.
 *   aviso     quem manda uma mensagem avisa "há novidade na sala tal". Quem
 *             recebe o aviso busca a mensagem no banco, pela função que
 *             confere o acesso. Aviso forjado só causa uma busca à toa.
 *
 * A LIGAÇÃO É ACELERADOR, NÃO ALICERCE. Se o canal não entrar (rede do
 * escritório que barra websocket, sessão vencida), o chat continua
 * funcionando por consulta de tempos em tempos e a tela diz que está assim. É
 * por isso que nada aqui lança erro.
 *
 * A moldura do painel liga isto em todas as telas (`useAoVivo`), e não só no
 * chat: "online" quer dizer "com o painel aberto", e o número do menu anda na
 * hora em que a mensagem chega.
 *
 * Por estar em toda tela, o cliente do Supabase NÃO é importado no topo do
 * arquivo: é buscado só quando a ligação começa (`pegarCliente`), depois de a
 * tela já estar de pé. Importado no topo, ele entraria no primeiro pacote de
 * todas as telas do painel, inclusive das que nunca falam com o navegador.
 */

export const CANAL_DO_TIME = "painel:time";
const EVENTO = "chat";

export type EstadoDaLigacao = "desligada" | "ligando" | "ao_vivo" | "fora";

export type Ligacao = { estado: EstadoDaLigacao; presenca: ReadonlyMap<string, Presenca> };

export type Aviso =
  /** Alguém mandou ou mudou uma mensagem. */
  | { tipo: "mensagem"; sala: string | null }
  /** O canal entrou (ou voltou depois de cair): pode ter passado coisa sem aviso. */
  | { tipo: "voltou" }
  /** Esta aba leu mensagens: o número do menu precisa ser refeito. Não sai da aba. */
  | { tipo: "lida" };

const SEM_NINGUEM: ReadonlyMap<string, Presenca> = new Map();
const DESLIGADA: Ligacao = { estado: "desligada", presenca: SEM_NINGUEM };

let ligacao: Ligacao = DESLIGADA;
let cliente: SupabaseClient | null = null;
let canal: RealtimeChannel | null = null;
let quem: string | null = null;
let usos = 0;
let despedida: ReturnType<typeof setTimeout> | null = null;

/**
 * Por quanto tempo uma falha ao entrar ainda conta como "ligando". A primeira
 * ligação depois de um tempo sem ninguém acorda o serviço do outro lado, e a
 * entrada costuma falhar uma vez antes de dar certo (visto em 14/11: "sem
 * ligação" aos 6 segundos, "ao vivo" logo depois, sem ninguém mexer). Dizer
 * "sem ligação ao vivo" nesse intervalo seria alarme falso. Depois de ter
 * entrado uma vez, queda é queda, na hora.
 */
const PACIENCIA_MS = 15_000;
let comecouEm = 0;
let jaEntrou = false;
let paciencia: ReturnType<typeof setTimeout> | null = null;
const ouvintesDaLigacao = new Set<() => void>();
const ouvintesDeAviso = new Set<(a: Aviso) => void>();

function mudar(parte: Partial<Ligacao>) {
  ligacao = { ...ligacao, ...parte };
  ouvintesDaLigacao.forEach((f) => f());
}

/** Entrega um aviso a quem está ouvindo NESTA aba. Não vai para o canal. */
export function avisarAqui(a: Aviso) {
  ouvintesDeAviso.forEach((f) => {
    try {
      f(a);
    } catch {
      // Um ouvinte com erro não cala os outros.
    }
  });
}

/** Ouve os avisos: mensagem nova no time, canal de volta, leitura feita nesta aba. Devolve como parar de ouvir. */
export function aoAvisar(f: (a: Aviso) => void): () => void {
  ouvintesDeAviso.add(f);
  return () => {
    ouvintesDeAviso.delete(f);
  };
}

/** O cliente do Supabase do navegador, buscado na primeira vez em que a ligação precisa dele. */
async function pegarCliente(): Promise<SupabaseClient> {
  if (!cliente) cliente = (await import("@/lib/supabase/client")).createClient();
  return cliente;
}

async function dizerPresente() {
  const c = canal;
  if (!c || !quem || ligacao.estado !== "ao_vivo") return;
  try {
    await c.track({ id: quem, v: document.visibilityState === "visible" });
  } catch {
    // Sem presença a pessoa só não aparece como online. A conversa segue.
  }
}

const aoMudarDeVista = () => void dizerPresente();

async function entrar(id: string) {
  mudar({ estado: "ligando" });
  let supabase: SupabaseClient;
  try {
    supabase = await pegarCliente();
  } catch {
    // O pacote do cliente não chegou (rede caiu no meio): sem ligação ao vivo por ora, e o chat segue por consulta.
    mudar({ estado: "fora" });
    setTimeout(() => {
      if (usos > 0 && quem === id && !canal) void entrar(id);
    }, 15_000);
    return;
  }
  try {
    // Canal privado pede a sessão da pessoa: sem isso o Realtime confere o acesso como anônimo e recusa.
    await supabase.realtime.setAuth();
  } catch {
    // Segue: se a sessão não servir, a entrada no canal falha e o estado vira "fora".
  }
  // A pessoa pode ter saído da tela enquanto a sessão era lida.
  if (usos === 0 || quem !== id || canal) return;

  const novo = supabase.channel(CANAL_DO_TIME, { config: { private: true, presence: { key: id }, broadcast: { self: false } } });
  canal = novo;
  comecouEm = Date.now();
  jaEntrou = false;
  novo
    .on("presence", { event: "sync" }, () => {
      if (canal === novo) mudar({ presenca: lerPresenca(novo.presenceState()) });
    })
    .on("broadcast", { event: EVENTO }, ({ payload }) => {
      const sala = payload && typeof payload === "object" && typeof (payload as { sala?: unknown }).sala === "string" ? (payload as { sala: string }).sala : null;
      avisarAqui({ tipo: "mensagem", sala });
    })
    .subscribe((estado) => {
      if (canal !== novo) return;
      if (estado === "SUBSCRIBED") {
        jaEntrou = true;
        if (paciencia) clearTimeout(paciencia);
        paciencia = null;
        mudar({ estado: "ao_vivo" });
        void dizerPresente();
        avisarAqui({ tipo: "voltou" });
        return;
      }
      // Erro, tempo esgotado ou canal fechado. O cliente tenta de novo sozinho; enquanto isso, ninguém aparece online.
      const falta = PACIENCIA_MS - (Date.now() - comecouEm);
      if (jaEntrou || falta <= 0) {
        mudar({ estado: "fora", presenca: SEM_NINGUEM });
        return;
      }
      // Ainda nos primeiros segundos: segue "ligando", e só vira "fora" se o prazo acabar sem entrar.
      if (!paciencia) {
        paciencia = setTimeout(() => {
          paciencia = null;
          if (canal === novo && ligacao.estado !== "ao_vivo") mudar({ estado: "fora", presenca: SEM_NINGUEM });
        }, falta);
      }
    });
}

function sair() {
  document.removeEventListener("visibilitychange", aoMudarDeVista);
  if (paciencia) clearTimeout(paciencia);
  paciencia = null;
  const antigo = canal;
  canal = null;
  quem = null;
  mudar({ estado: "desligada", presenca: SEM_NINGUEM });
  if (antigo && cliente) void cliente.removeChannel(antigo);
}

/**
 * Liga o canal para a pessoa e devolve como desligar. Conta os usos: a moldura
 * e a tela do chat pedem a mesma ligação, e ela só cai quando as duas soltam.
 *
 * A saída espera um instante antes de derrubar o canal. No desenvolvimento o
 * React monta, desmonta e monta de novo; derrubar e recriar o MESMO canal no
 * mesmo tique devolve o canal que ainda está saindo.
 */
export function ligar(id: string): () => void {
  if (despedida) {
    clearTimeout(despedida);
    despedida = null;
  }
  usos += 1;
  if (!canal && ligacao.estado !== "ligando") {
    quem = id;
    document.addEventListener("visibilitychange", aoMudarDeVista);
    void entrar(id);
  }
  let solto = false;
  return () => {
    if (solto) return;
    solto = true;
    usos = Math.max(0, usos - 1);
    if (usos > 0) return;
    despedida = setTimeout(() => {
      despedida = null;
      if (usos === 0) sair();
    }, 400);
  };
}

/** Avisa o time de que há novidade numa sala. Só o nome da sala vai pelo canal. */
export function avisarOTime(sala: string) {
  const c = canal;
  if (!c) return;
  try {
    void Promise.resolve(c.send({ type: "broadcast", event: EVENTO, payload: { sala } })).catch(() => undefined);
  } catch {
    // Aviso que não saiu: quem está na conversa recebe na próxima consulta.
  }
}

const assinar = (f: () => void) => {
  ouvintesDaLigacao.add(f);
  return () => {
    ouvintesDaLigacao.delete(f);
  };
};
const ler = () => ligacao;
const lerNoServidor = () => DESLIGADA;

/** O estado da ligação e quem está online, para desenhar. */
export function useLigacao(): Ligacao {
  return useSyncExternalStore(assinar, ler, lerNoServidor);
}

/** Mantém a ligação enquanto o componente estiver na tela. `ligado` falso é para a prévia de desenvolvimento, que não tem sessão. */
export function useAoVivo(id: string | null | undefined, ligado = true) {
  useEffect(() => {
    if (!ligado || !id) return;
    return ligar(id);
  }, [id, ligado]);
}
