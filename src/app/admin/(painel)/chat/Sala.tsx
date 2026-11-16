"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Check, ChevronDown, ChevronUp, CornerUpLeft, Loader2, MessageCircleQuestion, TriangleAlert, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { NOME_DA_SALA, SALAS, esperaDoPedido, limitesPorExtenso, rascunhoDaResposta, trechoDe, type Sala } from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";
import { FormularioDeResposta } from "../biblioteca/FormularioDeResposta";
import { botaoClaro } from "../biblioteca/pecas";
import { Conversa } from "./Conversa";
import { Escrever } from "./Escrever";
import type { Chat } from "./useChat";

/**
 * A sala aberta, desenhada: a faixa dos pedidos que esperam, a conversa que
 * rola, o aviso de erro e o campo de escrever (ou, no lugar disso tudo, o
 * formulário de guardar na biblioteca).
 *
 * É a mesma peça na tela cheia e na janela flutuante. A diferença é só
 * `compacta`: na janela, o campo de escrever esconde o texto de apoio e a
 * faixa dos pedidos começa fechada, porque a largura é a de um celular mesmo
 * no computador.
 *
 * O QUE CONTA COMO LIDO é decidido aqui, porque depende da rolagem: a sala
 * aberta (esta peça na tela), com a aba à vista e a conversa no fim. Quem
 * subiu para ler mensagem antiga não marca como lido o que chegou embaixo. Na
 * janela flutuante, esta peça só existe com a janela aberta e a sala na
 * frente: fechada, ou na lista de salas, ela não lê nada.
 */
