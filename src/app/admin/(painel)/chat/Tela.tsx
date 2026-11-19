"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio, TriangleAlert, Users, WifiOff, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { Ligacao } from "@/lib/time/ao-vivo";
import { NOME_DA_SALA, SALAS, type Abertura, type EstadoDoAviso, type Sala } from "@/lib/time/chat";
import { botaoCheio, botaoClaro } from "../biblioteca/pecas";
import { apiDoChat, type ApiDoChat } from "./api";
import { AvisoDoSistema } from "./AvisoDoSistema";
import { ListaDePessoas, Ponto, resumoDaPresenca } from "./Pessoas";
import { EmblemaDaSala, SalaDoChat } from "./Sala";
import { useChat } from "./useChat";

/**
 * O chat do time em tela cheia: salas por setor, conversa ao vivo e quem está
 * online.
 *
 * A conversa em si (sincronia, envio, o que foi lido) mora em `useChat.ts`, e
 * a sala aberta em `Sala.tsx`: são as mesmas peças da janela flutuante que o
 * painel abre por cima de qualquer tela (`Janela.tsx`). Aqui fica só o que é
 * da tela cheia: as salas e as pessoas ao lado no computador, a fila de salas
 * que rola de lado no celular, e o aviso do sistema.
 *
 * As chamadas ao banco vêm de fora, como propriedade (`api`), para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 */

type Props = {
  abertura: Abertura | null;
  meuId: string;
  souAdmin: boolean;
  /** `?sala=`: a sala que abre primeiro. Sem ela, abre a que tem mensagem nova. */
  salaInicial: Sala | null;
  /** O começo da mensagem, quando a pessoa chega da consulta com uma peça citada. */
  rascunho: string;
  pedirDeInicio: boolean;
  /** `?m=`: a mensagem para onde ir (o link que a biblioteca guarda da conversa). */
  destaqueInicial: number | null;
  /** A pessoa pode ver a meta do mês (área de vendas): só ela consegue marcar a meta com "/meta". Quem confere de verdade é o banco. */
  podeMeta: boolean;
  api?: ApiDoChat;
  /** Só a prévia de desenvolvimento: uma ligação de mentira, com gente online. */
  ligacaoDaPrevia?: Ligacao;
  /** Não é mais usado desde o cartão 59 (o aviso por push lê o próprio aparelho); fica para a demonstração do Como usar. */
  avisoDaPrevia?: EstadoDoAviso;
};

export function TelaDoChat(p: Props) {
  const router = useRouter();
  if (!p.abertura) {
    return (
      <div className="glass rounded-[18px] p-5">
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: COR_DO_TOM.ruim.texto }}>
          <TriangleAlert size={16} aria-hidden="true" /> Não deu para abrir o chat agora
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">A conversa não foi lida. Costuma ser a conexão: tente de novo em alguns segundos.</p>
        <button type="button" onClick={() => router.refresh()} className={`${botaoCheio} mt-3`}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <Chat {...p} abertura={p.abertura} />;
}

