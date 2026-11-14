"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Search, Clock } from "lucide-react";
import type { ItemDoCatalogo, Padroes } from "@/lib/catalogo/fotos";
import { COR, ESTADOS, PONTO, RESOLVIDO, ROTULO, type EstadoDoProduto } from "@/lib/catalogo/estados";
import { Gaveta } from "./Gaveta";
import { LevarParaLoja } from "./LevarParaLoja";
import { ComoGerar } from "./ComoGerar";
import { digitando, reais, pct, type MargemNaLista } from "./util";

type Ordem = "vendidos" | "nome" | "preco-maior" | "preco-menor" | "menor-margem";
type FiltroDeMargem = "todas" | "sem_custo" | "abaixo" | "hoje_passa";
type Filtro = "todos" | EstadoDoProduto;

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: "vendidos", rotulo: "Mais vendidos" },
  { valor: "nome", rotulo: "Nome" },
  { valor: "preco-maior", rotulo: "Maior preço" },
  { valor: "preco-menor", rotulo: "Menor preço" },
  { valor: "menor-margem", rotulo: "Menor margem" },
];

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function ordenar(a: ItemDoCatalogo, b: ItemDoCatalogo, ordem: Ordem, margens: Record<string, MargemNaLista> | null) {
  switch (ordem) {
    case "menor-margem":
      return (margens?.[a.id]?.fracao ?? Infinity) - (margens?.[b.id]?.fracao ?? Infinity);
    case "nome":
      return a.nome.localeCompare(b.nome, "pt-BR");
    case "preco-maior":
      return (b.preco ?? 0) - (a.preco ?? 0);
    case "preco-menor":
      return (a.preco ?? Infinity) - (b.preco ?? Infinity);
    default:
      return b.vendidos - a.vendidos || a.nome.localeCompare(b.nome, "pt-BR");
  }
}

