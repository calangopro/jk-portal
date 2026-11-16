"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { NOME_DA_CHEGADA, type CanalDeChegada } from "@/lib/origem/chegada";
import {
  agrupar,
  comoLigou,
  ehAnuncio,
  filtrar,
  nivelLigado,
  utmLegivel,
  type Agrupamento,
  type Grupo,
  type PedidoComOrigem,
} from "@/lib/origem/pedidos";
import type { Tom } from "@/lib/painel/tons";
import { SeloDeTom } from "../../Pecas";
import { abrirHistoricoDoPedido } from "../../pedido/abrir";

/**
 * A lista da tela de origem, que se vira em cinco: por anúncio, por conjunto,
 * por campanha, pela UTM como ela chegou e pedido a pedido.
 *
 * Tudo roda no navegador, sobre a lista que a página já trouxe: trocar de aba,
 * buscar e filtrar não vão ao servidor. Clicar num pedido abre a gaveta dele
 * (`pedido/abrir.tsx`), que mostra todas as chegadas do visitante.
 *
 * No celular não há tabela: cada linha é um cartão. Tabela com largura mínima
 * estoura a página em 375 px (está no CLAUDE.md).
 */

const ABAS: { chave: Agrupamento | "pedido"; nome: string }[] = [
  { chave: "anuncio", nome: "Por anúncio" },
  { chave: "conjunto", nome: "Por conjunto" },
  { chave: "campanha", nome: "Por campanha" },
  { chave: "utm", nome: "Pela UTM" },
  { chave: "pedido", nome: "Pedido a pedido" },
];

const POR_VEZ = 40;
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeDoCanal = (c: string | null) => (c ? (NOME_DA_CHEGADA[c as CanalDeChegada] ?? c) : "Sem chegada anotada");
const PLATAFORMA = { meta: "Meta", google: "Google Ads" } as const;
const SITUACAO: Record<PedidoComOrigem["situacao"], { nome: string; tom: Tom }> = {
  pago: { nome: "Pago", tom: "bom" },
  aguardando: { nome: "Aguardando", tom: "atencao" },
  cancelado: { nome: "Cancelado", tom: "ruim" },
};

const diaEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function BotaoDoPedido({ numero, className }: { numero: number; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => abrirHistoricoDoPedido(numero, e.currentTarget)}
      title="Abrir o pedido: status, envio, fábrica, suporte e todas as chegadas"
      className={className ?? "numeros painel-toque rounded-full border border-ink/12 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-ink/[0.04]"}
    >
      {numero}
    </button>
  );
}

