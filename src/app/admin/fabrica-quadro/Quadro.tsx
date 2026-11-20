"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flame, Loader2, Maximize, Minimize, Moon, MoreHorizontal, NotebookPen, Sun, Undo2, Wifi, WifiOff, X } from "lucide-react";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import {
  NOME_DO_TIPO, colunasDoQuadro, ehFinal, etapasAtivas, lerEntrega, lerEspecificacoes, nomeDaEtapa,
  proximaEtapa, situacaoDoPrazo, tempoNaEtapa, type Etapa, type EtapaDaFabrica,
} from "@/lib/fabrica/etapas";
import { aoAvisar, avisarOTime, useAoVivo, useLigacao } from "@/lib/time/ao-vivo";
import { AlteracoesDoTrabalho, type DarCiencia } from "../(painel)/fabrica/Alteracoes";
import { verFotoNaFabrica } from "../(painel)/fabrica/actions";
import { DaOs } from "../(painel)/fabrica/DaOs";
import { nomeLimpo } from "@/lib/vendas/origem";

/**
 * O quadro da fábrica em tela cheia, no jeito de painel de cozinha.
 *
 * Feito para a TV da fábrica e para o tablet da bancada, com a peça na outra
 * mão: o número da OS é ENORME, o botão de avançar ocupa a largura do cartão e
 * leva para a etapa seguinte num toque. Os três pontos abrem a lista para
 * pular etapa. Depois de mover, "Desfazer" fica dez segundos na tela.
 *
 * O cartão não mostra nome nem telefone de cliente, nem valor: a TV fica à
 * vista de quem passa. Mostra o que a bancada precisa: peça, numeração, o
 * texto da gravação por extenso, entrega, prazo e a anotação.
 *
 * AO VIVO pelo canal do time (`painel:time`): quem move avisa "fila-da-fabrica"
 * e as outras telas releem. O canal é acelerador, não alicerce: sem ele o
 * quadro relê a cada 30 segundos (a cada 2 minutos com ele ligado).
 *
 * A mudança aparece na hora e vai ao banco depois; se o banco recusar, o
 * trabalho volta para onde estava e a mensagem aparece.
 */
type Mover = (ref: string, etapa: string, extras?: { rastreio?: string; nota?: string }) => Promise<{ ok: true } | { ok: false; erro: string }>;

/** A sala do aviso no canal do time. Não é sala do chat: ninguém escreve nela. */
const SALA = "fila-da-fabrica";
const DESFAZER_MS = 10_000;

type Desfeito = { ref: string; os: number | null; de: Etapa; para: Etapa; ate: number };