export function Catalogo({
  itens,
  padroes,
  margens = null,
  loja = null,
}: {
  itens: ItemDoCatalogo[];
  padroes: Padroes;
  /** Quem pode alterar a loja pelo painel. Nulo: a edição nem aparece na gaveta. */
  loja?: { podePreco: boolean } | null;
  /** Só para administrador. Nulo: a coluna e o filtro de margem nem aparecem. */
  margens?: Record<string, MargemNaLista> | null;
}) {
  const [filtroDeMargem, setFiltroDeMargem] = useState<FiltroDeMargem>("todas");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [soDisponiveis, setSoDisponiveis] = useState(true);
  const [ordem, setOrdem] = useState<Ordem>("vendidos");
  // Nulo = ninguém mexeu ainda, e só a primeira categoria (a que mais vende) abre.
  const [abertas, setAbertas] = useState<Set<string> | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // Estado mudado na gaveta antes do servidor devolver a lista nova.
  const [ajustes, setAjustes] = useState<Record<string, EstadoDoProduto>>({});
  const campoDeBusca = useRef<HTMLInputElement>(null);

  // A lista do servidor chegou de novo: os ajustes locais já estão nela.
  useEffect(() => setAjustes({}), [itens]);

  const comAjustes = useMemo(
    () => itens.map((p) => (ajustes[p.id] ? { ...p, estado: ajustes[p.id] } : p)),
    [itens, ajustes],
  );

  // Escopo das contagens: disponibilidade e busca, mas não o filtro de estado.
  const noEscopo = useMemo(() => {
    const termo = semAcento(busca.trim());
    const casaMargem = (p: ItemDoCatalogo) => {
      if (!margens || filtroDeMargem === "todas") return true;
      const m = margens[p.id];
      if (filtroDeMargem === "sem_custo") return !m || m.custo === null;
      if (filtroDeMargem === "abaixo") return Boolean(m?.abaixo);
      return Boolean(m?.hojePassa);
    };
    return comAjustes.filter(
      (p) =>
        (!soDisponiveis || p.disponivel) &&
        casaMargem(p) &&
        (!termo || semAcento(p.nome).includes(termo) || p.trayId === termo || semAcento(p.categoria).includes(termo)),
    );
  }, [comAjustes, busca, soDisponiveis, margens, filtroDeMargem]);

  const contagem = useMemo(() => {
    const c = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoDoProduto, number>;
    for (const p of noEscopo) c[p.estado]++;
    return c;
  }, [noEscopo]);

  const visiveis = useMemo(
    () => noEscopo.filter((p) => filtro === "todos" || p.estado === filtro),
    [noEscopo, filtro],
  );

  // Categorias na ordem do que mais vende: a primeira da tela é a que mais pesa.
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: ItemDoCatalogo[]; vendidos: number; total: number; resolvidos: number }>();
    for (const p of noEscopo) {
      const g = mapa.get(p.categoria) ?? { nome: p.categoria, itens: [], vendidos: 0, total: 0, resolvidos: 0 };
      g.total++;
      g.vendidos += p.vendidos;
      if (RESOLVIDO.has(p.estado)) g.resolvidos++;
      if (filtro === "todos" || p.estado === filtro) g.itens.push(p);
      mapa.set(p.categoria, g);
    }
    return Array.from(mapa.values())
      .filter((g) => g.itens.length > 0)
      .sort((a, b) => b.vendidos - a.vendidos || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((g) => ({ ...g, itens: [...g.itens].sort((a, b) => ordenar(a, b, ordem, margens)) }));
  }, [noEscopo, filtro, ordem, margens]);

  // Busca ou filtro ligado abre tudo que casou; sem eles, a pessoa decide.
  const procurando = busca.trim() !== "" || filtro !== "todos" || filtroDeMargem !== "todas";
  const primeira = grupos[0]?.nome ?? null;
  const estaAberta = (nome: string) => procurando || (abertas ? abertas.has(nome) : primeira === nome);
  const todasAbertas = grupos.every((g) => estaAberta(g.nome));
  const mexer = useCallback(
    (fn: (s: Set<string>) => void) =>
      setAbertas((s) => {
        const n = new Set(s ?? (primeira ? [primeira] : []));
        fn(n);
        return n;
      }),
    [primeira],
  );

  // A ordem em que J e K andam: a mesma da tela, categoria por categoria.
  const sequencia = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const atual = selecionado ? (comAjustes.find((p) => p.id === selecionado) ?? null) : null;

  const abrir = useCallback((p: ItemDoCatalogo | null) => {
    setSelecionado(p?.id ?? null);
    if (p) mexer((s) => s.add(p.categoria));
    const url = new URL(window.location.href);
    if (p) url.searchParams.set("p", p.trayId);
    else url.searchParams.delete("p");
    window.history.replaceState(null, "", url);
  }, [mexer]);

  const andar = useCallback(
    (passo: 1 | -1) => {
      if (!sequencia.length) return;
      const i = sequencia.findIndex((p) => p.id === selecionado);
      const proximo = sequencia[Math.min(sequencia.length - 1, Math.max(0, i + passo))];
      abrir(proximo);
      requestAnimationFrame(() =>
        document.getElementById(`produto-${proximo.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
    },
    [sequencia, selecionado, abrir],
  );

  // Link direto para um produto: /admin/produtos?p=217 (é o que o conector devolve).
  useEffect(() => {
    const codigo = new URLSearchParams(window.location.search).get("p");
    const p = codigo ? itens.find((x) => x.trayId === codigo || x.id === codigo) : null;
    if (p) {
      setSoDisponiveis(p.disponivel);
      abrir(p);
      requestAnimationFrame(() => document.getElementById(`produto-${p.id}`)?.scrollIntoView({ block: "center" }));
    }
    // Só na chegada à página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "/" && !digitando(e)) {
        e.preventDefault();
        campoDeBusca.current?.focus();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of itens) if (p.categoriaId) m.set(p.categoriaId, p.categoria);
    return Array.from(m, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);

  const total = noEscopo.length;
  const resolvidos = contagem.aprovada + contagem.na_loja + contagem.dispensada;

  return (
    <>
      {/* Resumo que também é filtro: o número já é o botão. */}
      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="glass rounded-[20px] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Fotos novas</p>
            <p className="text-sm text-muted">
              <span className="font-display text-2xl text-ink">{resolvidos.toLocaleString("pt-BR")}</span> de{" "}
              {total.toLocaleString("pt-BR")} resolvidos
            </p>
          </div>
          <BarraDeEstados contagem={contagem} total={total} className="mt-3 h-2.5" />
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado da foto">
            <Chip ativo={filtro === "todos"} onClick={() => setFiltro("todos")} rotulo="Todos" numero={total} />
            {ESTADOS.map((e) => (
              <Chip
                key={e}
                ativo={filtro === e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                rotulo={ROTULO[e]}
                numero={contagem[e]}
                cor={PONTO[e]}
              />
            ))}
          </div>
        </div>
        <LevarParaLoja aprovados={contagem.aprovada} />
      </section>

      <ComoGerar padroes={padroes} categorias={categorias} />

      {/* Barra de ferramentas */}
      <div className="sticky top-0 z-10 -mx-1 mt-6 flex flex-wrap items-center gap-3 rounded-[16px] bg-background/85 px-1 py-3 backdrop-blur-md">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Buscar produto</span>
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={campoDeBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou categoria  ( / )"
            className="h-11 w-full rounded-full border border-border bg-white/80 pl-10 pr-4 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm text-ink">
          <input
            type="checkbox"
            checked={soDisponiveis}
            onChange={(e) => setSoDisponiveis(e.target.checked)}
            className="accent-[var(--color-brand-strong)]"
          />
          Só disponíveis
        </label>
        <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm text-ink">
          <span className="text-muted">Ordem</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="bg-transparent outline-none">
            {ORDENS.filter((o) => margens || o.valor !== "menor-margem").map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        {margens ? (
          <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm text-ink">
            <span className="text-muted">Margem</span>
            <select
              value={filtroDeMargem}
              onChange={(e) => setFiltroDeMargem(e.target.value as FiltroDeMargem)}
              className="bg-transparent outline-none"
            >
              <option value="todas">Todas</option>
              <option value="sem_custo">Sem custo</option>
              <option value="abaixo">Abaixo do mínimo</option>
              <option value="hoje_passa">Promoção de hoje passa do limite</option>
            </select>
          </label>
        ) : null}
        {!procurando ? (
          <button
            type="button"
            onClick={() => setAbertas(todasAbertas ? new Set() : new Set(grupos.map((g) => g.nome)))}
            className="h-11 rounded-full px-3 text-sm font-semibold text-brand-nav hover:text-brand-strong"
          >
            {todasAbertas ? "Fechar categorias" : "Abrir todas"}
          </button>
        ) : null}
      </div>

      {grupos.length === 0 ? (
        <p className="glass mt-4 rounded-[20px] px-6 py-14 text-center text-sm text-muted">
          Nenhum produto com esse filtro.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {grupos.map((g) => {
            const aberta = estaAberta(g.nome);
            return (
              <section
                key={g.nome}
                className="glass overflow-hidden rounded-[18px] [contain-intrinsic-size:auto_4.5rem] [content-visibility:auto]"
              >
                <button
                  type="button"
                  onClick={() => mexer((s) => (s.has(g.nome) ? s.delete(g.nome) : s.add(g.nome)))}
                  aria-expanded={aberta}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-white/40"
                >
                  <ChevronDown size={16} className={`shrink-0 text-brand-nav transition-transform ${aberta ? "" : "-rotate-90"}`} />
                  <span className="min-w-0 flex-1 break-words font-semibold text-ink">{g.nome}</span>
                  <span className="text-xs text-muted">
                    {procurando ? `${g.itens.length} de ${g.total}` : `${g.total} produtos`}
                  </span>
                  <span className="flex w-40 items-center gap-2 text-xs text-muted">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <span
                        className="block h-full rounded-full bg-brand-strong"
                        style={{ width: `${g.total ? (g.resolvidos / g.total) * 100 : 0}%` }}
                      />
                    </span>
                    {g.resolvidos}/{g.total}
                  </span>
                </button>
                {aberta ? (
                  <ul className="border-t border-border/60">
                    {g.itens.map((p) => (
                      <Linha key={p.id} p={p} ativo={p.id === selecionado} onAbrir={abrir} margem={margens ? (margens[p.id] ?? null) : undefined} />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {atual ? (
        <Gaveta
          key={atual.id}
          produto={atual}
          posicao={{ i: sequencia.findIndex((p) => p.id === atual.id), de: sequencia.length }}
          onFechar={() => abrir(null)}
          onAndar={andar}
          onEstado={(e) => setAjustes((a) => ({ ...a, [atual.id]: e }))}
          margem={margens ? (margens[atual.id] ?? null) : undefined}
          loja={loja}
        />
      ) : null}
    </>
  );
}

const Linha = memo(function Linha({
  p,
  ativo,
  onAbrir,
  margem,
}: {
  p: ItemDoCatalogo;
  ativo: boolean;
  onAbrir: (p: ItemDoCatalogo) => void;
  /** undefined = quem olha não é administrador. */
  margem?: MargemNaLista | null;
}) {
  return (
    <li
      id={`produto-${p.id}`}
      className={`border-b border-border/40 last:border-0 ${ativo ? "bg-brand/12" : "hover:bg-white/50"}`}
    >
      <div className="flex items-center gap-3 px-5 py-2.5">
        <button
          type="button"
          onClick={() => onAbrir(p)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Abrir ${p.nome}`}
        >
          {p.miniatura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.miniatura}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="h-11 w-11 shrink-0 rounded-[8px] bg-white object-contain"
            />
          ) : (
            <span className="h-11 w-11 shrink-0 rounded-[8px] bg-media" />
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-sm font-medium text-ink">{p.nome}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span>Cód. {p.trayId}</span>
              {p.vendidos > 0 ? <span>{p.vendidos.toLocaleString("pt-BR")} vendidos</span> : null}
              {!p.disponivel ? <span className="text-wine">Indisponível</span> : null}
              {p.reservadoAte ? (
                <span className="inline-flex items-center gap-1 text-brand-strong">
                  <Clock size={11} /> sendo gerada
                </span>
              ) : null}
            </span>
          </span>
          <span className="hidden w-28 shrink-0 text-right text-sm sm:block">
            {p.precoAntes ? <span className="block text-xs text-muted line-through">{reais(p.precoAntes)}</span> : null}
            <span className="text-ink">{reais(p.preco)}</span>
          </span>
          {margem !== undefined ? (
            <span
              className="hidden w-16 shrink-0 text-right text-xs lg:block"
              title={margem?.custo !== null && margem ? `Margem no preço cheio. Desconto máximo ${pct(margem.descontoMaximo)}` : (margem?.falta ?? "Sem custo")}
            >
              {margem && margem.fracao !== null ? (
                <span className={`font-semibold ${margem.abaixo || margem.hojePassa ? "text-wine" : "text-emerald-800"}`}>
                  {pct(margem.fracao)}
                </span>
              ) : (
                <span className="text-muted">sem custo</span>
              )}
            </span>
          ) : null}
          <span className={`w-28 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold ${COR[p.estado]}`}>
            {ROTULO[p.estado]}
          </span>
        </button>
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-brand-nav hover:underline md:inline-flex"
          >
            Loja <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
    </li>
  );
});

function Chip({
  ativo,
  onClick,
  rotulo,
  numero,
  cor,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  numero: number;
  cor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        ativo ? "border-ink bg-ink text-white" : "border-border bg-white/70 text-ink hover:border-brand"
      }`}
    >
      {cor && !ativo ? <span className={`h-2 w-2 rounded-full ${cor}`} aria-hidden /> : null}
      {rotulo}
      <span className={ativo ? "text-white/70" : "text-muted"}>{numero.toLocaleString("pt-BR")}</span>
    </button>
  );
}

export function BarraDeEstados({
  contagem,
  total,
  className = "",
}: {
  contagem: Record<EstadoDoProduto, number>;
  total: number;
  className?: string;
}) {
  const ordem: EstadoDoProduto[] = ["na_loja", "aprovada", "aguardando", "refazer", "dispensada"];
  return (
    <div className={`flex overflow-hidden rounded-full bg-ink/[0.07] ${className}`} aria-hidden>
      {ordem.map((e) =>
        contagem[e] ? (
          <span key={e} className={PONTO[e]} style={{ width: `${(contagem[e] / Math.max(1, total)) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}
