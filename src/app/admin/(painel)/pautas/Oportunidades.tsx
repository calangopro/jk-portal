"use client";

import { useState, useTransition } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { criarPauta } from "./actions";
import type { Oportunidade } from "@/lib/content/pautas";

/**
 * A fila do Search Console, virando pauta com um clique.
 *
 * O número que interessa não é a impressão, é a impressão que não vira clique.
 * `aliança` aparece 304 mil vezes e recebe 91 cliques: a JK já está na página
 * de resultado e não é escolhida, que é o problema mais barato de resolver e o
 * mais fácil de medir depois.
 */
export function Oportunidades({ itens }: { itens: Oportunidade[] }) {
  const [criadas, setCriadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (itens.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-border px-5 py-4 text-sm leading-relaxed text-muted">
        Nenhuma consulta na fila. Ou todas já viraram pauta, ou ainda não há
        exportação do Search Console importada em Métricas.
      </p>
    );
  }

  const virarPauta = (o: Oportunidade) => {
    setErro(null);
    const dados = new FormData();
    dados.set("target_query", o.consulta);
    dados.set("origem", "gsc");
    dados.set("impressions", String(o.impressoes));
    dados.set("clicks", String(o.cliques));
    dados.set("position", String(o.posicao));
    dados.set("ctr", String(o.ctr));
    dados.set("search_intent", "informacional");
    dados.set("modelo", "artigo");

    iniciar(async () => {
      const r = await criarPauta({}, dados);
      if (r.error) setErro(r.error);
      else setCriadas((antes) => new Set(antes).add(o.consulta));
    });
  };

  const numero = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div>
      {erro ? (
        <p role="alert" className="mb-4 rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
          {erro}
        </p>
      ) : null}

      <ul className="space-y-3">
        {itens.map((o) => {
          const feita = criadas.has(o.consulta);
          return (
            <li key={o.consulta} className="glass rounded-[16px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display text-xl text-ink">{o.consulta}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand-strong">
                      <TrendingUp size={11} aria-hidden /> {o.nota}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{o.porque}</p>
                </div>

                <button
                  type="button"
                  onClick={() => virarPauta(o)}
                  disabled={ocupado || feita}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                >
                  {feita ? "Virou pauta" : "Virar pauta"}
                  {feita ? null : <ArrowRight size={13} aria-hidden />}
                </button>
              </div>

              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="inline text-muted">Impressões: </dt>
                  <dd className="inline font-medium text-ink">{numero(o.impressoes)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Cliques: </dt>
                  <dd className="inline font-medium text-ink">{numero(o.cliques)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">CTR: </dt>
                  <dd className="inline font-medium text-ink">
                    {o.ctr.toFixed(2).replace(".", ",")}%
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Posição: </dt>
                  <dd className="inline font-medium text-ink">
                    {o.posicao.toFixed(1).replace(".", ",")}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