/** As UTMs do pedido, uma por linha, com o nome do campo: é o que a pessoa veio consultar. */
function Utms({ p }: { p: PedidoComOrigem }) {
  const campos: [string, string | null][] = [
    ["origem", [utmLegivel(p.source), utmLegivel(p.medium)].filter(Boolean).join(" / ") || null],
    ["campanha", utmLegivel(p.campaign)],
    ["conjunto", utmLegivel(p.term)],
    ["anúncio", utmLegivel(p.content)],
  ];
  const cheios = campos.filter(([, v]) => v);
  if (cheios.length === 0) return <span className="text-xs text-muted">{p.canal ? "Chegada sem UTM" : "Sem chegada anotada"}</span>;
  return (
    <dl className="space-y-0.5 text-xs leading-snug">
      {cheios.map(([nome, v]) => (
        <div key={nome} className="flex gap-1.5">
          <dt className="shrink-0 text-muted">{nome}</dt>
          <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A que campanha, conjunto e anúncio a UTM foi ligada, e por quê. */
function Ligacao({ p }: { p: PedidoComOrigem }) {
  const nivel = nivelLigado(p);
  if (!nivel) {
    return <p className="text-xs leading-snug text-muted">{comoLigou(p)}</p>;
  }
  const tom: Tom = nivel === "anuncio" ? "bom" : "atencao";
  const palavra = nivel === "anuncio" ? "Anúncio exato" : nivel === "conjunto" ? "Até o conjunto" : "Só a campanha";
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SeloDeTom tom={tom}>{palavra}</SeloDeTom>
        {p.plataforma ? <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{PLATAFORMA[p.plataforma]}</span> : null}
      </p>
      <p className="mt-1 text-xs leading-snug text-ink [overflow-wrap:anywhere]">
        {[p.campanhaNome, p.conjuntoNome, p.anuncioNome].filter(Boolean).join(" › ")}
      </p>
      <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{comoLigou(p)}</p>
    </div>
  );
}

function CartaoDoPedido({ p }: { p: PedidoComOrigem }) {
  const s = SITUACAO[p.situacao];
  return (
    <li className="border-b border-border/60 py-3.5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <BotaoDoPedido numero={p.pedido} />
        <SeloDeTom tom={s.tom} titulo={p.status ?? undefined}>{s.nome}</SeloDeTom>
        <span className="numeros text-sm font-semibold text-ink">{reais(p.total)}</span>
        <span className="text-xs text-muted">{diaEHora(p.feitoEm)}</span>
      </div>
      <div className="mt-2.5 grid gap-x-6 gap-y-2.5 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{nomeDoCanal(p.canal)}</p>
          <p className="text-[0.7rem] leading-snug text-muted">
            {p.canal && p.canal !== "direto" ? (ehAnuncio(p) ? "Anúncio" : "Não é anúncio") : null}
            {p.chegadas > 1 ? `${p.canal && p.canal !== "direto" ? ", " : ""}${p.chegadas} chegadas em 30 dias` : null}
          </p>
          {p.etiqueta ? <p className="mt-0.5 text-[0.7rem] leading-snug text-muted [overflow-wrap:anywhere]">Etiqueta da Tray: {p.etiqueta}</p> : null}
        </div>
        <Utms p={p} />
        <Ligacao p={p} />
      </div>
    </li>
  );
}

function LinhaDoGrupo({ g, aba, aberto, alternar }: { g: Grupo; aba: Agrupamento; aberto: boolean; alternar: () => void }) {
  const titulo = aba === "canal" ? nomeDoCanal(g.titulo || null) : g.titulo;
  return (
    <li className="border-b border-border/60 last:border-0">
      <button type="button" onClick={alternar} aria-expanded={aberto} className="painel-toque flex w-full items-start gap-3 py-3 text-left">
        <ChevronDown size={16} aria-hidden className={`mt-0.5 shrink-0 text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{titulo}</span>
          {g.apoio || g.plataforma ? (
            <span className="mt-0.5 block text-xs leading-snug text-muted [overflow-wrap:anywhere]">
              {[g.plataforma ? PLATAFORMA[g.plataforma] : null, g.apoio].filter(Boolean).join(", ")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          <span className="numeros block text-sm font-semibold text-ink">{reais(g.valor)}</span>
          <span className="block text-xs text-muted">
            {g.pagos} {g.pagos === 1 ? "pago" : "pagos"} de {g.criados}
          </span>
        </span>
      </button>
      {aberto ? (
        <div className="flex flex-wrap gap-1.5 pb-3.5 pl-7">
          {g.pedidos.slice(0, 60).map((n) => (
            <BotaoDoPedido key={n} numero={n} />
          ))}
          {g.pedidos.length > 60 ? <span className="self-center text-xs text-muted">e mais {g.pedidos.length - 60}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export function ListaDeOrigem({
  pedidos, buscaInicial = "", abaInicial = "anuncio", soPagosInicial = true,
}: {
  pedidos: PedidoComOrigem[];
  /** Quem chega pelo link de um item da tabela de campanhas já vem com a busca feita. */
  buscaInicial?: string;
  abaInicial?: Agrupamento | "pedido";
  soPagosInicial?: boolean;
}) {
  const [aba, setAba] = useState<Agrupamento | "pedido">(abaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const [soPagos, setSoPagos] = useState(soPagosInicial);
  const [soAnuncio, setSoAnuncio] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [quantos, setQuantos] = useState(POR_VEZ);

  const visiveis = useMemo(() => {
    let l = soPagos ? pedidos.filter((p) => p.situacao === "pago") : pedidos;
    if (soAnuncio) l = l.filter(ehAnuncio);
    return filtrar(l, busca);
  }, [pedidos, soPagos, soAnuncio, busca]);

  const grupos = useMemo(() => (aba === "pedido" ? [] : agrupar(visiveis, aba)), [visiveis, aba]);
  const total = aba === "pedido" ? visiveis.length : grupos.length;

  const trocar = (chave: Agrupamento | "pedido") => {
    setAba(chave);
    setQuantos(POR_VEZ);
    setAbertos(new Set());
  };
  const alternar = (chave: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  const filtro = "painel-toque shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold";
  return (
    <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="Pedidos e de onde vieram">
      <div className="relative">
        <nav aria-label="Como juntar os pedidos" className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => trocar(a.chave)}
              aria-pressed={a.chave === aba}
              className={"shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold " + (a.chave === aba ? "painel-aba-ativa" : "text-muted hover:text-ink")}
            >
              {a.nome}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Buscar por pedido, UTM, campanha ou anúncio</span>
          <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setQuantos(POR_VEZ);
            }}
            placeholder="Buscar pedido, UTM, campanha ou anúncio"
            className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <button type="button" aria-pressed={soPagos} onClick={() => setSoPagos((v) => !v)} className={`${filtro} ${soPagos ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"}`}>
          Só pagos
        </button>
        <button type="button" aria-pressed={soAnuncio} onClick={() => setSoAnuncio((v) => !v)} className={`${filtro} ${soAnuncio ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"}`}>
          Só de anúncio
        </button>
      </div>

      <p className="mt-3 text-xs text-muted" role="status">
        {aba === "pedido"
          ? `${visiveis.length} ${visiveis.length === 1 ? "pedido" : "pedidos"}`
          : `${grupos.length} ${grupos.length === 1 ? "linha" : "linhas"}, ${visiveis.length} ${visiveis.length === 1 ? "pedido" : "pedidos"}`}
        {aba !== "pedido" ? ". Toque numa linha para ver os pedidos dela." : ". Toque no número para abrir o pedido."}
      </p>

      {total === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhum pedido com esses filtros.</p>
      ) : aba === "pedido" ? (
        <ul className="mt-1">
          {visiveis.slice(0, quantos).map((p) => (
            <CartaoDoPedido key={p.pedido} p={p} />
          ))}
        </ul>
      ) : (
        <ul className="mt-1">
          {grupos.slice(0, quantos).map((g) => (
            <LinhaDoGrupo key={g.chave} g={g} aba={aba} aberto={abertos.has(g.chave)} alternar={() => alternar(g.chave)} />
          ))}
        </ul>
      )}

      {total > quantos ? (
        <button type="button" onClick={() => setQuantos((q) => q + POR_VEZ)} className="painel-toque mt-4 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/[0.04]">
          Mostrar mais ({total - quantos})
        </button>
      ) : null}
    </section>
  );
}
