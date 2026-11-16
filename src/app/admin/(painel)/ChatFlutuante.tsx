"use client";

import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { MessagesSquare, X } from "lucide-react";
import { SETORES } from "@/lib/painel/setores";
import { ENDERECO_DO_CHAT, type Sala } from "@/lib/time/chat";
import type { ApiDoChat } from "./chat/api";
import type { ApiDoSuporte } from "./suporte/api";
import { Abrindo } from "./chat/MolduraDaJanela";
import { corDoSetor } from "./Navegacao";

/**
 * O chat do time FLUTUANTE: um botão em toda tela do painel, com o número do
 * que espera a pessoa, que abre a conversa por cima da tela em que ela está,
 * sem trocar de página. No jeito do direct do Instagram: a lista de salas com
 * o número de cada uma, a conversa e o campo de escrever, e um atalho para a
 * tela cheia.
 *
 * ONDE FICA O BOTÃO. No computador, uma bolha no canto de baixo à direita. No
 * celular, um ícone na barra de topo, ao lado da conta (como o direct no
 * Instagram): lá embaixo já moram a barra dos setores e as barras de ação que
 * grudam no fim da tela (a de publicar nas redes, por exemplo), e uma bolha
 * cobriria uma delas.
 *
 * ESTE ARQUIVO É LEVE DE PROPÓSITO. Ele entra no pacote de toda tela do
 * painel, então traz só o botão e a casca da janela. A conversa (`Janela.tsx`,
 * com tudo o que ela puxa) é buscada por `import()` no primeiro clique, e o
 * mouse passando pelo botão já adianta a busca.
 *
 * NÃO É UM SEGUNDO CHAT. A janela usa a mesma conversa da tela cheia
 * (`useChat`), as mesmas funções do banco e a MESMA ligação ao vivo que a
 * moldura já mantém (um canal por aba). O número do botão é o do menu.
 *
 * A casca mora na moldura, fora da página animada (`template.tsx`) e fora de
 * qualquer cartão: `fixed` lá dentro se prenderia ao pai e sumiria atrás do
 * cabeçalho.
 */

const carregar = () => import("./chat/Janela");
const ConteudoDaJanela = lazy(carregar);

const SETOR_TIME = SETORES.find((s) => s.id === "time") ?? null;
/** A janela tem a cor do setor Time em qualquer tela, e não a do setor que está aberto atrás dela. */
const COR_DA_JANELA = corDoSetor(SETOR_TIME);
const COR_DO_BOTAO = SETOR_TIME?.cor ?? "#8a3aa0";

/** A largura em que o painel deixa de ser celular (a mesma do `lg:` das telas). */
const TELA_LARGA = "(min-width: 64rem)";

/** Abrir a janela já num lugar: numa mensagem (o clique no aviso do sistema do chat) ou no suporte (o do suporte). */
export type PedidoDeAbertura = ({ tipo: "mensagem"; sala: Sala; mensagem: number } | { tipo: "suporte" }) & { vez: number };

/** O número do botão é o do chat mais o do suporte; o texto para leitor de tela diz os dois por extenso. */
function rotuloDoBotao(chat: number, suporte: number, aberto: boolean): string {
  if (aberto) return "Fechar o chat do time";
  const partes = [
    chat > 0 ? `${chat > 99 ? "mais de 99" : chat} ${chat === 1 ? "mensagem" : "mensagens"}` : null,
    suporte > 0 ? `${suporte} ${suporte === 1 ? "caso de suporte" : "casos de suporte"}` : null,
  ].filter(Boolean);
  if (partes.length === 0) return "Abrir o chat do time";
  return `Abrir o chat do time: ${partes.join(" e ")} esperando por você`;
}

