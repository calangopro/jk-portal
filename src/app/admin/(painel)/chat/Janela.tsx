"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LifeBuoy } from "lucide-react";
import { NOME_DA_SALA, SALAS, diaDe, horaCurta, rotuloDoDia, trechoDe, type Abertura, type Mensagem, type Sala } from "@/lib/time/chat";
import type { PedidoDeAbertura } from "../ChatFlutuante";
import type { ApiDoSuporte } from "../suporte/api";
import { PainelDoSuporte } from "../suporte/Painel";
import { apiDoChat, type ApiDoChat } from "./api";
import { Abrindo, CabecalhoDaJanela } from "./MolduraDaJanela";
import { Ponto, resumoDaPresenca } from "./Pessoas";
import { EmblemaDaSala, SalaDoChat } from "./Sala";
import { salaComNovidade, useChat, type Chat } from "./useChat";

/**
 * O que vai DENTRO da janela flutuante do chat: a lista de salas e a conversa
 * de uma sala. A casca (posição, Esc, foco, o botão) mora em
 * `ChatFlutuante.tsx`, que vai em toda tela; este arquivo e tudo o que ele
 * puxa só são buscados no primeiro clique.
 *
 * Duas vistas, como no direct do Instagram: a LISTA (cada sala com a última
 * mensagem, a hora e os números) e a SALA (a mesma conversa da tela cheia,
 * em `Sala.tsx`, com uma seta para voltar). A janela abre direto onde está a
 * novidade (a sala com mensagem nova, ou o suporte); com novidade nos dois,
 * ou em nenhum, abre na lista.
 *
 * Quem passa ou atende caso de suporte pós-venda ganha uma terceira vista, o
 * SUPORTE, que é a mesma peça da tela `/admin/suporte` (`suporte/Painel.tsx`):
 * o vendedor passa o caso sem sair do que estava fazendo.
 *
 * Depois da primeira abertura a conversa fica montada e guardada: fechar e
 * abrir de novo é instantâneo. Fechada, ela não pergunta nada ao banco (o
 * número do botão continua andando pela moldura) e não marca nada como lido:
 * a peça da sala só existe com a janela aberta e a sala na frente.
 */

type Props = {
  meuId: string;
  souAdmin: boolean;
  podeMeta: boolean;
  aberto: boolean;
  /** Quantas vezes a janela foi aberta: muda a cada abertura. */
  vezes: number;
  /** Abrir já numa mensagem (o clique num aviso do sistema). */
  pedido: PedidoDeAbertura | null;
  idTitulo: string;
  fechar: () => void;
  caixa: RefObject<HTMLDivElement>;
  /** Só a prévia de desenvolvimento: uma conversa de mentira, sem sessão. */
  api?: ApiDoChat;
  /** A pessoa passa ou atende caso de suporte, e o número do suporte no menu. Nulo: a janela não mostra o suporte. */
  suporte: { numero: number } | null;
  /** Só a prévia de desenvolvimento: um suporte de mentira, sem sessão. */
  apiDoSuporte?: ApiDoSuporte;
};

export default function ConteudoDaJanela(p: Props) {
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setErro(false);
    void (p.api ?? apiDoChat).abrir().then((a) => {
      if (!vivo) return;
      if (a) setAbertura(a);
      else setErro(true);
    });
    return () => {
      vivo = false;
    };
    // A API só muda na prévia de desenvolvimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  if (!abertura) return <Abrindo idTitulo={p.idTitulo} fechar={p.fechar} erro={erro} deNovo={() => setTentativa((n) => n + 1)} />;
  return <Janela {...p} abertura={abertura} />;
}

/** A última mensagem da sala, para a linha da lista. */
function ultimaDaSala(mensagens: readonly Mensagem[], sala: Sala): Mensagem | null {
  for (let i = mensagens.length - 1; i >= 0; i -= 1) if (mensagens[i].sala === sala) return mensagens[i];
  return null;
}

const primeiroNome = (nome: string | null) => (nome ?? "Alguém").split(/\s+/)[0];

