"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { comBasePath, semBasePath } from "@/lib/seo/base-path";
import { pegarCliente } from "@/lib/time/ao-vivo";
import { CATEGORIAS, estadoDoPush, lerCategorias, type Categoria, type EstadoDoPush } from "./push";

/**
 * O aviso por push NESTE aparelho (cartão 59), do lado do navegador.
 *
 * Ligar é escolha de cada pessoa em cada aparelho, e só pode começar num
 * clique (o navegador não deixa pedir a permissão sozinho). Ligar é: pedir a
 * permissão, registrar o service worker (`public/sw.js`, que só recebe aviso
 * e não guarda página), inscrever o aparelho no serviço de push do navegador
 * com a chave pública do painel e guardar a inscrição no banco
 * (`/api/painel/push`). Daí em diante quem avisa é o servidor, com o painel
 * aberto ou fechado.
 *
 * O SOM com o painel à vista é outra coisa, e vale mesmo sem push: o
 * aparelho toca um "plim" curto, feito na hora com Web Audio (nenhum arquivo
 * baixado). Desligável; a escolha fica neste navegador.
 */

const ESCOPO = comBasePath("/admin");
const ARQUIVO = comBasePath("/sw.js");
const API = comBasePath("/api/painel/push");
const CHAVE_DO_SOM = "jk:aviso:som";

export type AparelhoLigado = {
  id: number;
  endpoint: string;
  tipo: "celular" | "computador";
  navegador: string | null;
  avisar: Categoria[];
  criado_em: string;
  usado_em: string | null;
  ultimo_erro: string | null;
};

export type SituacaoDoPush = {
  estado: EstadoDoPush;
  /** A inscrição deste aparelho, quando há. */
  endpoint: string | null;
  aparelhos: AparelhoLigado[];
  /** Ainda perguntando ao navegador e ao servidor. */
  carregando: boolean;
};

const INICIO: SituacaoDoPush = { estado: "sem_suporte", endpoint: null, aparelhos: [], carregando: true };
let situacao: SituacaoDoPush = INICIO;
const ouvintes = new Set<() => void>();
const mudar = (s: Partial<SituacaoDoPush>) => {
  situacao = { ...situacao, ...s };
  ouvintes.forEach((f) => f());
};

function capacidade() {
  const temPush = typeof window !== "undefined" && "PushManager" in window;
  const temServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const permissao = typeof Notification === "undefined" ? null : Notification.permission;
  const safariDoIphone = typeof navigator !== "undefined" && "standalone" in navigator;
  const instalado =
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    (safariDoIphone && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return { temPush, temServiceWorker, permissao, safariDoIphone, instalado: Boolean(instalado) };
}

/** Pede ao servidor o que ele sabe (a chave e os aparelhos). */
async function doServidor(): Promise<{ chave: string | null; aparelhos: AparelhoLigado[] }> {
  const r = await fetch(API, { cache: "no-store" });
  if (!r.ok) throw new Error(`push ${r.status}`);
  const j = (await r.json()) as { chave: string | null; aparelhos: AparelhoLigado[] };
  return { chave: j.chave, aparelhos: (j.aparelhos ?? []).map((a) => ({ ...a, avisar: lerCategorias(a.avisar) })) };
}

async function postar(corpo: Record<string, unknown>): Promise<void> {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new Error(j.erro || "Não deu certo agora. Tente de novo.");
  }
}