function Numero({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-wine px-1 text-[0.66rem] font-bold leading-none text-white ring-2 ring-white"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Estado do chat flutuante, guardado na moldura. `disponivel` é falso para
 * quem não tem o setor Time e na própria tela do chat (a tela já é o chat).
 */
export function useChatFlutuante(caminho: string, temChat: boolean) {
  const disponivel = temChat && !caminho.startsWith(ENDERECO_DO_CHAT);
  const [aberto, setAberto] = useState(false);
  /** A conversa já foi pedida uma vez: daqui em diante ela fica montada, guardada, para reabrir na hora. */
  const [montada, setMontada] = useState(false);
  const [vezes, setVezes] = useState(0);
  const [pedido, setPedido] = useState<PedidoDeAbertura | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const botaoDoTopo = useRef<HTMLButtonElement>(null);
  const bolha = useRef<HTMLButtonElement>(null);

  const abrir = useCallback((origem?: HTMLElement | null) => {
    quemAbriu.current = origem ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setMontada(true);
    setAberto(true);
    setVezes((n) => n + 1);
  }, []);

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (!devolverFoco) return;
    // O foco volta para quem abriu. Se ele sumiu (trocou de tela), vai para o botão que está à vista.
    requestAnimationFrame(() => {
      // `getClientRects`, e não `offsetParent`: a bolha é `fixed`, e elemento `fixed` não tem `offsetParent` mesmo à vista.
      const volta = [quemAbriu.current, bolha.current, botaoDoTopo.current].find((el) => el && el.isConnected && el.getClientRects().length > 0);
      volta?.focus();
    });
  }, []);

  /** Abre a janela já na mensagem (o clique num aviso do sistema, com o painel em outra tela). */
  const abrirNaMensagem = useCallback(
    (sala: Sala, mensagem: number) => {
      setPedido((p) => ({ tipo: "mensagem", sala, mensagem, vez: (p?.vez ?? 0) + 1 }));
      abrir(null);
    },
    [abrir],
  );

  /** Abre a janela no suporte pós-venda (o clique no aviso do sistema de um caso). */
  const abrirSuporte = useCallback(() => {
    setPedido((p) => ({ tipo: "suporte", vez: (p?.vez ?? 0) + 1 }));
    abrir(null);
  }, [abrir]);

  // Na tela do chat a janela não existe. No celular ela cobre a tela inteira, então trocar de tela (um link dentro da conversa) fecha.
  useEffect(() => {
    if (!disponivel) {
      setAberto(false);
      return;
    }
    if (!window.matchMedia(TELA_LARGA).matches) setAberto(false);
  }, [caminho, disponivel]);

  return { disponivel, aberto, montada, vezes, pedido, abrir, fechar, abrirNaMensagem, abrirSuporte, botaoDoTopo, bolha };
}

export type ChatFlutuante = ReturnType<typeof useChatFlutuante>;

/** Celular: o ícone do chat na barra de topo, ao lado da conta. */
export function BotaoDoChatNoTopo({ f, chat, suporte }: { f: ChatFlutuante; chat: number; suporte: number }) {
  if (!f.disponivel) return null;
  return (
    <button
      ref={f.botaoDoTopo}
      type="button"
      onClick={(e) => (f.aberto ? f.fechar() : f.abrir(e.currentTarget))}
      onPointerEnter={() => void carregar()}
      onFocus={() => void carregar()}
      aria-label={rotuloDoBotao(chat, suporte, f.aberto)}
      aria-expanded={f.aberto}
      aria-controls="janela-do-chat"
      className="painel-toque relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink"
    >
      <MessagesSquare size={19} aria-hidden="true" />
      <Numero n={chat + suporte} />
    </button>
  );
}

/** Acompanha a parte da tela que sobra quando o teclado do celular abre: a janela cabe nela, e o campo de escrever fica à vista. */
function useParteVisivel(ligado: boolean) {
  const [parte, setParte] = useState<{ topo: number; altura: number; teclado: boolean } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!ligado || !vv) {
      setParte(null);
      return;
    }
    const medir = () => setParte({ topo: vv.offsetTop, altura: vv.height, teclado: vv.height < window.innerHeight * 0.8 });
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [ligado]);
  return parte;
}

function useTelaLarga(): boolean {
  const [larga, setLarga] = useState(true);
  useEffect(() => {
    const m = window.matchMedia(TELA_LARGA);
    const ler = () => setLarga(m.matches);
    ler();
    m.addEventListener("change", ler);
    return () => m.removeEventListener("change", ler);
  }, []);
  return larga;
}

/**
 * Computador: a bolha no canto. Os dois tamanhos: a casca da janela, que é
 * uma caixa ao lado da bolha no computador e a tela inteira no celular.
 */
