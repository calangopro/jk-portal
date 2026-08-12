"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { tabelaDeAros } from "@/lib/medidor/aros";

const LINHAS = tabelaDeAros();

/**
 * Tabela de conversão de aro.
 *
 * Fica ligada ao resultado: o aro que a pessoa acabou de medir aparece
 * destacado e a tabela rola até ele. Antes o resultado e a tabela estavam na
 * mesma tela e não se falavam.
 *
 * A busca aceita o número do aro ou a medida em milímetros, porque muita gente
 * chega aqui com uma medida na mão e quer o caminho inverso.
 */
export function TabelaAros({ aroDestacado }: { aroDestacado?: number | null }) {
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const linhaAtiva = useRef<HTMLTableRowElement>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().replace(",", ".");
    if (!termo) return LINHAS;
    const n = Number(termo);
    if (Number.isNaN(n)) return LINHAS;
    // Aro (7 a 35) ou medida em milímetros: a faixa de valores não se cruza,
    // então dá para descobrir a intenção pelo próprio número.
    if (n >= 7 && n <= 35) return LINHAS.filter((l) => String(l.aro).startsWith(termo));
    return LINHAS.filter(
      (l) => Math.abs(l.diametro - n) < 1.2 || Math.abs(l.circunferencia - n) < 3,
    );
  }, [busca]);

  useEffect(() => {
    if (!aroDestacado || !linhaAtiva.current || !caixa.current) return;
    const linha = linhaAtiva.current;
    const area = caixa.current;
    area.scrollTop =
      linha.offsetTop - area.clientHeight / 2 + linha.clientHeight / 2;
  }, [aroDestacado, filtradas]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-titulo-secao text-ink">
            Tabela de aros
          </h2>
          <p className="mt-2 text-apoio text-muted">
            No padrão brasileiro, a circunferência interna em milímetros é o
            número do aro mais 40.
          </p>
        </div>

        <label className="relative flex items-center">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3.5 text-muted"
          />
          <span className="sr-only">Buscar por aro ou medida em milímetros</span>
          <input
            type="search"
            inputMode="decimal"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Aro ou mm"
            className="min-h-11 w-40 rounded-full border border-border bg-white/70 pl-10 pr-4 text-apoio text-ink outline-none transition-colors placeholder:text-muted/60 hover:border-brand/40 focus:border-brand"
          />
        </label>
      </div>

      <div className="glass mt-6 overflow-hidden rounded-lg">
        <div ref={caixa} className="max-h-[26rem] overflow-y-auto">
          <table className="numeros w-full text-left text-apoio">
            <caption className="sr-only">
              Conversão entre o aro brasileiro, o diâmetro e a circunferência
              interna, em milímetros.
            </caption>
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <tr className="text-nota uppercase tracking-wider text-brand-strong">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Aro
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Diâmetro
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  <span className="sm:hidden">Circunf.</span>
                  <span className="hidden sm:inline">Circunferência</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => {
                const atual = l.aro === aroDestacado;
                return (
                  <tr
                    key={l.aro}
                    ref={atual ? linhaAtiva : undefined}
                    aria-current={atual ? "true" : undefined}
                    className={`border-t border-border/60 transition-colors ${
                      atual ? "bg-brand/15 font-semibold text-ink" : "text-muted"
                    }`}
                  >
                    <th
                      scope="row"
                      className={`px-5 py-2.5 text-left font-semibold ${
                        atual ? "text-brand-strong" : "text-ink"
                      }`}
                    >
                      {l.aro}
                      {atual ? (
                        <span className="ml-2 rounded-full bg-brand/25 px-2 py-0.5 text-nota font-semibold text-brand-strong">
                          seu aro
                        </span>
                      ) : null}
                    </th>
                    <td className="px-5 py-2.5">
                      {l.diametro.toFixed(2).replace(".", ",")} mm
                    </td>
                    <td className="px-5 py-2.5">{l.circunferencia} mm</td>
                  </tr>
                );
              })}

              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-muted">
                    Nenhum aro corresponde a essa medida.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