async function inscricaoAqui(): Promise<PushSubscription | null> {
  const c = capacidade();
  if (!c.temPush || !c.temServiceWorker) return null;
  const reg = await navigator.serviceWorker.getRegistration(ESCOPO);
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Relê o estado deste aparelho e a lista de aparelhos ligados. */
export async function atualizarPush(): Promise<void> {
  const c = capacidade();
  try {
    const [sub, srv] = await Promise.all([inscricaoAqui(), doServidor().catch(() => null)]);
    const endpoint = sub?.endpoint ?? null;
    const aparelhos = srv?.aparelhos ?? situacao.aparelhos;
    const inscrito = Boolean(endpoint && aparelhos.some((a) => a.endpoint === endpoint));
    mudar({ estado: estadoDoPush({ ...c, inscrito }), endpoint: inscrito ? endpoint : null, aparelhos, carregando: false });
  } catch {
    mudar({ estado: estadoDoPush({ ...c, inscrito: false }), carregando: false });
  }
}

const base64ParaBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const puro = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(puro);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function ativo(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return;
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return;
  await new Promise<void>((pronto) => {
    const ver = () => {
      if (sw.state === "activated") pronto();
    };
    sw.addEventListener("statechange", ver);
    ver();
  });
}

/**
 * Liga o aviso neste aparelho. Precisa ser chamado a partir de um clique.
 * Devolve a frase de erro, ou nulo quando deu certo.
 */
export async function ligarPush(avisar: readonly Categoria[] = CATEGORIAS): Promise<string | null> {
  const c = capacidade();
  if (!c.temPush || !c.temServiceWorker || c.permissao === null) return "Este navegador não recebe aviso por push.";
  try {
    const dada = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (dada !== "granted") {
      await atualizarPush();
      return dada === "denied" ? "O aviso foi negado. Libere as notificações deste site nas configurações do navegador." : "Sem a permissão, o aviso não liga.";
    }
    const { chave } = await doServidor();
    if (!chave) return "O painel ainda não tem a chave dos avisos. Fale com quem cuida do painel.";
    const reg = await navigator.serviceWorker.register(ARQUIVO, { scope: ESCOPO, updateViaCache: "none" });
    await ativo(reg);
    let sub = await reg.pushManager.getSubscription();
    // Inscrição antiga com outra chave (o painel trocou as chaves): refaz.
    const chaveAtual = sub?.options.applicationServerKey;
    if (sub && chaveAtual && new Uint8Array(chaveAtual).join() !== base64ParaBytes(chave).join()) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave) });
    await postar({ acao: "ligar", inscricao: sub.toJSON(), avisar });
    try {
      localStorage.setItem("jk:push", "1");
    } catch {
      // Sem armazenamento: só não refaz a ligação sozinho na próxima abertura.
    }
    await atualizarPush();
    return null;
  } catch (e) {
    await atualizarPush();
    return e instanceof Error && e.message ? e.message : "Não deu para ligar agora. Tente de novo.";
  }
}

/** Desliga este aparelho (aqui e no servidor). */
export async function desligarPush(): Promise<string | null> {
  try {
    const sub = await inscricaoAqui();
    if (sub) {
      await postar({ acao: "desligar", endpoint: sub.endpoint }).catch(() => undefined);
      await sub.unsubscribe();
    }
    try {
      localStorage.setItem("jk:push", "0");
    } catch {
      // Sem armazenamento: nada a guardar.
    }
    await atualizarPush();
    return null;
  } catch (e) {
    await atualizarPush();
    return e instanceof Error ? e.message : "Não deu para desligar agora.";
  }
}

/** Desliga outro aparelho da lista (o celular esquecido na loja, por exemplo). */
export async function desligarAparelho(id: number): Promise<string | null> {
  try {
    await postar({ acao: "desligar", id });
    await atualizarPush();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Não deu para desligar agora.";
  }
}

export async function escolherAvisos(avisar: readonly Categoria[]): Promise<string | null> {
  if (!situacao.endpoint) return "Este aparelho não está ligado.";
  try {
    await postar({ acao: "escolher", endpoint: situacao.endpoint, avisar });
    await atualizarPush();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Não deu para guardar.";
  }
}

export async function testarPush(): Promise<string | null> {
  try {
    await postar({ acao: "teste", endpoint: situacao.endpoint });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "O teste não saiu.";
  }
}

function assinar(f: () => void) {
  ouvintes.add(f);
  if (ouvintes.size === 1 && situacao.carregando) void atualizarPush();
  return () => {
    ouvintes.delete(f);
  };
}

export function usePush(): SituacaoDoPush {
  return useSyncExternalStore(assinar, () => situacao, () => INICIO);
}

/** Este aparelho recebe push: o aviso antigo (só com o painel aberto) deixa de mostrar, senão sairia em dobro. */
export function usePushLigadoAqui(): boolean {
  return usePush().estado === "ligado";
}

// ------------------------------------------------------------------ som

const ouvintesDoSom = new Set<() => void>();
const somLigado = (): boolean => {
  try {
    return localStorage.getItem(CHAVE_DO_SOM) !== "0";
  } catch {
    return true;
  }
};

export function ligarSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_DO_SOM, ligado ? "1" : "0");
  } catch {
    // Sem armazenamento: vale até recarregar.
  }
  ouvintesDoSom.forEach((f) => f());
  if (ligado) tocarSom();
}

