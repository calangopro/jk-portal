import Link from "next/link";
import { TrendingUp, Target, MousePointerClick, Eye, ArrowUpRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Importar } from "./Importar";

export const metadata = { title: "Métricas" };

type Snap = {
  metric: string;
  dimension: string;
  dimension_value: string;
  value: number;
  period_start: string;
  period_end: string;
};

function numero(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });
}

function Cartao({
  Icone, rotulo, valor, apoio,
}: {
  Icone: typeof Eye;
  rotulo: string;
  valor: string;
  apoio: string;
}) {
  return (
    <div className="glass rounded-[18px] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
          <Icone size={14} />
        </span>
        <p className="eyebrow text-[0.62rem]">{rotulo}</p>
      </div>
      <p className="font-display mt-3 text-4xl text-ink">{valor}</p>
      <p className="mt-1 text-xs text-muted">{apoio}</p>
    </div>
  );
}

export default async function MetricasPage() {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: snaps }, { count: publicados }, { count: total }] = await Promise.all([
    supabase
      .from("analytics_snapshots")
      .select("metric, dimension, dimension_value, value, period_start, period_end")
      .eq("source", "gsc")
      .order("period_end", { ascending: false })
      .limit(4000),
    supabase.from("contents").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("contents").select("*", { count: "exact", head: true }),
  ]);

  const linhas = (snaps ?? []) as Snap[];
  const periodo = linhas[0]
    ? { inicio: linhas[0].period_start, fim: linhas[0].period_end }
    : null;

  // Só o período mais recente entra nos números do topo.
  const doPeriodo = periodo
    ? linhas.filter((l) => l.period_start === periodo.inicio && l.period_end === periodo.fim)
    : [];

  const somar = (metric: string, dim: string) =>
    doPeriodo.filter((l) => l.metric === metric && l.dimension === dim).reduce((a, b) => a + Number(b.value), 0);

  const impressoes = somar("impressions", "query");
  const cliques = somar("clicks", "query");
  const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

  const posicoes = doPeriodo.filter((l) => l.metric === "position" && l.dimension === "query");
  const posicaoMedia =
    posicoes.length > 0 ? posicoes.reduce((a, b) => a + Number(b.value), 0) / posicoes.length : 0;

  /** Junta as métricas por consulta, para montar as tabelas. */
  function agrupar(dim: string) {
    const mapa = new Map<string, { impressions: number; clicks: number; position: number; ctr: number }>();
    for (const l of doPeriodo.filter((x) => x.dimension === dim)) {
      const atual = mapa.get(l.dimension_value) ?? { impressions: 0, clicks: 0, position: 0, ctr: 0 };
      if (l.metric === "impressions") atual.impressions = Number(l.value);
      if (l.metric === "clicks") atual.clicks = Number(l.value);
      if (l.metric === "position") atual.position = Number(l.value);
      if (l.metric === "ctr") atual.ctr = Number(l.value);
      mapa.set(l.dimension_value, atual);
    }
    return [...mapa.entries()].map(([nome, m]) => ({ nome, ...m }));
  }

  const consultas = agrupar("query");
  const paginas = agrupar("page");

  // A maior oportunidade do projeto: muita impressão, posição de segunda página.
  const pertoDaPrimeira = consultas
    .filter((c) => c.position >= 8 && c.position <= 20 && c.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12);

  // Muita impressão e clique baixo: o título e a meta não estão ganhando o clique.
  const ctrBaixo = consultas
    .filter((c) => c.impressions >= 100 && c.ctr < 1)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12);

  const temDados = doPeriodo.length > 0;

  return (
    <>
      <header>
        <p className="eyebrow">Resultado</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Métricas</h1>
        <p className="mt-3 max-w-2xl text-muted">
          O que importa não é só posição, e sim impressão, clique e as buscas em
          que a JK passou a aparecer.{" "}
          {periodo ? (
            <span className="text-ink">
              Período carregado: {new Date(periodo.inicio + "T12:00:00").toLocaleDateString("pt-BR")} a{" "}
              {new Date(periodo.fim + "T12:00:00").toLocaleDateString("pt-BR")}.
            </span>
          ) : null}
        </p>
      </header>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao Icone={Eye} rotulo="Impressões" valor={temDados ? numero(impressoes) : "sem dados"} apoio="quantas vezes a JK apareceu" />
        <Cartao Icone={MousePointerClick} rotulo="Cliques" valor={temDados ? numero(cliques) : "sem dados"} apoio="quantas vezes clicaram" />
        <Cartao Icone={TrendingUp} rotulo="CTR" valor={temDados ? `${ctr.toFixed(2)}%` : "sem dados"} apoio="cliques sobre impressões" />
        <Cartao Icone={Target} rotulo="Posição média" valor={temDados ? posicaoMedia.toFixed(1) : "sem dados"} apoio="média das consultas" />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">Perto da primeira página</p>
          <p className="mt-1 text-xs text-muted">
            Posição 8 a 20 com volume. É onde um ajuste de conteúdo rende mais rápido.
          </p>
          {pertoDaPrimeira.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {pertoDaPrimeira.map((c) => (
                <li key={c.nome} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {numero(c.impressions)} impr · pos {c.position.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {temDados ? "Nenhuma consulta nessa faixa ainda." : "Importe os dados do Search Console para ver."}
            </p>
          )}
        </div>

        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">Aparece, mas não clicam</p>
          <p className="mt-1 text-xs text-muted">
            Muita impressão e CTR abaixo de 1%. Em geral o título e a meta description precisam de trabalho.
          </p>
          {ctrBaixo.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {ctrBaixo.map((c) => (
                <li key={c.nome} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {numero(c.impressions)} impr · {c.ctr.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {temDados ? "Nada crítico nessa faixa." : "Importe os dados para ver."}
            </p>
          )}
        </div>
      </section>

      {paginas.length > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-5">
          <p className="eyebrow">Páginas com mais cliques</p>
          <ul className="mt-4 space-y-2.5">
            {paginas.sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((p) => (
              <li key={p.nome} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.nome}</span>
                <span className="shrink-0 text-xs text-muted">
                  {numero(p.clicks)} cliques · {numero(p.impressions)} impr
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Importar />

        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">Conteúdo</p>
          <div className="mt-4 space-y-3 text-sm">
            <p className="flex items-baseline justify-between">
              <span className="text-muted">Publicados</span>
              <span className="font-display text-2xl text-ink">{publicados ?? 0}</span>
            </p>
            <p className="flex items-baseline justify-between">
              <span className="text-muted">Total, incluindo rascunho</span>
              <span className="font-display text-2xl text-ink">{total ?? 0}</span>
            </p>
          </div>
          <Link
            href="/admin/integracoes"
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-nav hover:underline"
          >
            Conectar Search Console e GA4 <ArrowUpRight size={13} />
          </Link>
        </div>
      </section>
    </>
  );
}
