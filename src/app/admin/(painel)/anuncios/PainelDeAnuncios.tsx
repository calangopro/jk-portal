"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { limiteDeAnuncio, precoComDesconto, type LimiteDeAnuncio, type Parametros } from "@/lib/margem/calculo";
import { lerNumero } from "../margem/PainelDeMargem";
import { pct, reais } from "../produtos/util";

export type LinhaDeAnuncio = {
  id: string;
  trayId: string;
  nome: string;
  categoria: string;
  vendidos: number;
  precoCheio: number | null;
  precoHoje: number | null;
  custo: number | null;
  falta: string | null;
};

type Ordem = "folga" | "roas" | "vendidos" | "sem_folga";
type Calculada = LinhaDeAnuncio & { l: LimiteDeAnuncio; lHoje: LimiteDeAnuncio | null };

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const vezes = (n: number | null) => (n === null ? "não fecha" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`);

export function PainelDeAnuncios({ linhas, parametros }: { linhas: LinhaDeAnuncio[]; parametros: Parametros }) {
  const [cenario, setCenario] = useState<"hoje" | "desconto">("hoje");
  const [desconto, setDesconto] = useState("20");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("folga");
  const [quantos, setQuantos] = useState(60);

  const d = Math.min(0.9, Math.max(0, (lerNumero(desconto) ?? 0) / 100));
  const comCusto = useMemo(() => linhas.filter((l) => l.custo !== null && l.precoCheio), [linhas]);

  // A conta de cada produto no cenário escolhido, e no preço de hoje para comparar.
  const calculadas: Calculada[] = useMemo(
    () =>
      comCusto.map((p) => {
        const hoje = p.precoHoje ?? p.precoCheio!;
        const preco = cenario === "hoje" ? hoje : precoComDesconto(p.precoCheio!, d);
        return {
          ...p,
          l: limiteDeAnuncio(preco, p.custo!, parametros),
          lHoje: cenario === "hoje" ? null : limiteDeAnuncio(hoje, p.custo!, parametros),
        };
      }),
    [comCusto, cenario, d, parametros],
  );

  const categorias = useMemo(() => Array.from(new Set(linhas.map((l) => l.categoria))).sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);

  const filtradas = useMemo(() => {
    const t = semAcento(busca.trim());
    const lista = calculadas.filter(
      (p) => (!categoria || p.categoria === categoria) && (!t || semAcento(p.nome).includes(t) || p.trayId === t),
    );
    const por: Record<Ordem, (a: Calculada, b: Calculada) => number> = {
      folga: (a, b) => b.l.cpaMaximo - a.l.cpaMaximo,
      roas: (a, b) => (a.l.roasMinimo ?? Infinity) - (b.l.roasMinimo ?? Infinity),
      vendidos: (a, b) => b.vendidos - a.vendidos,
      sem_folga: (a, b) => a.l.cpaMaximo - b.l.cpaMaximo,
    };
    return lista.sort(por[ordem]);
  }, [calculadas, busca, categoria, ordem]);

  const aguentam = filtradas.filter((p) => p.l.cpaMaximo > 0);
  const naoAguentam = filtradas.filter((p) => p.l.cpaMaximo <= 0);
  const mediana = (() => {
    const v = aguentam.map((p) => p.l.cpaMaximo).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  })();
  const perdemNoCenario = cenario === "desconto" ? filtradas.filter((p) => (p.lHoje?.cpaMaximo ?? 0) > 0 && p.l.cpaMaximo <= 0) : [];

  // "Onde vale anunciar": já vende e tem a maior folga por venda.
  const melhores = [...calculadas]
    .filter((p) => p.vendidos > 0 && p.l.cpaMaximo > 0)
    .sort((a, b) => b.l.cpaMaximo * Math.log1p(b.vendidos) - a.l.cpaMaximo * Math.log1p(a.vendidos))
    .slice(0, 6);
  const maisVendidosSemFolga = [...calculadas].filter((p) => p.l.cpaMaximo <= 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 6);

  const baixarCsv = () => {
    const n = (v: number | null, casas = 2) => (v === null ? "" : v.toFixed(casas).replace(".", ","));
    const cab = ["Código", "Produto", "Categoria", "Preço", "CPA máximo", "CPA de empate", "ROAS mínimo", "ROAS de empate", "Vendidos"];
    const corpo = filtradas.map((p) => [p.trayId, p.nome, p.categoria, n(p.l.preco), n(p.l.cpaMaximo), n(p.l.cpaEmpate), n(p.l.roasMinimo, 1), n(p.l.roasEmpate, 1), String(p.vendidos)]);
    const csv = "﻿" + [cab, ...corpo].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `limite-de-anuncio-${cenario === "hoje" ? "preco-de-hoje" : `desconto-${Math.round(d * 100)}`}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!comCusto.length) {
    return (
      <div className="glass mt-8 rounded-[20px] px-6 py-14 text-center">
        <p className="font-display text-2xl text-ink">Nenhum produto com custo ainda</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          O limite de anúncio sai do custo de cada peça. Preencha a planilha do dono e importe em{" "}
          <Link href="/admin/margem" className="font-semibold text-brand-nav hover:underline">
            Margem
          </Link>
          , ou digite o custo na gaveta do produto.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Cenário */}
      <section className="glass mt-8 flex flex-wrap items-center gap-3 rounded-[20px] p-5">
        <p className="text-sm font-semibold text-ink">Preço de venda</p>
        <div className="flex rounded-full border border-border bg-white p-0.5" role="radiogroup" aria-label="Cenário de preço">
          {(
            [
              ["hoje", "O de hoje na loja"],
              ["desconto", "Com desconto de campanha"],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={cenario === v}
              onClick={() => setCenario(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${cenario === v ? "bg-ink text-white" : "text-ink"}`}
            >
              {r}
            </button>
          ))}
        </div>
        {cenario === "desconto" ? (
          <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm">
            <input
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="w-10 bg-transparent text-right outline-none"
              aria-label="Desconto sobre o preço cheio"
            />
            % sobre o preço cheio
          </label>
        ) : null}
        {parametros.margemMinima === null ? (
          <p className="w-full text-xs text-wine">
            Sem margem mínima em Margem, o CPA máximo é igual ao de empate: tudo que sobra vira anúncio.
          </p>
        ) : (
          <p className="w-full text-xs text-muted">
            CPA máximo mantém a margem mínima de {pct(parametros.margemMinima)}. CPA de empate é o limite do prejuízo.
          </p>
        )}
      </section>

      {/* Números */}
      <section className="mt-5 grid gap-4 sm:grid-cols-4">
        <Numero rotulo="Produtos com custo" valor={`${comCusto.length} de ${linhas.length}`} />
        <Numero rotulo="Aguentam anúncio" valor={String(aguentam.length)} />
        <Numero rotulo="Não aguentam anúncio" valor={String(naoAguentam.length)} alerta={naoAguentam.length > 0} />
        <Numero rotulo="CPA máximo mediano" valor={mediana !== null ? reais(mediana) : "sem dado"} />
      </section>

      {perdemNoCenario.length ? (
        <p className="mt-4 rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
          Com {Math.round(d * 100)}% de desconto, {perdemNoCenario.length}{" "}
          {perdemNoCenario.length === 1 ? "produto que hoje aguenta anúncio deixa" : "produtos que hoje aguentam anúncio deixam"} de
          aguentar. Nesses, a campanha só se paga com venda orgânica.
        </p>
      ) : null}

      {/* Leitura */}
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Destaques
          titulo="Onde vale anunciar"
          explica="Já vendem e têm a maior folga por venda."
          itens={melhores.map((p) => ({ id: p.trayId, nome: p.nome, valor: `até ${reais(p.l.cpaMaximo)} · ROAS ${vezes(p.l.roasMinimo)}` }))}
        />
        <Destaques
          titulo="Não anuncie neste preço"
          explica="Qualquer real de anúncio tira a peça da margem mínima."
          itens={maisVendidosSemFolga.map((p) => ({ id: p.trayId, nome: p.nome, valor: `empata em ${reais(p.l.cpaEmpate)}` }))}
          alerta
        />
      </section>

      {/* Tabela */}
      <section className="glass mt-6 overflow-hidden rounded-[20px]">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Buscar</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou código"
              className="h-10 w-full rounded-full border border-border bg-white/80 pl-9 pr-4 text-sm outline-none focus:border-brand"
            />
          </label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10 rounded-full border border-border bg-white/80 px-3 text-sm" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="h-10 rounded-full border border-border bg-white/80 px-3 text-sm" aria-label="Ordem">
            <option value="folga">Maior folga por venda</option>
            <option value="roas">Menor ROAS mínimo</option>
            <option value="vendidos">Mais vendidos</option>
            <option value="sem_folga">Sem folga primeiro</option>
          </select>
          <button type="button" onClick={baixarCsv} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-charcoal">
            <Download size={14} /> Baixar para o gerenciador
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-left text-sm">
            <thead>
              <tr className="border-y border-border/70 text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Preço</th>
                <th className="px-4 py-3 font-semibold">Pode pagar por venda</th>
                <th className="px-4 py-3 font-semibold">Empata em</th>
                <th className="px-4 py-3 font-semibold">ROAS mínimo</th>
                <th className="px-4 py-3 font-semibold">Vendidos</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, quantos).map((p) => (
                <tr key={p.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/admin/produtos?p=${p.trayId}`} className="line-clamp-2 break-words text-ink hover:underline">
                      {p.nome}
                    </Link>
                    <span className="text-xs text-muted">
                      Cód. {p.trayId} · {p.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted">{reais(p.l.preco)}</td>
                  <td className="px-4 py-2">
                    {p.l.cpaMaximo > 0 ? (
                      <span className="font-semibold text-emerald-800">até {reais(p.l.cpaMaximo)}</span>
                    ) : (
                      <span className="font-semibold text-wine">não aguenta</span>
                    )}
                    {p.lHoje && p.lHoje.cpaMaximo !== p.l.cpaMaximo ? (
                      <span className="block text-xs text-muted">hoje: {reais(p.lHoje.cpaMaximo)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-muted">{p.l.cpaEmpate > 0 ? reais(p.l.cpaEmpate) : "prejuízo sem anúncio"}</td>
                  <td className="px-4 py-2 text-ink">{vezes(p.l.roasMinimo)}</td>
                  <td className="px-4 py-2 text-muted">{p.vendidos.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtradas.length > quantos ? (
          <button type="button" onClick={() => setQuantos((q) => q + 120)} className="w-full border-t border-border/60 py-3 text-sm font-semibold text-brand-nav hover:bg-white/50">
            Mostrar mais ({filtradas.length - quantos})
          </button>
        ) : null}
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted">
          {linhas.length - comCusto.length} produtos disponíveis ainda sem custo não entram na conta. O CSV sai com os filtros
          da tela, pronto para colar no gerenciador de anúncios.
        </p>
      </section>
    </>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="glass rounded-[18px] p-4">
      <p className={`font-display text-2xl ${alerta ? "text-wine" : "text-ink"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-muted">{rotulo}</p>
    </div>
  );
}

function Destaques({
  titulo,
  explica,
  itens,
  alerta = false,
}: {
  titulo: string;
  explica: string;
  itens: { id: string; nome: string; valor: string }[];
  alerta?: boolean;
}) {
  return (
    <div className="glass rounded-[20px] p-5">
      <p className={`text-sm font-semibold ${alerta ? "text-wine" : "text-ink"}`}>{titulo}</p>
      <p className="mt-0.5 text-xs text-muted">{explica}</p>
      {itens.length ? (
        <ul className="mt-3 divide-y divide-border/50">
          {itens.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
              <Link href={`/admin/produtos?p=${i.id}`} className="min-w-0 flex-1 break-words text-ink hover:underline">
                {i.nome}
              </Link>
              <span className="text-xs text-muted">{i.valor}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nenhum.</p>
      )}
    </div>
  );
}