export function ChatFlutuante({
  f, chat, suporte, temSuporte, meuId, souAdmin, podeMeta, apiDaPrevia, apiDoSuporteDaPrevia,
}: {
  f: ChatFlutuante;
  /** O número do chat no menu. */
  chat: number;
  /** O número do suporte pós-venda no menu: caso sem dono, para quem atende, e caso da pessoa que fechou. */
  suporte: number;
  /** A pessoa passa ou atende caso de suporte: a janela mostra o suporte na lista. */
  temSuporte: boolean;
  meuId: string;
  souAdmin: boolean;
  podeMeta: boolean;
  /** Só a prévia de desenvolvimento: uma conversa de mentira, sem sessão. */
  apiDaPrevia?: ApiDoChat;
  /** Só a prévia de desenvolvimento: um suporte de mentira, sem sessão. */
  apiDoSuporteDaPrevia?: ApiDoSuporte;
}) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const larga = useTelaLarga();
  const celular = f.aberto && !larga;
  const parte = useParteVisivel(celular);

  // Ao abrir, o foco vai para a janela (o leitor de tela anuncia o nome dela). A conversa decide, depois, se ele desce para o campo.
  useEffect(() => {
    // Quem já pôs o foco lá dentro (a conversa carregada, no título) fica como está.
    if (f.aberto && !caixa.current?.contains(document.activeElement)) caixa.current?.focus({ preventScroll: true });
  }, [f.aberto, f.vezes]);

  // No celular a janela cobre a tela: a página de trás não rola junto do dedo.
  useEffect(() => {
    if (!celular) return;
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = antes;
    };
  }, [celular]);

  if (!f.disponivel) return null;

  const posicao: CSSProperties = celular && parte ? { top: parte.topo, height: parte.altura, paddingBottom: parte.teclado ? 0 : undefined } : {};

  return (
    <>
      <button
        ref={f.bolha}
        type="button"
        onClick={(e) => (f.aberto ? f.fechar() : f.abrir(e.currentTarget))}
        onPointerEnter={() => void carregar()}
        onFocus={() => void carregar()}
        aria-label={rotuloDoBotao(chat, suporte, f.aberto)}
        aria-expanded={f.aberto}
        aria-controls="janela-do-chat"
        className="painel-toque fixed bottom-6 right-6 z-30 hidden h-12 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-semibold text-white shadow-[0_14px_34px_-14px_rgba(23,21,18,0.7)] lg:inline-flex"
        style={{ background: COR_DO_BOTAO }}
      >
        {f.aberto ? <X size={18} aria-hidden="true" /> : <MessagesSquare size={18} aria-hidden="true" />}
        <span aria-hidden="true">{f.aberto ? "Fechar" : "Chat"}</span>
        {f.aberto ? null : <Numero n={chat + suporte} />}
      </button>

      {f.montada ? (
        <div
          id="janela-do-chat"
          ref={caixa}
          role="dialog"
          aria-modal={celular ? true : undefined}
          aria-labelledby={idTitulo}
          tabIndex={-1}
          hidden={!f.aberto}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            // O Esc com a prévia de um pedido aberta é dela: fecha a prévia, não a janela.
            if (document.querySelector("[data-previa-do-pedido]")) return;
            e.preventDefault();
            f.fechar();
          }}
          className="painel-entrada fixed inset-x-0 top-0 z-[55] flex h-dvh flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] outline-none lg:inset-x-auto lg:bottom-[5.25rem] lg:right-6 lg:top-auto lg:z-[45] lg:h-[min(42rem,calc(100dvh-9.5rem))] lg:w-[25rem] lg:rounded-[22px] lg:border lg:border-ink/10 lg:p-0 lg:shadow-[0_28px_70px_-24px_rgba(23,21,18,0.5)]"
          style={{ ...COR_DA_JANELA, ...posicao }}
        >
          <Suspense fallback={<Abrindo idTitulo={idTitulo} fechar={() => f.fechar()} />}>
            <ConteudoDaJanela
              meuId={meuId}
              souAdmin={souAdmin}
              podeMeta={podeMeta}
              aberto={f.aberto}
              vezes={f.vezes}
              pedido={f.pedido}
              idTitulo={idTitulo}
              fechar={() => f.fechar()}
              caixa={caixa as RefObject<HTMLDivElement>}
              api={apiDaPrevia}
              suporte={temSuporte ? { numero: suporte } : null}
              apiDoSuporte={apiDoSuporteDaPrevia}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