export function SalaDoChat({ c, compacta = false, souAdmin }: { c: Chat; compacta?: boolean; souAdmin: boolean }) {
  const { sala } = c;

  // A lista dos pedidos que esperam começa fechada; na tela cheia do computador, onde sobra altura, abre sozinha.
  const [verPedidos, setVerPedidos] = useState(false);
  useEffect(() => {
    setVerPedidos(!compacta && window.matchMedia("(min-width: 64rem)").matches);
  }, [sala, compacta]);

  const [destaque, setDestaque] = useState<number | null>(null);

  // --------------------------------------------------------------- a rolagem

  const lista = useRef<HTMLDivElement>(null);
  const noFimAgora = useRef(true);
  const [noFim, setNoFim] = useState(true);
  const aoRolar = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    const fim = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    noFimAgora.current = fim;
    setNoFim(fim);
  }, []);
  const irParaOFim = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    noFimAgora.current = true;
    setNoFim(true);
  }, []);

  // Ao entrar numa sala (e ao a peça aparecer): para na linha "Novas mensagens", ou no fim quando está tudo lido.
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const novas = el.querySelector<HTMLElement>("[data-novas]");
    if (novas) el.scrollTop = Math.max(0, novas.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 28);
    else el.scrollTop = el.scrollHeight;
    aoRolar();
    // Só a troca de sala dispara: mensagem que chega é tratada logo abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala, c.guardando]);

  // Mensagem nova: acompanha quem está no fim, e sempre que a mensagem é da própria pessoa.
  const antes = useRef({ sala, ultimoId: c.ultimoId, indo: c.pendentesDaSala.length });
  useLayoutEffect(() => {
    const a = antes.current;
    antes.current = { sala, ultimoId: c.ultimoId, indo: c.pendentesDaSala.length };
    if (a.sala !== sala) return;
    if (c.ultimoId === a.ultimoId && c.pendentesDaSala.length === a.indo) return;
    const minha = c.daAberta[c.daAberta.length - 1]?.autor === c.meuId && c.ultimoId > a.ultimoId;
    if (noFimAgora.current || minha || c.pendentesDaSala.length > a.indo) irParaOFim();
  }, [sala, c.ultimoId, c.pendentesDaSala.length, c.daAberta, c.meuId, irParaOFim]);

  // "Carregar anteriores" põe mensagem em cima: a conversa não pode pular debaixo do olho.
  const ancora = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = lista.current;
    if (el && ancora.current !== null) el.scrollTop = el.scrollHeight - ancora.current;
    ancora.current = null;
  }, [c.janelas]);

  const irPara = useCallback((id: number) => {
    const el = lista.current?.querySelector<HTMLElement>(`[data-fala="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    setDestaque(id);
    setTimeout(() => setDestaque((d) => (d === id ? null : d)), 1800);
  }, []);

  // A mensagem para onde ir. Ela pode ainda estar chegando: tenta de novo a cada mudança da conversa, por alguns segundos.
  const { pular, setPular } = c;
  useEffect(() => {
    if (!pular) return;
    if (lista.current?.querySelector(`[data-fala="${pular.id}"]`)) {
      irPara(pular.id);
      setPular(null);
    } else if (Date.now() > pular.ate) {
      setPular(null);
    }
  }, [pular, setPular, c.daAberta, irPara]);

  // ------------------------------------------------------------------- o lido

  const { visivel, guardando, ultimoId, lidas, lerAte } = c;
  useEffect(() => {
    // A REFERÊNCIA, e não o estado `noFim`: ao entrar numa sala, este efeito roda antes de o estado acompanhar a rolagem nova, e
    // leria o "no fim" da sala anterior (ou o de quando a peça nasceu). Com o estado, trocar de sala marcava como lido o que estava
    // lá em cima, acima da linha "Novas mensagens". `noFim` continua nas dependências para o efeito rodar quando a pessoa chega ao fim.
    if (!visivel || !noFimAgora.current || guardando || ultimoId <= (lidas[sala] ?? 0)) return;
    lerAte(sala, ultimoId);
  }, [visivel, noFim, guardando, ultimoId, sala, lidas, lerAte]);

  // ------------------------------------------------------------------ o desenho

  const nomeDaSala = NOME_DA_SALA[sala];
  const apoioDaSala = SALAS.find((s) => s.chave === sala)?.resolve ?? "";

  if (guardando) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <button type="button" onClick={() => c.setGuardando(null)} className={botaoClaro}>
          <ArrowLeft size={14} aria-hidden="true" /> Voltar à conversa
        </button>
        <p className="mt-4 text-sm font-semibold text-ink">Guardar na biblioteca</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          A próxima pessoa encontra na busca e ninguém precisa responder outra vez. Entra como &quot;a confirmar&quot;.
        </p>
        <div className="mt-3">
          <FormularioDeResposta
            comOrigem={false}
            inicial={rascunhoDaResposta(guardando, c.mensagens)}
            rotuloDoBotao="Salvar na biblioteca"
            aviso={
              <p className="flex items-start gap-1.5 rounded-[10px] p-2.5 text-xs font-semibold leading-relaxed" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
                <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Tire nome, telefone e qualquer dado de cliente, e escreva a pergunta do jeito que serve para o próximo caso. A origem (esta conversa) é
                  escrita sozinha.
                </span>
              </p>
            }
            onSalvar={async (r) => {
              const feito = await c.api.guardarNaBiblioteca(guardando.id, r);
              if (!feito.ok) return feito;
              c.setGuardando(null);
              c.agendar();
              c.api.avisar(guardando.sala);
              return { ok: true };
            }}
            onCancelar={() => c.setGuardando(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {c.esperandoAqui.length > 0 ? (
        <div className="border-b border-ink/[0.07]" style={{ background: COR_DO_TOM.atencao.fundo }}>
          <button
            type="button"
            onClick={() => setVerPedidos((v) => !v)}
            aria-expanded={verPedidos}
            aria-controls="chat-pedidos"
            className="painel-toque flex w-full items-center gap-2 px-3.5 py-2 text-left sm:px-5"
            style={{ color: COR_DO_TOM.atencao.texto }}
          >
            <MessageCircleQuestion size={15} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-xs font-bold">
              {c.esperandoAqui.length === 1 ? "1 pedido esperando resposta nesta sala" : `${c.esperandoAqui.length} pedidos esperando resposta nesta sala`}
            </span>
            {!verPedidos && c.piorEspera ? <SeloDeTom tom={c.piorEspera.tom}>{c.piorEspera.palavra}</SeloDeTom> : null}
            {verPedidos ? <ChevronUp size={15} className="shrink-0" aria-hidden="true" /> : <ChevronDown size={15} className="shrink-0" aria-hidden="true" />}
          </button>
          {verPedidos ? (
            <div id="chat-pedidos" className="max-h-44 overflow-y-auto px-2.5 pb-2.5 sm:px-4">
              <ul className="space-y-1.5">
                {c.esperandoAqui.map((m) => {
                  const e = esperaDoPedido(m, c.agora);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[12px] bg-white px-3 py-2">
                      <p className="min-w-0 flex-1 basis-40 text-xs leading-snug text-ink">
                        <span className="font-bold">{m.autor === c.meuId ? "Você" : (m.autorNome ?? "Alguém do time")}:</span> {trechoDe(m, 120)}
                      </p>
                      {e ? <SeloDeTom tom={e.tom}>{e.palavra}</SeloDeTom> : null}
                      <span className="flex shrink-0 gap-1.5">
                        <button type="button" onClick={() => c.responderA(m)} className="painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink">
                          <CornerUpLeft size={12} aria-hidden="true" /> Responder
                        </button>
                        <button
                          type="button"
                          disabled={c.ocupada === m.id}
                          onClick={() => void c.aoAgir(m, "resolver")}
                          className="painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink disabled:opacity-60"
                        >
                          {c.ocupada === m.id ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />} Resolvido
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 px-1 text-[0.66rem] leading-snug" style={{ color: COR_DO_TOM.atencao.texto }}>
                {limitesPorExtenso()}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div ref={lista} onScroll={aoRolar} className="absolute inset-0 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-2 sm:px-5">
          {c.janelas[sala] !== undefined ? (
            <p className="flex justify-center pb-1 pt-1">
              <button
                type="button"
                disabled={c.carregando}
                onClick={() =>
                  void c.carregarAnteriores((s) => {
                    const el = lista.current;
                    ancora.current = el && s === sala ? el.scrollHeight - el.scrollTop : null;
                  })
                }
                className={botaoClaro}
              >
                {c.carregando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
                {c.carregando ? "Buscando" : "Carregar anteriores"}
              </button>
            </p>
          ) : null}

          {c.linhas.length === 0 && c.pendentesDaSala.length === 0 ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <p className="font-display text-xl text-ink">Ninguém escreveu em {nomeDaSala} ainda</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                  {apoioDaSala}. Escreva embaixo: todo o time lê, e quem estiver online recebe na hora. Se precisar de resposta, ligue &quot;Pedir
                  resposta&quot; e a mensagem fica à vista até alguém responder.
                </p>
              </div>
            </div>
          ) : (
            <Conversa
              linhas={c.linhas}
              pendentes={c.pendentesDaSala}
              meuId={c.meuId}
              meusSetores={c.abertura.setores}
              buscarPrevia={c.api.previaDoPedido}
              souAdmin={souAdmin}
              agora={c.agora}
              linkDe={c.linkDe}
              aberta={c.aberta}
              ocupada={c.ocupada}
              destaque={destaque}
              apagando={c.apagando}
              onAlternar={(id) => {
                c.setApagando(null);
                c.setAberta((a) => (a === id ? null : id));
              }}
              onAcao={(m, qual) => void c.aoAgir(m, qual)}
              onIrPara={irPara}
              onDeNovo={(p) => void c.despachar(p)}
              onDescartar={c.descartar}
            />
          )}
        </div>

        {noFim ? null : (
          <button
            type="button"
            onClick={irParaOFim}
            className="painel-toque absolute bottom-3 right-3 z-10 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-semibold text-white shadow-lg"
          >
            <ArrowDown size={14} aria-hidden="true" />
            {c.novasPorSala[sala] > 0 ? (c.novasPorSala[sala] === 1 ? "1 nova" : `${c.novasPorSala[sala]} novas`) : "Ir para o fim"}
          </button>
        )}
      </div>

      {c.aviso || c.semRede ? (
        <p role="alert" className="flex items-start gap-1.5 border-t border-ink/[0.07] px-3.5 py-2 text-xs font-semibold sm:px-5" style={{ background: COR_DO_TOM.ruim.fundo, color: COR_DO_TOM.ruim.texto }}>
          <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{c.aviso ?? "Sem resposta do servidor. A conversa pode estar atrasada; a tela tenta de novo sozinha."}</span>
          {c.aviso ? (
            <button type="button" onClick={() => c.setAviso(null)} aria-label="Fechar o aviso" className="shrink-0">
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </p>
      ) : null}

      <Escrever
        texto={c.texto}
        onTexto={c.setTexto}
        onEnviar={c.enviar}
        respondendo={c.respondendo}
        onCancelarResposta={() => c.setRespondendo(null)}
        pedir={c.pedir}
        onPedir={c.setPedir}
        imagens={c.imagens}
        sala={nomeDaSala}
        focar={c.focar}
        pessoas={c.abertura.pessoas}
        meuId={c.meuId}
        podeMeta={c.podeMeta}
        buscarPedidos={c.api.buscarPedidos}
        compacta={compacta}
      />
    </>
  );
}

/** Os números de uma sala na lista: pedidos esperando resposta e mensagens não lidas. A sala aberta não mostra as não lidas. */
export function EmblemaDaSala({ c, s, mesmoAberta = false }: { c: Chat; s: Sala; mesmoAberta?: boolean }) {
  const esperando = c.esperandoPorSala[s];
  const novas = c.novasPorSala[s];
  return (
    <>
      {esperando > 0 ? (
        <span
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold leading-none"
          style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}
          title={esperando === 1 ? "1 pedido esperando resposta" : `${esperando} pedidos esperando resposta`}
        >
          <MessageCircleQuestion size={10} aria-hidden="true" />
          {esperando}
          <span className="sr-only"> esperando resposta</span>
        </span>
      ) : null}
      {novas > 0 && (mesmoAberta || s !== c.sala) ? (
        <span className="shrink-0 rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">
          {novas > 99 ? "99+" : novas}
          <span className="sr-only"> não lidas</span>
        </span>
      ) : null}
    </>
  );
}