export function useSom(): boolean {
  return useSyncExternalStore(
    (f) => {
      ouvintesDoSom.add(f);
      window.addEventListener("storage", f);
      return () => {
        ouvintesDoSom.delete(f);
        window.removeEventListener("storage", f);
      };
    },
    somLigado,
    () => false,
  );
}

let audio: AudioContext | null = null;
let ultimoSom = 0;

/**
 * O "plim": duas notas curtas e baixas, feitas na hora. O navegador só deixa
 * tocar depois de a pessoa ter clicado na página uma vez; antes disso, fica
 * calado sem erro. Duas chegadas em menos de 2 segundos tocam uma vez só.
 */
export function tocarSom() {
  if (typeof window === "undefined" || !somLigado()) return;
  const agora = Date.now();
  if (agora - ultimoSom < 2000) return;
  ultimoSom = agora;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio = audio ?? new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    [
      { f: 880, em: 0 },
      { f: 1318.5, em: 0.11 },
    ].forEach(({ f, em }) => {
      const osc = audio!.createOscillator();
      const vol = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      vol.gain.setValueAtTime(0.0001, t + em);
      vol.gain.exponentialRampToValueAtTime(0.12, t + em + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + em + 0.22);
      osc.connect(vol).connect(audio!.destination);
      osc.start(t + em);
      osc.stop(t + em + 0.25);
    });
  } catch {
    // Sem áudio neste aparelho: o aviso continua, só sem som.
  }
}

// ------------------------------------------------------------------ moldura

/**
 * O que a moldura do painel liga em toda tela:
 *   1. "estou com o painel à vista", de minuto em minuto, para o servidor não
 *      mandar push a quem já está olhando (0190, `push_estou_aqui`);
 *   2. o toque no aviso com o painel já aberto: o service worker manda o
 *      endereço e a moldura abre o lugar sem recarregar (`abrir`);
 *   3. a ligação refeita sozinha na abertura, quando a pessoa já tinha ligado
 *      neste aparelho e a permissão continua dada (o servidor pode ter tirado
 *      a linha, ou o aparelho ter trocado de dono).
 */
export function usePushNaMoldura(ligado: boolean, abrir: (caminho: string) => void) {
  const abrirAgora = useRef(abrir);
  abrirAgora.current = abrir;

  useEffect(() => {
    if (!ligado) return;
    let ultimo: boolean | null = null;
    const dizer = async (aVista: boolean) => {
      // "Saí" repetido não precisa ir de novo; "estou aqui" vai sempre, porque renova o prazo de 90 s.
      if (!aVista && ultimo === false) return;
      ultimo = aVista;
      try {
        const db = await pegarCliente();
        await db.rpc("push_estou_aqui", { p_a_vista: aVista });
      } catch {
        // Sem rede: a folga do banco cobre.
      }
    };
    const aVista = () => document.visibilityState === "visible" && document.hasFocus();
    const conferir = () => void dizer(aVista());
    const sair = () => void dizer(false);
    conferir();
    const relogio = setInterval(() => {
      if (aVista()) void dizer(true);
    }, 50_000);
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    window.addEventListener("blur", conferir);
    window.addEventListener("pagehide", sair);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", sair);
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
      window.removeEventListener("blur", conferir);
    };
  }, [ligado]);

  useEffect(() => {
    if (!ligado || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const aoReceber = (ev: MessageEvent) => {
      const d = ev.data as { tipo?: string; url?: string } | null;
      if (d?.tipo === "jk-abrir" && typeof d.url === "string") abrirAgora.current(semBasePath(d.url));
    };
    navigator.serviceWorker.addEventListener("message", aoReceber);
    navigator.serviceWorker.startMessages?.();

    // Refaz a ligação quando a pessoa já tinha ligado aqui.
    let ligouAntes = false;
    try {
      ligouAntes = localStorage.getItem("jk:push") === "1";
    } catch {
      ligouAntes = false;
    }
    if (ligouAntes && typeof Notification !== "undefined" && Notification.permission === "granted") {
      void (async () => {
        const sub = await inscricaoAqui().catch(() => null);
        if (sub) await postar({ acao: "ligar", inscricao: sub.toJSON() }).catch(() => undefined);
        await atualizarPush();
      })();
    }
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, [ligado]);
}
