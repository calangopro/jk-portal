"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, CircleCheck, ListChecks, Loader2, Search, TriangleAlert, UserCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COR_DO_TOM } from "@/lib/painel/tons";
import {
  FILTROS, PERIODOS_DO_PEDIDO, TETO_DA_LISTA, donoDoPedido, intervaloDoPedido, lerPedidosDoSite, pecasEmPalavra, podeEscolherNaLeva,
  type FiltroDoVendedor, type ListaDePedidosDoSite, type PedidoDoSite, type PeriodoDoPedido,
} from "@/lib/pedidos/do-site";
import { SeloDeTom } from "../Pecas";
import { Ficha, botaoCheio, botaoClaro, campo } from "../biblioteca/pecas";
import { BotaoDoHistorico, aoMudarOPedido, avisarQueOPedidoMudou } from "../pedido/abrir";

/**
 * Os pedidos do site, para o vendedor ACHAR o que vendeu e marcar como dele.
 *
 * A loja não guarda quem vendeu. O vendedor fecha no WhatsApp, o cliente paga
 * pelo site, e sem a marcação a venda não entra no mês dele nem no ranking. A
 * tela abre nos pedidos pagos dos últimos 30 dias que NINGUÉM marcou, e a
 * busca acha por número, nome do cliente, telefone ou peça.
 *
 * O valor de cada pedido só aparece quando o pedido é da pessoa (régua do
 * banco, 0105): a lista inteira com valor deixaria somar o faturamento.
 *
 * Marcar é um toque ("Fui eu que vendi") ou vários de uma vez ("Marcar
 * vários"), sempre pela mesma porta do banco que a gaveta do histórico usa.
 */

type Marcacao = { ok: true; marcados: number; recusados: { numero: number; erro: string }[] } | { ok: false; erro: string };

export type ApiDosPedidos = {
  listar: (a: { busca: string; filtro: FiltroDoVendedor; de: string; ate: string }) => Promise<ListaDePedidosDoSite | null>;
  marcar: (numeros: number[], vendedor: string | null) => Promise<Marcacao>;
};

const SEM_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

