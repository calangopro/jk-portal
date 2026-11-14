"use client";

import { Fragment, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, Circle, CircleAlert, CircleCheck, Minus, Pause, Search, Store,
  TriangleAlert, Wrench, X,
} from "lucide-react";
import type { Nivel, Objetivo, Veredito } from "@/lib/trafego/diagnostico";
import {
  ordenar, somar, tomDaVoltaDaLoja, tomDaVoltaDaPlataforma, tomDoVeredito, type Coluna, type Linha, type Tom,
} from "@/lib/trafego/linhas";

/**
 * A tabela de campanhas, conjuntos e anúncios, no jeito de gerenciador de
 * anúncio: três abas de nível, uma linha por item, coluna que ordena no clique
 * e cor que diz bom ou ruim sem precisar ler.
 *
 * COMO SE DESCE. Clicar no nome de uma campanha abre a aba de conjuntos só com
 * os dela, e clicar num conjunto abre os anúncios dele. O caminho fica escrito
 * em cima da tabela, e cada pedaço dele se desfaz no X.
 *
 * AS CORES vêm de `lib/trafego/linhas.ts`, que é conta e tem teste. Aqui só se
 * pinta. Toda cor vem com ícone, e o veredito vem com a palavra: verde e
 * vermelho sozinhos não dizem nada para quem não distingue os dois.
 *
 * NO CELULAR não é tabela. Cada item vira um cartão com os seis números que
 * decidem, e o resto fica em "Detalhes". Tabela de catorze colunas em 375 px
 * ninguém lê.
 */

const TOM: Record<Tom, { texto: string; fundo: string; Icone: LucideIcon | null }> = {
  bom: { texto: "#046c4e", fundo: "#e3f4ec", Icone: CircleCheck },
  atencao: { texto: "#9a4a07", fundo: "#fcefd9", Icone: TriangleAlert },
  ruim: { texto: "#b01919", fundo: "#fde8e8", Icone: CircleAlert },
  neutro: { texto: "inherit", fundo: "transparent", Icone: null },
};

const VEREDITO: Record<Veredito, { nome: string; Icone: LucideIcon }> = {
  bom: { nome: "Bom", Icone: CircleCheck },
  na_media: { nome: "Na média", Icone: Minus },
  atencao: { nome: "Atenção", Icone: TriangleAlert },
  ruim: { nome: "Ruim", Icone: CircleAlert },
  sem_dado: { nome: "Pouco dado", Icone: Circle },
};

const NIVEIS: { nivel: Nivel; nome: string; um: string }[] = [
  { nivel: "campanha", nome: "Campanhas", um: "campanha" },
  { nivel: "conjunto", nome: "Conjuntos", um: "conjunto" },
  { nivel: "anuncio", nome: "Anúncios", um: "anúncio" },
];