function lerTema(): "claro" | "escuro" {
  try {
    return localStorage.getItem("jk:quadro:tema") === "escuro" ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

export function QuadroDaFabrica({
  fila, hoje, so, meuId, mover, ciente, aoVivo = true,
}: {
  fila: FilaDaFabrica | null;
  hoje: string;
  /** As etapas da estação (`?so=`). Vazio: todas. */
  so: Etapa[];
  meuId: string | null;
  mover: Mover;
  ciente: DarCiencia;
  /** Falso na demonstração, que não tem sessão. */
  aoVivo?: boolean;
}) {
  const router = useRouter();
  const [, comecar] = useTransition();
  const [pedidos, setPedidos] = useState<PedidoDaFabrica[]>(fila?.pedidos ?? []);
  const [aberto, setAberto] = useState<string | null>(null);
  const [desfazer, setDesfazer] = useState<Desfeito | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<Set<string>>(() => new Set());
  const [agora, setAgora] = useState(() => Date.now());
  const [cheia, setCheia] = useState(false);
  const [tema, setTema] = useState<"claro" | "escuro">("claro");
  const lidoEm = useRef(Date.now());
  const etapas = useMemo(() => fila?.etapas ?? [], [fila]);

  // A leitura nova do servidor manda, menos no que está indo ao banco agora.
  useEffect(() => {
    lidoEm.current = Date.now();
    setPedidos((antes) => {
      const vindo = fila?.pedidos ?? [];
      if (movendo.size === 0) return vindo;
      const meus = new Map(antes.filter((p) => movendo.has(p.ref)).map((p) => [p.ref, p]));
      return vindo.map((p) => meus.get(p.ref) ?? p);
    });
    // `movendo` fica de fora de propósito: só a leitura nova do servidor dispara a troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila]);

  useEffect(() => setTema(lerTema()), []);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Ao vivo: o aviso de outra tela, ou o canal voltando, relê a fila.
  useAoVivo(meuId, aoVivo);
  const ligacao = useLigacao();
  const reler = useCallback(() => router.refresh(), [router]);
  useEffect(
    () =>
      aoAvisar((a) => {
        if ((a.tipo === "mensagem" && a.sala === SALA) || a.tipo === "voltou") reler();
      }),
    [reler],
  );
  useEffect(() => {
    if (!aoVivo) return;
    const passo = ligacao.estado === "ao_vivo" ? 120_000 : 30_000;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lidoEm.current >= passo - 1000) reler();
    }, passo);
    return () => clearInterval(t);
  }, [aoVivo, ligacao.estado, reler]);

  useEffect(() => {
    const aoMudar = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  useEffect(() => {
    if (!desfazer) return;
    const t = setTimeout(() => setDesfazer(null), Math.max(0, desfazer.ate - Date.now()));
    return () => clearTimeout(t);
  }, [desfazer]);

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const alternarTema = () => {
    const novo = tema === "escuro" ? "claro" : "escuro";
    setTema(novo);
    try {
      localStorage.setItem("jk:quadro:tema", novo);
    } catch {
      // Sem armazenamento, o tema vale só nesta visita.
    }
  };

  const levar = (p: PedidoDaFabrica, para: Etapa, comDesfazer = true) => {
    const de = p.etapa;
    if (de === para) return;
    setErro(null);
    setAberto(null);
    setMovendo((m) => new Set(m).add(p.ref));
    setPedidos((l) => l.map((x) => (x.ref === p.ref ? { ...x, etapa: para, etapaEm: new Date().toISOString() } : x)));
    comecar(async () => {
      const r = await mover(p.ref, para);
      setMovendo((m) => {
        const n = new Set(m);
        n.delete(p.ref);
        return n;
      });
      if (!r.ok) {
        setPedidos((l) => l.map((x) => (x.ref === p.ref ? { ...x, etapa: de, etapaEm: p.etapaEm } : x)));
        setErro(`OS ${p.os ?? p.ref}: ${r.erro}`);
        return;
      }
      setDesfazer(comDesfazer ? { ref: p.ref, os: p.os, de, para, ate: Date.now() + DESFAZER_MS } : null);
      avisarOTime(SALA);
      reler();
    });
  };

  const colunas = useMemo(() => colunasDoQuadro(etapas, pedidos, hoje, so), [etapas, pedidos, hoje, so]);
  const umaSo = colunas.length === 1;
  const escuro = tema === "escuro";
  const naBancada = pedidos.filter((p) => !ehFinal(p.etapa)).length;
  const pedidoAberto = aberto ? pedidos.find((p) => p.ref === aberto) ?? null : null;

  const cor = escuro
    ? { fundo: "#14161a", coluna: "#1d2026", cartao: "#262a31", texto: "#f3f1ec", apagado: "#a9adb5", borda: "#353a43" }
    : { fundo: "#efebe3", coluna: "#e4dfd5", cartao: "#ffffff", texto: "#1a1815", apagado: "#5d5850", borda: "#d6d0c4" };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ background: cor.fundo, color: cor.texto }}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6" style={{ borderBottom: `1px solid ${cor.borda}` }}>
        <Link
          href="/admin/fabrica"
          className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
          style={{ border: `1px solid ${cor.borda}`, background: cor.cartao }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Sair do quadro
        </Link>
        <h1 className="text-lg font-bold sm:text-xl">
          Quadro da fábrica
          {so.length > 0 ? <span className="ml-2 text-sm font-semibold" style={{ color: cor.apagado }}>{so.map((e) => nomeDaEtapa(e, etapas)).join(" e ")}</span> : null}
        </h1>
        <p className="numeros text-sm font-semibold" style={{ color: cor.apagado }}>
          {naBancada} na fábrica
        </p>
        <div className="ml-auto flex items-center gap-2">
          {aoVivo ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: cor.apagado }} title={ligacao.estado === "ao_vivo" ? "Ao vivo" : "Sem ligação ao vivo: relendo a cada 30 segundos"}>
              {ligacao.estado === "ao_vivo" ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
              <span className="hidden sm:inline">{ligacao.estado === "ao_vivo" ? "Ao vivo" : ligacao.estado === "fora" ? "Relendo a cada 30 s" : "Ligando"}</span>
            </span>
          ) : null}
          <Estacao etapas={etapas} so={so} cor={cor} />
          <button type="button" onClick={alternarTema} aria-label={escuro ? "Tema claro" : "Tema escuro"} className="painel-toque inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ border: `1px solid ${cor.borda}`, background: cor.cartao }}>
            {escuro ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <button type="button" onClick={alternarTelaCheia} className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold" style={{ border: `1px solid ${cor.borda}`, background: cor.cartao }}>
            {cheia ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
            <span className="hidden sm:inline">{cheia ? "Sair da tela cheia" : "Tela cheia"}</span>
          </button>
        </div>
      </header>

      {fila === null ? (
        <p className="m-6 text-base font-semibold">Não deu para ler a fila agora. A tela tenta de novo sozinha em alguns segundos.</p>
      ) : (
        <main
          className={umaSo ? "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" : "flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 sm:p-4"}
          aria-label="Etapas da fábrica"
        >
          {colunas.map(({ etapa, trabalhos }) => (
            <section
              key={etapa.chave}
              aria-label={`${etapa.nome}, ${trabalhos.length}`}
              className={umaSo ? "" : "flex w-[19rem] shrink-0 flex-col rounded-[18px] sm:w-[21rem]"}
              style={umaSo ? undefined : { background: cor.coluna }}
            >
              <h2 className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3 text-base font-bold" style={{ borderTop: `5px solid ${etapa.cor}`, borderRadius: umaSo ? 0 : "18px 18px 0 0" }}>
                <span className="min-w-0 flex-1 truncate">{etapa.nome}</span>
                <span className="numeros rounded-full px-2.5 py-0.5 text-lg" style={{ background: etapa.cor, color: "#fff" }}>{trabalhos.length}</span>
              </h2>
              {ehFinal(etapa.chave) ? <p className="px-3 pb-2 text-xs" style={{ color: cor.apagado }}>Só os de hoje</p> : null}
              <ol className={umaSo ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3"}>
                {trabalhos.length === 0 ? (
                  <li className="px-2 py-6 text-center text-sm" style={{ color: cor.apagado }}>Nada aqui agora.</li>
                ) : (
                  trabalhos.map((p) => (
                    <Cartao
                      key={p.ref}
                      p={p}
                      etapas={etapas}
                      hoje={hoje}
                      agora={agora}
                      cor={cor}
                      ocupado={movendo.has(p.ref)}
                      ciente={ciente}
                      onAvancar={(para) => levar(p, para)}
                      onAbrir={() => setAberto(p.ref)}
                    />
                  ))
                )}
              </ol>
            </section>
          ))}
        </main>
      )}

      {erro ? (
        <p role="alert" className="absolute inset-x-4 bottom-4 mx-auto flex max-w-xl items-center gap-3 rounded-[14px] px-4 py-3 text-sm font-semibold shadow-lg" style={{ background: "#fde8e8", color: "#9b1c1c" }}>
          <span className="min-w-0 flex-1">{erro}</span>
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso" className="shrink-0"><X size={16} aria-hidden="true" /></button>
        </p>
      ) : desfazer ? (
        <div role="status" className="absolute inset-x-4 bottom-4 mx-auto flex max-w-xl items-center gap-3 rounded-[14px] px-4 py-3 text-sm font-semibold shadow-lg" style={{ background: "#1a1815", color: "#fff" }}>
          <span className="min-w-0 flex-1">
            {desfazer.os ? `OS ${desfazer.os}` : "O trabalho"} foi para {nomeDaEtapa(desfazer.para, etapas)}.
          </span>
          <button
            type="button"
            onClick={() => {
              const p = pedidos.find((x) => x.ref === desfazer.ref);
              setDesfazer(null);
              if (p) levar(p, desfazer.de, false);
            }}
            className="painel-toque inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-[#1a1815]"
          >
            <Undo2 size={15} aria-hidden="true" /> Desfazer
          </button>
        </div>
      ) : null}

      {pedidoAberto ? (
        <Mudar p={pedidoAberto} etapas={etapas} cor={cor} onLevar={(para) => levar(pedidoAberto, para)} onFechar={() => setAberto(null)} />
      ) : null}
    </div>
  );
}

type Cores = { fundo: string; coluna: string; cartao: string; texto: string; apagado: string; borda: string };

const COR_DA_PRIORIDADE = { urgente: { fundo: "#fde8e8", texto: "#9b1c1c" }, motoboy: { fundo: "#fdeedc", texto: "#8a3b06" } } as const;
const COR_DO_TOM = { ruim: { fundo: "#fde8e8", texto: "#9b1c1c" }, atencao: { fundo: "#fcefd9", texto: "#7a3d06" } } as const;

function Cartao({
  p, etapas, hoje, agora, cor, ocupado, ciente, onAvancar, onAbrir,
}: {
  p: PedidoDaFabrica;
  etapas: EtapaDaFabrica[];
  hoje: string;
  agora: number;
  cor: Cores;
  ocupado: boolean;
  ciente: DarCiencia;
  onAvancar: (para: Etapa) => void;
  onAbrir: () => void;
}) {
  const proximaChave = proximaEtapa(etapas, p.etapa);
  const proxima = proximaChave ? etapas.find((e) => e.chave === proximaChave) ?? null : null;
  const prazo = situacaoDoPrazo(p, hoje);
  const corDoPrazo = prazo && prazo.tom !== "neutro" && prazo.tom !== "bom" ? COR_DO_TOM[prazo.tom] : null;
  const prioridade = p.prioridade === "normal" ? null : COR_DA_PRIORIDADE[p.prioridade];
  const entrega = lerEntrega(p.entrega);
  const tempo = tempoNaEtapa(p.etapaEm, agora);

  return (
    <li className="overflow-hidden rounded-[14px] shadow-sm" style={{ background: cor.cartao, border: `1px solid ${cor.borda}`, opacity: ocupado ? 0.7 : 1 }}>
      {prioridade ? (
        <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ background: prioridade.fundo, color: prioridade.texto }}>
          <Flame size={13} aria-hidden="true" /> {p.prioridade === "motoboy" ? "Motoboy, precisa no dia" : "Urgente"}
          {p.tipo !== "venda_nova" ? ` / ${NOME_DO_TIPO[p.tipo]}` : ""}
        </p>
      ) : p.tipo !== "venda_nova" ? (
        <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ background: "#fdeedc", color: "#8a3b06" }}>{NOME_DO_TIPO[p.tipo]}</p>
      ) : null}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="numeros text-[2.6rem] font-black leading-none tracking-tight">{p.os ?? "sem OS"}</p>
            <p className="numeros mt-1 text-sm font-semibold" style={{ color: cor.apagado }}>
              {p.pedido !== null
                ? `Pedido ${p.pedido}`
                : p.origem === "avulso"
                  ? `${NOME_DO_TIPO[p.tipo]}${p.pedidoOrigem ? ` do pedido ${p.pedidoOrigem}` : ""}`
                  : p.vendedor ? `Venda por fora, ${p.vendedor}` : "Venda por fora"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {tempo ? <span className="numeros text-xs font-semibold" style={{ color: cor.apagado }}>há {tempo}</span> : null}
            {prazo ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={corDoPrazo ? { background: corDoPrazo.fundo, color: corDoPrazo.texto } : { color: cor.apagado }}>
                {prazo.palavra}
              </span>
            ) : null}
          </div>
        </div>

        <ul className="mt-2 space-y-2">
          {p.pecas.map((peca, i) => {
            const esp = lerEspecificacoes(peca.info);
            const aros = esp.filter((e) => e.tipo === "aro");
            const gravar = esp.filter((e) => e.tipo === "gravar");
            return (
              <li key={i} className="text-sm leading-snug">
                <p className="font-semibold">
                  <span className="numeros">{peca.quantidade}×</span> {nomeLimpo(peca.nome)}
                </p>
                {aros.length ? (
                  <p className="numeros mt-0.5 text-base font-bold">
                    Aro {aros.map((a) => a.valor).join(" e ")}
                  </p>
                ) : null}
                {gravar.map((g, j) => (
                  // O texto a gravar sai EXATAMENTE como o cliente escreveu.
                  <p key={j} className="mt-1 rounded-[8px] px-2 py-1 text-sm font-semibold [overflow-wrap:anywhere]" style={{ border: `1px dashed ${cor.borda}` }}>
                    <span className="mr-1 text-[0.65rem] font-bold uppercase" style={{ color: cor.apagado }}>Gravar</span>
                    {g.valor}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>

        {entrega ? <p className="mt-2 text-xs font-semibold" style={{ color: cor.apagado }}>{entrega.nome}</p> : null}
        <AlteracoesDoTrabalho lista={p.alteracoes} ciente={ciente} grande />
        <DaOs p={p} verFoto={verFotoNaFabrica} escuro={cor.fundo === "#14161a"} />
        {p.nota ? (
          <p className="mt-2 flex gap-1.5 rounded-[8px] px-2 py-1.5 text-xs font-semibold" style={{ background: "#fcefd9", color: "#6d3505" }}>
            <NotebookPen size={13} className="mt-px shrink-0" aria-hidden="true" /> <span className="[overflow-wrap:anywhere]">{p.nota}</span>
          </p>
        ) : null}

        {ehFinal(p.etapa) ? null : (
          <div className="mt-3 flex gap-2">
            {proxima ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onAvancar(proxima.chave)}
                className="painel-toque inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 text-base font-bold text-white disabled:opacity-60"
                style={{ background: proxima.cor }}
              >
                {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                <span className="truncate">{proxima.nome}</span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={ocupado}
              onClick={onAbrir}
              aria-label={`Mais etapas para a OS ${p.os ?? p.ref}`}
              className="painel-toque inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] disabled:opacity-60"
              style={{ border: `1px solid ${cor.borda}` }}
            >
              <MoreHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/** A lista para pular etapa (ou voltar), aberta pelos três pontos. */
function Mudar({ p, etapas, cor, onLevar, onFechar }: { p: PedidoDaFabrica; etapas: EtapaDaFabrica[]; cor: Cores; onLevar: (para: Etapa) => void; onFechar: () => void }) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Levar a OS ${p.os ?? p.ref} para`} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onFechar}>
      <div className="w-full max-w-lg rounded-[20px] p-4" style={{ background: cor.cartao, color: cor.texto }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-bold">
            Levar a OS <span className="numeros">{p.os ?? p.ref}</span> para
          </p>
          <button ref={fechar} type="button" onClick={onFechar} aria-label="Fechar" className="painel-toque inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ border: `1px solid ${cor.borda}` }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm" style={{ color: cor.apagado }}>Agora em {nomeDaEtapa(p.etapa, etapas)}.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {etapasAtivas(etapas).filter((e) => e.chave !== p.etapa).map((e) => (
            <button
              key={e.chave}
              type="button"
              onClick={() => onLevar(e.chave)}
              className="painel-toque flex h-14 items-center gap-2 rounded-[12px] px-3 text-left text-sm font-bold"
              style={{ border: `1px solid ${cor.borda}` }}
            >
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.cor }} />
              <span className="min-w-0 truncate">{e.nome}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Escolher a estação: todas as etapas, ou só uma (o endereço vira favorito no tablet daquela bancada). */
function Estacao({ etapas, so, cor }: { etapas: EtapaDaFabrica[]; so: Etapa[]; cor: Cores }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">Estação</span>
      <select
        value={so.length === 1 ? so[0] : ""}
        onChange={(e) => router.replace(e.target.value ? `?so=${e.target.value}` : "?", { scroll: false })}
        className="h-10 max-w-[11rem] rounded-full px-3 text-sm font-semibold"
        style={{ border: `1px solid ${cor.borda}`, background: cor.cartao, color: cor.texto }}
      >
        <option value="">Todas as etapas</option>
        {etapasAtivas(etapas).filter((e) => e.chave !== "entregue").map((e) => (
          <option key={e.chave} value={e.chave}>Só {e.nome}</option>
        ))}
      </select>
    </label>
  );
}