function Chat({
  abertura, meuId, souAdmin, salaInicial, rascunho, pedirDeInicio, destaqueInicial, podeMeta, api = apiDoChat, ligacaoDaPrevia,
}: Props & { abertura: Abertura }) {
  const c = useChat({ abertura, meuId, salaInicial, rascunho, pedirDeInicio, destaqueInicial, podeMeta, api, ligacaoDaPrevia, lerRascunhoDoTutor: true });
  const { sala, ligacao, pessoas } = c;
  const [verPessoas, setVerPessoas] = useState(false);

  // No celular as salas rolam de lado: a sala aberta precisa estar à vista, e não escondida atrás da borda.
  const filaDeSalas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fila = filaDeSalas.current;
    const ficha = fila?.querySelector<HTMLElement>(`[data-sala="${sala}"]`);
    if (!fila || !ficha) return;
    // Conta feita à mão, e não `scrollIntoView`: aquele rola a página inteira junto.
    const sobra = fila.clientWidth - ficha.offsetWidth;
    fila.scrollLeft = Math.max(0, ficha.offsetLeft - fila.offsetLeft - sobra / 2);
  }, [sala]);

  // Ir até uma mensagem (o clique num aviso do sistema) também fecha a lista de pessoas, para a conversa aparecer.
  useEffect(() => {
    if (c.pular) setVerPessoas(false);
  }, [c.pular]);

  const nomeDaSala = NOME_DA_SALA[sala];
  const apoioDaSala = SALAS.find((s) => s.chave === sala)?.resolve ?? "";

  const estadoDaLigacao =
    ligacao.estado === "ao_vivo" ? (
      <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold" style={{ color: COR_DO_TOM.bom.texto }}>
        <Radio size={12} aria-hidden="true" /> Ao vivo
      </span>
    ) : ligacao.estado === "fora" ? (
      <span
        className="inline-flex items-center gap-1 text-[0.7rem] font-semibold"
        style={{ color: COR_DO_TOM.atencao.texto }}
        title="A ligação ao vivo não entrou. As mensagens chegam de tempos em tempos."
      >
        <WifiOff size={12} aria-hidden="true" /> Sem ligação ao vivo
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Ligando
      </span>
    );

  return (
    <div className="painel-chat flex gap-4">
      <h1 className="sr-only">Chat do time</h1>

      {/* Computador: as salas e quem está online, sempre à vista. */}
      <aside className="hidden w-60 shrink-0 flex-col gap-3 overflow-y-auto lg:flex" aria-label="Salas e pessoas">
        <nav className="glass rounded-[18px] p-2" aria-label="Salas">
          <ul>
            {SALAS.map((s) => (
              <li key={s.chave}>
                <button
                  type="button"
                  aria-current={s.chave === sala ? "true" : undefined}
                  onClick={() => c.trocarDeSala(s.chave)}
                  className={`painel-toque flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left ${s.chave === sala ? "painel-item-ativo" : "hover:bg-ink/[0.04]"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm leading-tight ${s.chave === sala ? "font-bold" : "font-semibold text-ink"}`}>{s.nome}</span>
                    <span className={`block truncate text-[0.68rem] leading-tight ${s.chave === sala ? "opacity-80" : "text-muted"}`}>{s.resolve}</span>
                  </span>
                  <EmblemaDaSala c={c} s={s.chave} />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="glass min-h-0 flex-1 overflow-y-auto rounded-[18px] p-3.5" aria-label="Quem está online">
          <ListaDePessoas pessoas={pessoas} meuId={meuId} estado={ligacao.estado} />
          <div className="mt-4">
            <AvisoDoSistema />
          </div>
        </section>
      </aside>

      <section className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px]" aria-label={`Sala ${nomeDaSala}`}>
        <header className="border-b border-ink/[0.07]">
          {/* Celular: uma linha só, com as salas numa fila que rola de lado e, presa à direita, quem está online. */}
          <div className="flex items-center gap-1.5 pr-2.5 lg:hidden">
            {/* `relative` de propósito: o texto só para leitor de tela é `absolute`, e sem um pai posicionado ele escapava do corte da fila e deixava o cartão inteiro rolar de lado. */}
            <div ref={filaDeSalas} role="group" aria-label="Salas" className="painel-fila relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2.5 pl-2.5 pr-1">
              {SALAS.map((s) => (
                <button
                  key={s.chave}
                  type="button"
                  data-sala={s.chave}
                  aria-pressed={s.chave === sala}
                  onClick={() => c.trocarDeSala(s.chave)}
                  className={`painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.82rem] font-semibold ${
                    s.chave === sala ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink/75"
                  }`}
                >
                  {s.nome}
                  <EmblemaDaSala c={c} s={s.chave} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setVerPessoas((v) => !v)}
              aria-expanded={verPessoas}
              aria-controls="chat-pessoas"
              className="painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 text-xs font-semibold text-ink"
            >
              {ligacao.estado === "ao_vivo" ? <Ponto presenca="online" /> : ligacao.estado === "fora" ? <WifiOff size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
              {resumoDaPresenca(pessoas, ligacao.estado)}
            </button>
          </div>
          {/* Computador: o nome da sala, o que ela resolve e o estado da ligação. */}
          <div className="hidden items-center gap-3 px-5 py-3 lg:flex">
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight text-ink">{nomeDaSala}</p>
              <p className="truncate text-xs leading-snug text-muted">{apoioDaSala}. Sala aberta: todo o time lê.</p>
            </div>
            <span className="shrink-0">{estadoDaLigacao}</span>
          </div>
        </header>

        {/* Celular: quem está online abre por cima da conversa. */}
        {verPessoas ? (
          <div id="chat-pessoas" className="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col bg-white lg:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink/[0.07] px-4 py-3">
              <p className="text-sm font-bold text-ink">Quem está online</p>
              <button type="button" onClick={() => setVerPessoas(false)} className={botaoClaro}>
                <X size={14} aria-hidden="true" /> Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ListaDePessoas pessoas={pessoas} meuId={meuId} estado={ligacao.estado} />
              <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">Online é estar com o painel aberto e à vista, em qualquer tela dele.</p>
              <div className="mt-4">
                <AvisoDoSistema />
              </div>
            </div>
          </div>
        ) : null}

        <SalaDoChat c={c} souAdmin={souAdmin} />
      </section>
    </div>
  );
}