function Janela({
  abertura, meuId, souAdmin, podeMeta, aberto, vezes, pedido, idTitulo, fechar, api = apiDoChat, suporte, apiDoSuporte,
}: Props & { abertura: Abertura }) {
  const naMensagem = pedido?.tipo === "mensagem" ? pedido : null;
  const c = useChat({
    abertura,
    meuId,
    salaInicial: naMensagem?.sala ?? null,
    rascunho: "",
    pedirDeInicio: false,
    destaqueInicial: naMensagem?.mensagem ?? null,
    podeMeta,
    api,
    ativo: aberto,
  });
  // Onde abre: no pedido, se houver; senão onde está a novidade. Com novidade no chat E no suporte, na lista, que mostra as duas.
  const [vista, setVista] = useState<"lista" | "sala" | "suporte">(() => {
    if (pedido?.tipo === "suporte" && suporte) return "suporte";
    if (naMensagem) return "sala";
    const noChat = salaComNovidade(abertura, meuId) !== null;
    const noSuporte = (suporte?.numero ?? 0) > 0;
    if (noChat && noSuporte) return "lista";
    return noChat ? "sala" : noSuporte ? "suporte" : "lista";
  });
  const titulo = useRef<HTMLHeadingElement>(null);

  // A cada nova abertura: o pedido de ir a uma mensagem, ou a linha "Novas mensagens" refeita na sala que estava aberta.
  const ultimaVez = useRef(vezes);
  const ultimoPedido = useRef(pedido?.vez ?? 0);
  useEffect(() => {
    if (vezes === ultimaVez.current) return;
    ultimaVez.current = vezes;
    if (pedido && pedido.vez !== ultimoPedido.current) {
      ultimoPedido.current = pedido.vez;
      if (pedido.tipo === "suporte") {
        if (suporte) setVista("suporte");
        return;
      }
      c.abrirNaMensagem(pedido.sala, pedido.mensagem);
      setVista("sala");
      return;
    }
    if (vista === "sala") c.trocarDeSala(c.sala, true);
    // Só a abertura dispara: o resto é lido como estava na hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vezes]);

  // O foco: no computador, direto no campo de escrever da sala; no celular (e na lista), no título, para o teclado não subir sozinho.
  const { focarCampo } = c;
  useEffect(() => {
    if (!aberto) return;
    if (vista === "sala" && window.matchMedia("(pointer: fine)").matches) focarCampo();
    else titulo.current?.focus({ preventScroll: true });
  }, [aberto, vezes, vista, focarCampo]);

  const entrar = (s: Sala) => {
    c.trocarDeSala(s, true);
    setVista("sala");
  };

  if (vista === "suporte" && suporte) {
    return (
      <>
        <CabecalhoDaJanela
          idTitulo={idTitulo}
          tituloRef={titulo}
          titulo="Suporte pós-venda"
          apoio="O caso do cliente passa para o gerente"
          voltar={() => setVista("lista")}
          telaCheia="/admin/suporte"
          fechar={fechar}
        />
        {/* Só existe com a janela aberta: ver um caso fechado conta como ver, e com a janela fechada ninguém viu nada. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {aberto ? <PainelDoSuporte inicial={null} meuId={meuId} compacta api={apiDoSuporte} /> : null}
        </div>
      </>
    );
  }

  if (vista === "sala") {
    return (
      <>
        <CabecalhoDaJanela
          idTitulo={idTitulo}
          tituloRef={titulo}
          titulo={NOME_DA_SALA[c.sala]}
          apoio="Sala aberta: todo o time lê"
          voltar={() => setVista("lista")}
          telaCheia={`/admin/chat?sala=${c.sala}`}
          fechar={fechar}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">{aberto ? <SalaDoChat c={c} compacta souAdmin={souAdmin} /> : null}</div>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaJanela
        idTitulo={idTitulo}
        tituloRef={titulo}
        titulo="Chat do time"
        apoio={
          <span className="inline-flex items-center gap-1.5">
            {c.ligacao.estado === "ao_vivo" ? <Ponto presenca="online" /> : null}
            {resumoDaPresenca(c.pessoas, c.ligacao.estado)}
          </span>
        }
        telaCheia="/admin/chat"
        fechar={fechar}
      />
      {suporte ? <LinhaDoSuporte numero={suporte.numero} entrar={() => setVista("suporte")} /> : null}
      <ListaDeSalas c={c} entrar={entrar} />
    </>
  );
}

/** A primeira linha da lista: o suporte pós-venda, com o número do menu (caso sem dono, ou caso seu que fechou). */
function LinhaDoSuporte({ numero, entrar }: { numero: number; entrar: () => void }) {
  return (
    <button
      type="button"
      onClick={entrar}
      className="painel-toque flex w-full shrink-0 items-center gap-3 border-b border-ink/[0.06] bg-[rgb(var(--jk-bg-rgb))] px-4 py-3 text-left hover:bg-ink/[0.04] focus-visible:bg-ink/[0.05]"
    >
      <span className="painel-selo painel-selo-ativo grid h-10 w-10 shrink-0 place-items-center rounded-full" aria-hidden="true">
        <LifeBuoy size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.92rem] font-bold leading-tight text-ink">Suporte pós-venda</span>
        <span className="mt-0.5 block truncate text-xs leading-snug text-muted">
          {numero > 0 ? (numero === 1 ? "1 caso esperando por você" : `${numero} casos esperando por você`) : "Passe o caso do cliente para o gerente"}
        </span>
      </span>
      {numero > 0 ? (
        <span className="shrink-0 rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">
          {numero > 99 ? "99+" : numero}
          <span className="sr-only"> esperando</span>
        </span>
      ) : null}
    </button>
  );
}

function ListaDeSalas({ c, entrar }: { c: Chat; entrar: (s: Sala) => void }) {
  const quando = (iso: string) => (diaDe(iso) === diaDe(c.agora) ? horaCurta(iso) : rotuloDoDia(diaDe(iso), c.agora));
  return (
    <nav aria-label="Salas" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <ul>
        {SALAS.map((s) => {
          const ultima = ultimaDaSala(c.mensagens, s.chave);
          const novas = c.novasPorSala[s.chave];
          const previa = ultima ? `${ultima.autor === c.meuId ? "Você" : primeiroNome(ultima.autorNome)}: ${trechoDe(ultima, 70)}` : s.resolve;
          return (
            <li key={s.chave} className="border-b border-ink/[0.06] last:border-b-0">
              <button
                type="button"
                onClick={() => entrar(s.chave)}
                className="painel-toque flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04]"
              >
                <span className="painel-selo grid h-10 w-10 shrink-0 place-items-center rounded-full text-[0.78rem] font-bold" aria-hidden="true">
                  {s.nome.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[0.92rem] leading-tight text-ink ${novas > 0 ? "font-bold" : "font-semibold"}`}>{s.nome}</span>
                    {ultima ? <span className="shrink-0 text-[0.68rem] text-muted">{quando(ultima.em)}</span> : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-xs leading-snug ${novas > 0 ? "font-semibold text-ink" : "text-muted"}`}>{previa}</span>
                    <EmblemaDaSala c={c} s={s.chave} mesmoAberta />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-4 pb-4 pt-2 text-[0.7rem] leading-relaxed text-muted">As salas são abertas: todo o time lê. Para mais espaço, abra em tela cheia.</p>
    </nav>
  );
}