const apiReal: ApiDosPedidos = {
  async listar(a) {
    try {
      const { data, error } = await createClient().rpc("pedidos_do_site", { p_busca: a.busca || null, p_filtro: a.filtro, p_de: a.de, p_ate: a.ate });
      return error ? null : lerPedidosDoSite(data);
    } catch {
      return null;
    }
  },
  async marcar(numeros, vendedor) {
    try {
      const { data, error } = await createClient().rpc("pedido_marcar_vendedor_em_leva", { p_numeros: numeros, p_vendedor: vendedor });
      if (error) return { ok: false, erro: SEM_REDE };
      const d = (data ?? {}) as { ok?: boolean; erro?: string; marcados?: number; recusados?: { numero: number; erro: string }[] };
      return d.ok ? { ok: true, marcados: Number(d.marcados) || 0, recusados: Array.isArray(d.recusados) ? d.recusados : [] } : { ok: false, erro: d.erro ?? "Não deu para marcar agora." };
    } catch {
      return { ok: false, erro: SEM_REDE };
    }
  },
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaCurto = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

export function TelaDosPedidos({ inicial, hoje, api = apiReal }: { inicial: ListaDePedidosDoSite | null; hoje: string; api?: ApiDosPedidos }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDoVendedor>("sem_vendedor");
  const [periodo, setPeriodo] = useState<PeriodoDoPedido>("30d");
  const [lista, setLista] = useState<ListaDePedidosDoSite | null>(inicial);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(inicial === null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [para, setPara] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<number | "leva" | null>(null);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);

  // A leitura mais nova vence: a resposta de uma busca antiga que chega depois não apaga a de agora.
  const vez = useRef(0);
  const ler = useCallback(async () => {
    const minha = ++vez.current;
    setCarregando(true);
    const { de, ate } = intervaloDoPedido(periodo, hoje);
    const r = await api.listar({ busca: busca.trim(), filtro, de, ate });
    if (minha !== vez.current) return;
    setCarregando(false);
    if (r) {
      setLista(r);
      setFalhou(false);
    } else {
      setFalhou(true);
    }
  }, [api, busca, filtro, periodo, hoje]);

  // Filtro e período leem na hora; a busca espera a pessoa parar de digitar. A primeira leitura veio do servidor.
  const primeira = useRef(true);
  const buscaAnterior = useRef(busca);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const digitou = buscaAnterior.current !== busca;
    buscaAnterior.current = busca;
    const id = setTimeout(() => void ler(), digitou ? 350 : 0);
    return () => clearTimeout(id);
  }, [ler, busca]);

  // Marcou pela gaveta do histórico: a lista refaz.
  useEffect(() => aoMudarOPedido(() => void ler()), [ler]);

  // Trocar de filtro, de período ou de busca desfaz a escolha da leva (o que estava escolhido pode não estar mais na tela).
  useEffect(() => {
    setEscolhidos(new Set());
    setConfirmando(false);
  }, [filtro, periodo, busca]);

  const pedidos = useMemo(() => lista?.pedidos ?? [], [lista]);
  const atribuir = lista?.pode.atribuir ?? false;
  const escolhiveis = pedidos.filter((p) => podeEscolherNaLeva(p, atribuir));
  const nomeDePara = lista?.vendedores.find((v) => v.id === para)?.nome ?? null;

  const marcar = async (numeros: number[], qual: number | "leva") => {
    setOcupado(qual);
    setAviso(null);
    const r = await api.marcar(numeros, qual === "leva" && para ? para : null);
    setOcupado(null);
    setConfirmando(false);
    if (!r.ok) return setAviso({ tom: "ruim", texto: r.erro });
    const dono = qual === "leva" && nomeDePara ? `de ${nomeDePara.split(/\s+/)[0]}` : "sua";
    const feito =
      r.marcados === 1 ? `Pedido marcado como venda ${dono}.` : r.marcados > 1 ? `${r.marcados} pedidos marcados como venda ${dono}.` : "Nenhum pedido marcado.";
    const recusa = r.recusados.length > 0 ? ` ${r.recusados.length === 1 ? "Um não foi" : `${r.recusados.length} não foram`}: ${r.recusados[0].erro}` : "";
    setAviso({ tom: r.recusados.length > 0 && r.marcados === 0 ? "ruim" : "bom", texto: `${feito}${r.marcados > 0 ? " Já conta no mês e no ranking." : ""}${recusa}` });
    setEscolhidos(new Set());
    if (qual === "leva") setEscolhendo(false);
    avisarQueOPedidoMudou();
  };

  const alternar = (n: number) =>
    setEscolhidos((s) => {
      const novo = new Set(s);
      if (novo.has(n)) novo.delete(n);
      else novo.add(n);
      return novo;
    });

  const contagem = lista
    ? lista.encontrados === 0
      ? null
      : `${lista.encontrados} ${lista.encontrados === 1 ? "pedido pago" : "pedidos pagos"}${filtro === "sem_vendedor" ? " sem vendedor" : filtro === "meus" ? " seus" : ""}${
          lista.encontrados > TETO_DA_LISTA ? `. Mostrando os ${TETO_DA_LISTA} mais recentes: busque pelo nome, telefone ou número` : ""
        }.`
    : null;

  return (
    <div className="min-w-0">
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Pedidos do site</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          A loja não guarda quem vendeu. Ache o pedido que você fechou e toque em &quot;Fui eu que vendi&quot;: ele entra no seu mês e no ranking.
        </p>
      </header>

      {/* Busca e filtros. */}
      <div className="glass mt-5 rounded-[18px] p-3.5 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Buscar pedido por número, nome do cliente, telefone ou peça</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número, nome, telefone ou peça"
            autoComplete="off"
            className={`${campo} pl-9`}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="De quem é o pedido">
          {FILTROS.map((f) => (
            <Ficha key={f.chave} ativa={filtro === f.chave} onClick={() => setFiltro(f.chave)}>
              {f.nome}
            </Ficha>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Período do pedido">
          {PERIODOS_DO_PEDIDO.map((p) => (
            <Ficha key={p.chave} ativa={periodo === p.chave} onClick={() => setPeriodo(p.chave)}>
              {p.nome}
            </Ficha>
          ))}
        </div>
        {busca.trim() && lista?.busca === "pedido" ? <p className="mt-2 text-xs text-muted">Busca pelo número: vale qualquer período.</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted" role="status" aria-live="polite">
          {carregando ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Buscando
            </span>
          ) : (
            contagem ?? ""
          )}
        </p>
        {escolhiveis.length > 0 && !escolhendo ? (
          <button type="button" onClick={() => setEscolhendo(true)} className={botaoClaro}>
            <ListChecks size={15} aria-hidden="true" /> Marcar vários
          </button>
        ) : null}
      </div>

      {aviso ? (
        <p
          role={aviso.tom === "ruim" ? "alert" : "status"}
          className="mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm leading-relaxed"
          style={{ background: COR_DO_TOM[aviso.tom].fundo, color: COR_DO_TOM[aviso.tom].texto }}
        >
          {aviso.tom === "bom" ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar o aviso" className="shrink-0">
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      ) : null}

      {falhou && !lista ? (
        <div className="glass mt-4 rounded-[16px] p-4" role="alert">
          <p className="text-sm font-semibold text-ink">Não deu para ler os pedidos agora.</p>
          <button type="button" onClick={() => void ler()} className={`${botaoCheio} mt-3`}>
            Tentar de novo
          </button>
        </div>
      ) : pedidos.length === 0 && !carregando ? (
        <div className="glass mt-4 rounded-[16px] p-5 text-sm leading-relaxed text-muted">
          {busca.trim()
            ? "Nenhum pedido pago com essa busca no período. Tente outro período ou só o primeiro nome."
            : filtro === "sem_vendedor"
              ? "Todo pedido pago do período já tem vendedor."
              : filtro === "meus"
                ? "Nenhum pedido marcado como seu neste período."
                : "Nenhum pedido pago neste período."}
        </div>
      ) : (
        <ul className={`mt-3 grid grid-cols-1 gap-3 ${carregando ? "opacity-60" : ""}`}>
          {pedidos.map((p) => (
            <Linha
              key={p.numero}
              p={p}
              escolhendo={escolhendo}
              escolhivel={podeEscolherNaLeva(p, atribuir)}
              escolhido={escolhidos.has(p.numero)}
              onAlternar={() => alternar(p.numero)}
              ocupado={ocupado === p.numero}
              onMarcar={() => void marcar([p.numero], p.numero)}
            />
          ))}
        </ul>
      )}

      {/* A leva: gruda em cima da barra de baixo no celular. Os botões ficam à esquerda, longe da bolha do chat no computador. */}
      {escolhendo ? (
        <div className="sticky bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-6">
          <div className="rounded-[18px] border border-ink/10 bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-ink">
              {escolhidos.size === 0 ? "Toque nos pedidos que você vendeu" : escolhidos.size === 1 ? "1 pedido escolhido" : `${escolhidos.size} pedidos escolhidos`}
            </p>
            {atribuir && lista && lista.vendedores.length > 0 ? (
              <label className="mt-2 block">
                <span className="sr-only">Marcar como venda de</span>
                <select
                  value={para}
                  onChange={(e) => {
                    setPara(e.target.value);
                    setConfirmando(false);
                  }}
                  className="h-10 w-full rounded-full border border-ink/15 bg-white px-3 text-base text-ink sm:w-auto sm:text-sm"
                >
                  <option value="">Marcar como venda minha</option>
                  {lista.vendedores
                    .filter((v) => v.id !== lista.eu)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        Marcar como venda de {v.nome}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={escolhidos.size === 0 || ocupado !== null}
                onClick={() => (confirmando ? void marcar([...escolhidos], "leva") : setConfirmando(true))}
                className={botaoCheio}
              >
                {ocupado === "leva" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={14} aria-hidden="true" />}
                {confirmando
                  ? `Confirmar: ${escolhidos.size} ${escolhidos.size === 1 ? "pedido" : "pedidos"}`
                  : nomeDePara
                    ? `Marcar para ${nomeDePara.split(/\s+/)[0]}`
                    : "Marcar como meus"}
              </button>
              {escolhiveis.length > 0 && escolhidos.size < escolhiveis.length ? (
                <button type="button" onClick={() => setEscolhidos(new Set(escolhiveis.map((p) => p.numero)))} className={botaoClaro}>
                  Escolher os {escolhiveis.length} da tela
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEscolhendo(false);
                  setEscolhidos(new Set());
                  setConfirmando(false);
                }}
                className={botaoClaro}
              >
                Cancelar
              </button>
            </div>
            {confirmando ? <p className="mt-2 text-xs text-muted">Toque de novo para confirmar. Quem errar pede à gerência para trocar.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Linha({
  p, escolhendo, escolhivel, escolhido, onAlternar, ocupado, onMarcar,
}: {
  p: PedidoDoSite;
  escolhendo: boolean;
  escolhivel: boolean;
  escolhido: boolean;
  onAlternar: () => void;
  ocupado: boolean;
  onMarcar: () => void;
}) {
  const dono = donoDoPedido(p);
  const lugar = [p.cidade, p.uf ? `(${p.uf})` : null].filter(Boolean).join(" ");
  return (
    <li className={`glass relative min-w-0 rounded-[16px] p-3.5 ${escolhido ? "outline outline-2 outline-[var(--setor)]" : ""}`}>
      {/* Escolhendo, o cartão inteiro é o botão: ninguém acerta uma caixinha de 20 px com o celular numa mão. */}
      {escolhendo && escolhivel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={escolhido}
          aria-label={`Escolher o pedido ${p.numero}${p.cliente ? `, ${p.cliente}` : ""}`}
          onClick={onAlternar}
          className="absolute inset-0 z-10 rounded-[16px]"
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-start gap-2.5">
          {escolhendo && escolhivel ? (
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-2 ${escolhido ? "painel-aba-ativa border-transparent" : "border-ink/30 bg-white"}`}
            >
              {escolhido ? <CheckCheck size={14} strokeWidth={3} /> : null}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight text-ink">
              Pedido <span className="numeros">{p.numero}</span>
              <span className="ml-2 text-xs font-normal text-muted">{diaCurto(p.dia)}</span>
            </p>
            <p className="mt-0.5 text-sm leading-snug text-ink [overflow-wrap:anywhere]">
              {p.cliente ?? "Cliente sem nome"}
              {lugar ? <span className="text-muted">, {lugar}</span> : null}
            </p>
          </div>
        </div>
        <SeloDeTom tom={dono.tom}>{dono.palavra}</SeloDeTom>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted [overflow-wrap:anywhere]">{pecasEmPalavra(p)}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {p.total !== null ? <span className="numeros mr-auto text-sm font-semibold text-ink">{reais(p.total)}</span> : null}
        {!p.vendedor && !p.meu && !escolhendo ? (
          <button type="button" disabled={ocupado} onClick={onMarcar} className={botaoCheio}>
            {ocupado ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />} Fui eu que vendi
          </button>
        ) : null}
        {!escolhendo ? <BotaoDoHistorico numero={p.numero} rotulo="Histórico" className={botaoClaro} /> : null}
      </div>
    </li>
  );
}
