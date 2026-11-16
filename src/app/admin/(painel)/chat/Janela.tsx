"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { NOME_DA_SALA, SALAS, diaDe, horaCurta, rotuloDoDia, trechoDe, type Abertura, type Mensagem, type Sala } from "@/lib/time/chat";
import type { PedidoDeAbertura } from "../ChatFlutuante";
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
 * em `Sala.tsx`, com uma seta para voltar). A janela abre direto na sala que
 * tem mensagem nova para a pessoa; sem novidade, abre na lista.
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

function Janela({ abertura, meuId, souAdmin, podeMeta, aberto, vezes, pedido, idTitulo, fechar, api = apiDoChat }: Props & { abertura: Abertura }) {
  const c = useChat({
    abertura,
    meuId,
    salaInicial: pedido?.sala ?? null,
    rascunho: "",
    pedirDeInicio: false,
    destaqueInicial: pedido?.mensagem ?? null,
    podeMeta,
    api,
    ativo: aberto,
  });
  const [vista, setVista] = useState<"lista" | "sala">(() => (pedido || salaComNovidade(abertura, meuId) ? "sala" : "lista"));
  const titulo = useRef<HTMLHeadingElement>(null);

  // A cada nova abertura: o pedido de ir a uma mensagem, ou a linha "Novas mensagens" refeita na sala que estava aberta.
  const ultimaVez = useRef(vezes);
  const ultimoPedido = useRef(pedido?.vez ?? 0);
  useEffect(() => {
    if (vezes === ultimaVez.current) return;
    ultimaVez.current = vezes;
    if (pedido && pedido.vez !== ultimoPedido.current) {
      ultimoPedido.current = pedido.vez;
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
      <ListaDeSalas c={c} entrar={entrar} />
    </>
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