const UNIDADE: Record<Objetivo, [string, string]> = {
  venda: ["compra", "compras"],
  conversa: ["conversa", "conversas"],
  clique: ["clique", "cliques"],
  engajamento: ["clique", "cliques"],
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const reaisCurto = (n: number) => (Math.abs(n) >= 1000 ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : reais(n));
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const vezes = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
const porcento = (n: number) => `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const VAZIO = "·";

const chaveDaLinha = (l: Linha) => `${l.nivel}:${l.id}`;

/** Valor pintado: fundo claro, texto escuro da mesma cor e o ícone do tom. */
function Pintado({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  const t = TOM[tom];
  if (tom === "neutro") return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold" style={{ color: t.texto, background: t.fundo }}>
      {t.Icone ? <t.Icone size={11} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function SeloDoVeredito({ v }: { v: Veredito }) {
  const tom = tomDoVeredito(v);
  const s = VEREDITO[v];
  const t = TOM[tom];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
      style={tom === "neutro" ? { color: "var(--color-muted)", background: "rgb(23 21 18 / 0.06)" } : { color: t.texto, background: t.fundo }}
    >
      <s.Icone size={11} aria-hidden="true" /> {s.nome}
    </span>
  );
}

function Estado({ ativo }: { ativo: boolean | null }) {
  if (ativo === false) {
    return (
      <span className="inline-flex shrink-0 items-center text-muted" title="Pausado">
        <Pause size={12} aria-hidden="true" />
        <span className="sr-only">Pausado</span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" title={ativo ? "Ligado" : undefined}>
      <span className="painel-ponto block h-2 w-2 rounded-full" />
      {ativo ? <span className="sr-only">Ligado</span> : null}
    </span>
  );
}

type Colunas = { chave: Coluna; nome: string; dica: string }[];

function colunasDa(plataforma: "meta" | "google"): Colunas {
  const p = plataforma === "meta" ? "Meta" : "Google";
  return [
    { chave: "gasto", nome: "Gasto", dica: "Quanto o item gastou no período" },
    { chave: "resultados", nome: "Resultado", dica: "Compras, conversas ou cliques, conforme o objetivo da campanha" },
    { chave: "custo", nome: "Custo/resultado", dica: "Gasto dividido pelo resultado. A cor compara com a média da conta" },
    { chave: "valor", nome: `Venda (${p})`, dica: `O que o ${p} diz que vendeu. Conta pedido criado, não só o pago` },
    { chave: "retorno", nome: `Volta (${p})`, dica: `Venda que o ${p} informa por real gasto. A cor compara com a média da conta` },
    { chave: "lojaValor", nome: "Loja, pago", dica: "Pedidos PAGOS na loja ligados a este item pelo coletor de origem" },
    { chave: "voltaDaLoja", nome: "Volta na loja", dica: "Venda paga da loja por real gasto. Verde do empate para cima, vermelho abaixo de 1" },
    { chave: "checkouts", nome: "Checkout", dica: "Quantas vezes começaram a compra" },
    { chave: "cliques", nome: "Cliques", dica: "Cliques no link do anúncio" },
    { chave: "ctr", nome: "CTR", dica: "Cliques sobre impressões" },
    { chave: "cpc", nome: "CPC", dica: "Custo por clique" },
    { chave: "cpm", nome: "CPM", dica: "Custo por mil impressões" },
  ];
}

export function TabelaDeAnuncios({
  linhas, plataforma, empate, mediaDaVolta,
}: {
  linhas: Linha[];
  plataforma: "meta" | "google";
  /** Volta em que a venda paga cobre o anúncio e a margem de referência. */
  empate: number;
  /** Volta média que a plataforma informa nas campanhas de venda. */
  mediaDaVolta: number | null;
}) {
  const [nivel, setNivel] = useState<Nivel>("campanha");
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [conjuntoId, setConjuntoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soLigados, setSoLigados] = useState(false);
  const [veredito, setVeredito] = useState<"todos" | "bom" | "atencao" | "ruim">("todos");
  const [ordem, setOrdem] = useState<{ coluna: Coluna; sentido: "desc" | "asc" }>({ coluna: "gasto", sentido: "desc" });
  const [aberta, setAberta] = useState<string | null>(null);
  const [limite, setLimite] = useState(60);

  const colunas = useMemo(() => colunasDa(plataforma), [plataforma]);
  const gastoDaConta = useMemo(() => linhas.filter((l) => l.nivel === "campanha").reduce((s, l) => s + l.gasto, 0), [linhas]);

  // O que a pessoa escolheu descer: a campanha e, dentro dela, o conjunto.
  const noCaminho = (l: Linha) =>
    (!campanhaId || l.campanhaId === campanhaId) && (!conjuntoId || l.nivel === "campanha" || l.conjuntoId === conjuntoId);
  const quantos = (n: Nivel) => linhas.filter((l) => l.nivel === n && noCaminho(l)).length;

  const doNivel = useMemo(
    () => linhas.filter((l) => l.nivel === nivel && noCaminho(l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, nivel, campanhaId, conjuntoId],
  );
  const porVeredito = useMemo(() => {
    const c = { bom: 0, atencao: 0, ruim: 0 };
    for (const l of doNivel) if (l.veredito === "bom" || l.veredito === "atencao" || l.veredito === "ruim") c[l.veredito]++;
    return c;
  }, [doNivel]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return doNivel.filter(
      (l) =>
        (!soLigados || l.ativo !== false) &&
        (veredito === "todos" || l.veredito === veredito) &&
        (!termo || `${l.nome} ${l.campanha ?? ""} ${l.conjunto ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [doNivel, busca, soLigados, veredito]);
  const ordenadas = useMemo(() => ordenar(filtradas, ordem.coluna, ordem.sentido), [filtradas, ordem]);
  const total = useMemo(() => somar(filtradas), [filtradas]);
  const visiveis = ordenadas.slice(0, limite);

  const nomeDaCampanha = campanhaId ? linhas.find((l) => l.nivel === "campanha" && l.id === campanhaId)?.nome : null;
  const nomeDoConjunto = conjuntoId ? linhas.find((l) => l.nivel === "conjunto" && l.id === conjuntoId)?.nome : null;

  const irPara = (n: Nivel) => {
    setNivel(n);
    setLimite(60);
    setAberta(null);
    // Voltar para campanhas com um conjunto escolhido não faz sentido: o conjunto sai.
    if (n === "campanha") setConjuntoId(null);
  };
  const descer = (l: Linha) => {
    if (l.nivel === "campanha") {
      setCampanhaId(l.id);
      setConjuntoId(null);
      irPara("conjunto");
    } else if (l.nivel === "conjunto") {
      setCampanhaId(l.campanhaId);
      setConjuntoId(l.id);
      irPara("anuncio");
    }
  };
  const ordenarPor = (coluna: Coluna) =>
    setOrdem((o) => (o.coluna === coluna ? { coluna, sentido: o.sentido === "desc" ? "asc" : "desc" } : { coluna, sentido: coluna === "nome" || coluna === "custo" || coluna === "cpc" || coluna === "cpm" ? "asc" : "desc" }));

  // ------------------------------------------------------------ as células

  const resultado = (l: Linha) => {
    if (l.objetivo === "engajamento") return <span className="text-muted">{VAZIO}</span>;
    const [um, varios] = UNIDADE[l.objetivo];
    return (
      <>
        {umaCasa(l.resultados)} <span className="text-[0.68rem] text-muted">{l.resultados === 1 ? um : varios}</span>
      </>
    );
  };
  const custo = (l: Linha) =>
    l.custo === null || l.objetivo === "engajamento" ? <span className="text-muted">{VAZIO}</span> : <Pintado tom={tomDoVeredito(l.veredito)}>{reais(l.custo)}</Pintado>;
  const volta = (l: Linha) =>
    l.retorno === null ? <span className="text-muted">{VAZIO}</span> : <Pintado tom={tomDaVoltaDaPlataforma(l, mediaDaVolta, gastoDaConta)}>{vezes(l.retorno)}</Pintado>;
  const lojaPago = (l: Linha) =>
    l.loja ? (
      <>
        {reaisCurto(l.loja.valor)}{" "}
        <span className="text-[0.68rem] text-muted">
          {l.loja.pagos} de {l.loja.criados}
        </span>
      </>
    ) : (
      <span className="text-muted">{VAZIO}</span>
    );
  const voltaDaLoja = (l: Linha) =>
    l.voltaDaLoja === null ? <span className="text-muted">{VAZIO}</span> : <Pintado tom={tomDaVoltaDaLoja(l.voltaDaLoja, empate)}>{vezes(l.voltaDaLoja)}</Pintado>;
  const ctr = (l: Linha) => (l.impressoes > 0 ? porcento(l.cliques / l.impressoes) : VAZIO);
  const cpc = (l: Linha) => (l.cliques > 0 ? reais(l.gasto / l.cliques) : VAZIO);
  const cpm = (l: Linha) => (l.impressoes > 0 ? reais((l.gasto / l.impressoes) * 1000) : VAZIO);

  const detalhe = (l: Linha) => (
    <div className="space-y-1.5 text-xs leading-relaxed text-ink">
      <p className="text-ink/85">{l.motivo}</p>
      {l.ondePerde ? (
        <p className="flex items-start gap-1.5">
          <Wrench size={13} className="mt-0.5 shrink-0 text-brand-nav" aria-hidden="true" />
          <span>
            <span className="font-semibold">Onde perde:</span> {l.ondePerde}
          </span>
        </p>
      ) : null}
      {l.loja ? (
        <p className="numeros flex items-start gap-1.5">
          <Store size={13} className="mt-0.5 shrink-0 text-brand-nav" aria-hidden="true" />
          <span>
            <span className="font-semibold">Na loja, pago:</span> {reais(l.loja.valor)} em {l.loja.pagos} de {l.loja.criados}{" "}
            {l.loja.criados === 1 ? "pedido ligado a ele" : "pedidos ligados a ele"}.
          </span>
        </p>
      ) : null}
      <p className="numeros text-muted">
        {inteiro(l.impressoes)} viram, {inteiro(l.cliques)} clicaram
        {l.visitas !== null && l.objetivo === "venda" && plataforma === "meta"
          ? `, ${inteiro(l.visitas)} chegaram na página, ${inteiro(l.carrinhos ?? 0)} no carrinho, ${inteiro(l.checkouts ?? 0)} começaram a compra`
          : ""}
        .
      </p>
    </div>
  );

  const rotuloDeFilhos = (l: Linha) =>
    l.nivel === "campanha" ? `${l.filhos} ${l.filhos === 1 ? "conjunto" : "conjuntos"}` : `${l.filhos} ${l.filhos === 1 ? "anúncio" : "anúncios"}`;
  const ondeEsta = (l: Linha) => [l.campanha, l.conjunto].filter(Boolean).join(" › ");
  const bordaDoTom = (l: Linha) => {
    const tom = tomDoVeredito(l.veredito);
    return tom === "neutro" ? "transparent" : TOM[tom].texto;
  };

  const um = NIVEIS.find((n) => n.nivel === nivel)?.um ?? "item";
  const filtros: { chave: typeof veredito; nome: string; n: number | null; tom: Tom }[] = [
    { chave: "todos", nome: "Todos", n: null, tom: "neutro" },
    { chave: "bom", nome: "Bons", n: porVeredito.bom, tom: "bom" },
    { chave: "atencao", nome: "Atenção", n: porVeredito.atencao, tom: "atencao" },
    { chave: "ruim", nome: "Ruins", n: porVeredito.ruim, tom: "ruim" },
  ];

  return (
    <section className="glass mt-5 overflow-hidden rounded-[18px]" aria-label="Campanhas, conjuntos e anúncios">
      {/* ------------------------------------------------ abas e filtros */}
      <div className="space-y-3 border-b border-ink/[0.07] p-3 sm:p-4">
        <div role="tablist" aria-label="Nível" className="flex gap-1 rounded-[12px] bg-ink/[0.05] p-1">
          {NIVEIS.map((n) => (
            <button
              key={n.nivel}
              type="button"
              role="tab"
              aria-selected={nivel === n.nivel}
              onClick={() => irPara(n.nivel)}
              className={`painel-toque flex-1 rounded-[9px] px-2 py-2 text-sm font-semibold ${
                nivel === n.nivel ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              {n.nome} <span className="numeros text-xs font-medium text-muted">{quantos(n.nivel)}</span>
            </button>
          ))}
        </div>

        {nomeDaCampanha || nomeDoConjunto ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">Dentro de</span>
            {nomeDaCampanha ? (
              <button
                type="button"
                onClick={() => {
                  setCampanhaId(null);
                  setConjuntoId(null);
                }}
                className="painel-item-ativo inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
              >
                <span className="truncate">{nomeDaCampanha}</span> <X size={12} aria-hidden="true" />
                <span className="sr-only">Tirar o filtro da campanha</span>
              </button>
            ) : null}
            {nomeDoConjunto ? (
              <button
                type="button"
                onClick={() => setConjuntoId(null)}
                className="painel-item-ativo inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
              >
                <span className="truncate">{nomeDoConjunto}</span> <X size={12} aria-hidden="true" />
                <span className="sr-only">Tirar o filtro do conjunto</span>
              </button>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[11rem] flex-1">
            <span className="sr-only">Buscar pelo nome</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(60);
              }}
              placeholder={`Buscar ${um}`}
              className="h-9 w-full rounded-full border border-ink/12 bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto painel-fila">
            {filtros.map((f) => {
              const ativo = veredito === f.chave;
              const t = TOM[f.tom];
              return (
                <button
                  key={f.chave}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setVeredito(f.chave);
                    setLimite(60);
                  }}
                  className="painel-toque inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold"
                  style={
                    ativo
                      ? f.tom === "neutro"
                        ? { background: "var(--color-ink)", color: "#fff", borderColor: "var(--color-ink)" }
                        : { background: t.texto, color: "#fff", borderColor: t.texto }
                      : f.tom === "neutro"
                        ? { background: "#fff", color: "var(--color-ink)", borderColor: "rgb(23 21 18 / 0.12)" }
                        : { background: t.fundo, color: t.texto, borderColor: "transparent" }
                  }
                >
                  {t.Icone ? <t.Icone size={12} aria-hidden="true" /> : null}
                  {f.nome}
                  {f.n !== null ? <span className="numeros">{f.n}</span> : null}
                </button>
              );
            })}
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink">
            <input type="checkbox" checked={soLigados} onChange={(e) => setSoLigados(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--setor)]" />
            Só ligados
          </label>
        </div>

        {/* No celular não há cabeçalho de coluna para clicar: a ordem é uma lista. */}
        <div className="flex items-center gap-2 lg:hidden">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
            Ordenar por
            <select
              value={ordem.coluna}
              onChange={(e) => setOrdem((o) => ({ ...o, coluna: e.target.value as Coluna }))}
              className="h-9 min-w-0 flex-1 rounded-full border border-ink/12 bg-white px-3 text-sm font-semibold text-ink"
            >
              {colunas.map((c) => (
                <option key={c.chave} value={c.chave}>
                  {c.nome}
                </option>
              ))}
              <option value="nome">Nome</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOrdem((o) => ({ ...o, sentido: o.sentido === "desc" ? "asc" : "desc" }))}
            className="painel-toque inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink"
          >
            {ordem.sentido === "desc" ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />}
            {ordem.sentido === "desc" ? "Maior primeiro" : "Menor primeiro"}
          </button>
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">Nada com esse filtro.</p>
      ) : (
        <>
          {/* ------------------------------------------------ computador */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="numeros w-full min-w-[86rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/[0.07] text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th scope="col" className="sticky left-0 z-10 w-[23rem] min-w-[19rem] bg-white py-0 pl-3 pr-2 font-semibold" aria-sort={ordem.coluna === "nome" ? (ordem.sentido === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => ordenarPor("nome")} className="inline-flex items-center gap-1 py-2.5 uppercase tracking-wider hover:text-ink">
                      {NIVEIS.find((n) => n.nivel === nivel)?.nome.replace(/s$/, "")}
                      {ordem.coluna === "nome" ? ordem.sentido === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" /> : null}
                    </button>
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Veredito</th>
                  {colunas.map((c) => (
                    <th key={c.chave} scope="col" className="px-2 py-0 text-right font-semibold" aria-sort={ordem.coluna === c.chave ? (ordem.sentido === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" title={c.dica} onClick={() => ordenarPor(c.chave)} className={`inline-flex items-center gap-1 whitespace-nowrap py-2.5 uppercase tracking-wider hover:text-ink ${ordem.coluna === c.chave ? "text-ink" : ""}`}>
                        {c.nome}
                        {ordem.coluna === c.chave ? ordem.sentido === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" /> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const chave = chaveDaLinha(l);
                  const estaAberta = aberta === chave;
                  return (
                    <Fragment key={chave}>
                      <tr className={`group border-b border-ink/[0.05] hover:bg-ink/[0.025] ${l.ativo === false ? "text-ink/55" : "text-ink"}`}>
                        <th scope="row" className="sticky left-0 z-10 w-[23rem] min-w-[19rem] bg-white py-2 pl-0 pr-2 text-left font-normal group-hover:bg-[#fafaf9]">
                          <div className="flex items-start gap-2 border-l-[3px] pl-2" style={{ borderLeftColor: bordaDoTom(l) }}>
                            <button
                              type="button"
                              onClick={() => setAberta(estaAberta ? null : chave)}
                              aria-expanded={estaAberta}
                              aria-label={`${estaAberta ? "Fechar" : "Abrir"} os detalhes de ${l.nome}`}
                              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink"
                            >
                              {estaAberta ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                            </button>
                            <span className="mt-1.5"><Estado ativo={l.ativo} /></span>
                            <span className="min-w-0">
                              {l.filhos > 0 ? (
                                <button type="button" onClick={() => descer(l)} title={`Ver ${rotuloDeFilhos(l)}`} className="painel-cor line-clamp-2 break-words text-left text-sm font-semibold leading-snug hover:underline">
                                  {l.nome}
                                </button>
                              ) : (
                                <span className="line-clamp-2 break-words text-sm font-semibold leading-snug">{l.nome}</span>
                              )}
                              <span className="block truncate text-[0.68rem] font-sans text-muted">
                                {l.nivel === "campanha" ? rotuloDeFilhos(l) : ondeEsta(l)}
                              </span>
                            </span>
                          </div>
                        </th>
                        <td className="px-2 py-2"><SeloDoVeredito v={l.veredito} /></td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold">{reais(l.gasto)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{resultado(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{custo(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{l.valor ? reaisCurto(l.valor) : <span className="text-muted">{VAZIO}</span>}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{volta(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{lojaPago(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{voltaDaLoja(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{l.checkouts ? inteiro(l.checkouts) : <span className="text-muted">{VAZIO}</span>}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{inteiro(l.cliques)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{ctr(l)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{cpc(l)}</td>
                        <td className="whitespace-nowrap py-2 pl-2 pr-3 text-right">{cpm(l)}</td>
                      </tr>
                      {estaAberta ? (
                        <tr className="border-b border-ink/[0.05] bg-ink/[0.025]">
                          <td colSpan={colunas.length + 2} className="px-3 py-3">
                            <div className="sticky left-3 max-w-3xl font-sans">{detalhe(l)}</div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/15 bg-ink/[0.03] font-semibold text-ink">
                  <th scope="row" className="sticky left-0 z-10 bg-[#f7f7f6] py-2.5 pl-3 pr-2 text-left text-xs">
                    {total.itens} {total.itens === 1 ? um : `${um}s`}
                    {filtradas.length !== doNivel.length ? <span className="font-normal text-muted"> de {doNivel.length}</span> : null}
                  </th>
                  <td />
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{reais(total.gasto)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.compras > 0 ? <>{umaCasa(total.compras)} <span className="text-[0.68rem] font-normal text-muted">compras</span></> : VAZIO}</td>
                  <td className="px-2 py-2.5 text-right">{VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.valor > 0 ? reaisCurto(total.valor) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.valor > 0 && total.gasto > 0 ? vezes(total.valor / total.gasto) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.lojaValor > 0 ? reaisCurto(total.lojaValor) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.lojaValor > 0 && total.gasto > 0 ? vezes(total.lojaValor / total.gasto) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.checkouts > 0 ? inteiro(total.checkouts) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{inteiro(total.cliques)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.impressoes > 0 ? porcento(total.cliques / total.impressoes) : VAZIO}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">{total.cliques > 0 ? reais(total.gasto / total.cliques) : VAZIO}</td>
                  <td className="whitespace-nowrap py-2.5 pl-2 pr-3 text-right">{total.impressoes > 0 ? reais((total.gasto / total.impressoes) * 1000) : VAZIO}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* --------------------------------------------------- celular */}
          <ul className="divide-y divide-ink/[0.07] lg:hidden">
            <li className="numeros flex items-baseline justify-between gap-3 bg-ink/[0.03] px-4 py-2.5 text-xs">
              <span className="font-semibold text-ink">
                {total.itens} {total.itens === 1 ? um : `${um}s`}
              </span>
              <span className="text-muted">
                gasto <span className="font-semibold text-ink">{reaisCurto(total.gasto)}</span>
                {total.lojaValor > 0 ? <> · loja <span className="font-semibold text-ink">{reaisCurto(total.lojaValor)}</span></> : null}
              </span>
            </li>
            {visiveis.map((l) => {
              const chave = chaveDaLinha(l);
              const estaAberta = aberta === chave;
              return (
                <li key={chave} className={`border-l-4 px-3.5 py-3 ${l.ativo === false ? "text-ink/60" : "text-ink"}`} style={{ borderLeftColor: bordaDoTom(l) }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-semibold leading-snug">{l.nome}</p>
                    <SeloDoVeredito v={l.veredito} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted">
                    <Estado ativo={l.ativo} />
                    <span className="min-w-0 truncate">
                      {l.ativo === false ? "Pausado" : "Ligado"}
                      {l.nivel !== "campanha" && ondeEsta(l) ? ` · ${ondeEsta(l)}` : ""}
                    </span>
                  </p>
                  <dl className="numeros mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2.5 text-sm">
                    <Celula rotulo="Gasto"><span className="font-semibold">{reaisCurto(l.gasto)}</span></Celula>
                    <Celula rotulo="Resultado">{resultado(l)}</Celula>
                    <Celula rotulo="Custo">{custo(l)}</Celula>
                    <Celula rotulo={colunas[4].nome}>{volta(l)}</Celula>
                    <Celula rotulo="Loja, pago">{lojaPago(l)}</Celula>
                    <Celula rotulo="Volta na loja">{voltaDaLoja(l)}</Celula>
                  </dl>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {l.filhos > 0 ? (
                      <button type="button" onClick={() => descer(l)} className="painel-toque painel-item-ativo inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold">
                        Ver {rotuloDeFilhos(l)} <ChevronRight size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setAberta(estaAberta ? null : chave)}
                      aria-expanded={estaAberta}
                      className="painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink"
                    >
                      Detalhes <ChevronDown size={13} className={estaAberta ? "rotate-180" : ""} aria-hidden="true" />
                    </button>
                  </div>
                  {estaAberta ? (
                    <div className="mt-3 rounded-[12px] bg-ink/[0.035] p-3">
                      {detalhe(l)}
                      <dl className="numeros mt-2.5 grid grid-cols-4 gap-2 text-xs">
                        <Celula rotulo="Cliques">{inteiro(l.cliques)}</Celula>
                        <Celula rotulo="CTR">{ctr(l)}</Celula>
                        <Celula rotulo="CPC">{cpc(l)}</Celula>
                        <Celula rotulo="CPM">{cpm(l)}</Celula>
                      </dl>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {ordenadas.length > limite ? (
            <p className="border-t border-ink/[0.07] p-3 text-center">
              <button type="button" onClick={() => setLimite((n) => n + 120)} className="painel-toque inline-flex h-9 items-center rounded-full border border-ink/12 bg-white px-4 text-xs font-semibold text-ink">
                Mostrar mais ({(ordenadas.length - limite).toLocaleString("pt-BR")})
              </button>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Celula({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[0.64rem] leading-tight text-muted">{rotulo}</dt>
      <dd className="mt-0.5 leading-tight">{children}</dd>
    </div>
  );
}
