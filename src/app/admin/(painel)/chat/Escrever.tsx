"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CornerUpLeft, ImagePlus, MessageCircleQuestion, Send, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { TIPOS_DE_IMAGEM, trechoDe, type Mensagem, type Pessoa } from "@/lib/time/chat";
import { Miniaturas, type useImagens } from "./Imagens";
import { ListaDeSugestoes, useSugestoes, type BuscarPedidos } from "./Sugestoes";

/**
 * O campo de escrever do chat.
 *
 * No computador, Enter envia e Shift+Enter pula linha, como em todo
 * aplicativo de conversa. No celular o Enter do teclado pula linha e quem
 * envia é o botão: lá não existe Shift+Enter, e mensagem enviada sem querer
 * no meio da frase é pior do que um toque a mais.
 *
 * "PEDIR RESPOSTA" é o que sobrou do chamado: ligado, a mensagem fica com
 * relógio e à vista no topo da sala até alguém responder a ela.
 *
 * "@" e "/" abrem sugestões em cima do campo (`Sugestoes.tsx`): marcar uma
 * pessoa, um setor, um pedido ou a meta. Com a lista aberta, o Enter escolhe o
 * item em vez de enviar.
 */
export function Escrever({
  texto, onTexto, onEnviar, respondendo, onCancelarResposta, pedir, onPedir, imagens, sala, focar, pessoas, meuId, podeMeta, buscarPedidos,
}: {
  texto: string;
  onTexto: (t: string) => void;
  onEnviar: () => void;
  respondendo: Mensagem | null;
  onCancelarResposta: () => void;
  pedir: boolean;
  onPedir: (p: boolean) => void;
  imagens: ReturnType<typeof useImagens>;
  /** O nome da sala, para o texto de apoio do campo. */
  sala: string;
  /** Muda de valor quando o campo deve receber o foco (a pessoa tocou em "Responder"). */
  focar: number;
  /** Quem dá para marcar com "@". */
  pessoas: readonly Pessoa[];
  meuId: string;
  /** A pessoa pode ver a meta do mês: só então o "/meta" aparece. */
  podeMeta: boolean;
  buscarPedidos: BuscarPedidos;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const idDaLista = useId();
  const sugestoes = useSugestoes({ texto, onTexto, campo, pessoas, meuId, podeMeta, buscarPedidos });
  const arquivo = useRef<HTMLInputElement>(null);
  // Teclado de tela: o Enter pula linha. Lido depois de montar, para o servidor e o navegador desenharem igual.
  const [toque, setToque] = useState(false);
  useEffect(() => setToque(window.matchMedia("(pointer: coarse)").matches), []);

  // O campo cresce com o texto, até um teto; daí em diante rola por dentro.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    // `scrollHeight` não conta a borda: sem os 2 px, o campo ficava menor do que o texto e ganhava barra de rolagem com uma linha só.
    const alto = el.scrollHeight + 2;
    el.style.height = `${Math.min(alto, 132)}px`;
    el.style.overflowY = alto > 132 ? "auto" : "hidden";
  }, [texto]);

  useEffect(() => {
    if (focar > 0) campo.current?.focus();
  }, [focar]);

  const vazio = texto.trim() === "" && imagens.lista.length === 0;

  return (
    <div className="relative border-t border-ink/[0.07] bg-white px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-3">
      <ListaDeSugestoes s={sugestoes} id={idDaLista} />
      {respondendo ? (
        <div className="painel-ramo mb-2 flex items-center gap-2 rounded-r-[10px] bg-ink/[0.04] py-1.5 pl-2.5 pr-1">
          <CornerUpLeft size={13} className="painel-cor shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs leading-snug">
            <span className="painel-cor block font-bold">Respondendo a {respondendo.autorNome ?? "alguém do time"}</span>
            <span className="block truncate text-ink/70">{trechoDe(respondendo)}</span>
          </p>
          <button type="button" onClick={onCancelarResposta} aria-label="Cancelar a resposta" className="painel-toque grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Miniaturas imagens={imagens} />
      {imagens.erro ? (
        <p role="alert" className="mb-1.5 px-1 text-xs font-semibold" style={{ color: COR_DO_TOM.ruim.texto }}>
          {imagens.erro}
        </p>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={arquivo}
          type="file"
          accept={TIPOS_DE_IMAGEM.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (arquivos.length > 0) imagens.juntar(arquivos);
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          aria-label="Mandar imagem"
          title="Mandar imagem (ou cole o print no texto)"
          className="painel-toque grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-ink/[0.06]"
        >
          <ImagePlus size={19} aria-hidden="true" />
        </button>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Mensagem para a sala {sala}</span>
          <textarea
            ref={campo}
            value={texto}
            onChange={(e) => {
              sugestoes.aoMoverCursor(e.target);
              onTexto(e.target.value);
            }}
            onSelect={(e) => sugestoes.aoMoverCursor(e.currentTarget)}
            onPaste={imagens.aoColar}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={sugestoes.aberta}
            aria-controls={sugestoes.aberta ? idDaLista : undefined}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              // A lista de sugestões fica com as setas, o Enter, o Tab e o Esc enquanto está aberta.
              if (sugestoes.aoTeclar(e)) return;
              if (e.key !== "Enter" || e.shiftKey || toque) return;
              e.preventDefault();
              if (!vazio) onEnviar();
            }}
            maxLength={4000}
            rows={1}
            enterKeyHint={toque ? "enter" : "send"}
            // Curto de propósito: no celular o campo é estreito, e texto de apoio em duas linhas dobrava a altura dele.
            placeholder={pedir ? "O que você precisa?" : "Mensagem"}
            // `text-base` (16 px) de propósito: abaixo disso o iPhone amplia a tela ao focar.
            className="block max-h-[132px] min-h-11 w-full resize-none rounded-[22px] border border-ink/12 bg-[rgb(var(--jk-bg-rgb))] px-4 py-2.5 text-base leading-snug text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
          />
        </label>

        <button
          type="button"
          aria-pressed={pedir}
          onClick={() => onPedir(!pedir)}
          title="Pedir resposta: a mensagem fica à vista no topo da sala até alguém responder"
          className={`painel-toque inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${pedir ? "" : "text-ink/70 hover:bg-ink/[0.06]"}`}
          style={pedir ? { background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto } : undefined}
        >
          <MessageCircleQuestion size={18} aria-hidden="true" />
          <span className="hidden sm:inline">{pedir ? "Pedindo resposta" : "Pedir resposta"}</span>
          <span className="sr-only sm:hidden">{pedir ? "Pedindo resposta" : "Pedir resposta"}</span>
        </button>

        <button
          type="button"
          disabled={vazio}
          onClick={onEnviar}
          aria-label="Enviar a mensagem"
          className="painel-toque painel-aba-ativa grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40"
        >
          <Send size={17} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-1.5 hidden px-1 text-[0.68rem] leading-snug text-muted sm:block">
        {pedir
          ? "Esta mensagem vai pedir resposta: fica no topo da sala, com o tempo de espera, até alguém responder a ela."
          : toque
            ? "Digite @ para marcar alguém ou um setor, e / para marcar um pedido."
            : "Enter envia, Shift+Enter pula linha. Digite @ para marcar alguém ou um setor, e / para marcar um pedido."}
      </p>
      {pedir ? (
        <p className="mt-1.5 px-1 text-[0.68rem] leading-snug sm:hidden" style={{ color: COR_DO_TOM.atencao.texto }}>
          Esta mensagem vai pedir resposta e ficar no topo da sala até alguém responder.
        </p>
      ) : null}
    </div>
  );
}
