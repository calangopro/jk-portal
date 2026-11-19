import type { ReactNode } from "react";
import Link from "next/link";
import { TrendingUp, Target, MousePointerClick, Eye, ArrowUpRight } from "lucide-react";
import { Importar } from "./Importar";
import { Automatico } from "./Automatico";
import { Cartao, numero } from "./Cartao";

export type LinhaDeBusca = { nome: string; impressions: number; clicks: number; position: number; ctr: number };

/** O desenho da tela, separado da leitura para a demonstração do Como usar. */
export function TelaDasMetricas({
  visitas,
  periodo,
  temDados,
  impressoes,
  cliques,
  ctr,
  posicaoMedia,
  pertoDaPrimeira,
  ctrBaixo,
  paginas,
  automatico,
  publicados,
  total,
}: {
  /** O bloco de visitas do GA4 (na tela de verdade fica em Suspense). */
  visitas: ReactNode;
  periodo: { inicio: string; fim: string } | null;
  temDados: boolean;
  impressoes: number;
  cliques: number;
  ctr: number;
  posicaoMedia: number;
  pertoDaPrimeira: LinhaDeBusca[];
  ctrBaixo: LinhaDeBusca[];
  paginas: LinhaDeBusca[];
  automatico: {
    email: string | null;
    problema: string | null;
    ultima: { ok: boolean; mensagem: string; quando: string } | null;
  };
  publicados: number | null;
  total: number | null;
}) {

  return (
    <>
      <header>
        <p className="eyebrow">Conteúdo</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Métricas</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Quantas pessoas leem o site, de onde vêm e quais páginas levam à loja.
          Mais abaixo, o que o Google mostra: impressão, clique e as buscas em
          que a JK aparece.
        </p>
      </header>

      {visitas}

      <header className="mt-12 border-t border-border pt-8">
        <p className="eyebrow">No Google</p>
        <h2 className="font-display mt-1 text-2xl text-ink">Search Console</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Só a busca do Google: quantas vezes a JK apareceu e quantas vezes clicaram.{" "}
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

      <section className="mt-6">
        <Automatico email={automatico.email} problema={automatico.problema} ultima={automatico.ultima} />
      </section>

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
