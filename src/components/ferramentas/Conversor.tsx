"use client";

import { useMemo, useState } from "react";
import {
  UNIDADES,
  UNIDADE_AJUDA,
  UNIDADE_LABEL,
  medidasDoAro,
  paraAro,
  tabelaDeConversao,
  type Unidade,
} from "@/lib/medidor/conversao";
import { ARO_MAXIMO, ARO_MINIMO } from "@/lib/medidor/aros";

/**
 * Conversor de tamanho de anel.
 *
 * Segue o padrão do medidor: a matemática mora em `src/lib/medidor`, sem
 * dependência nenhuma, e este componente só desenha e lê o teclado. Nada de
 * `localStorage` aqui: converter é uma pergunta pontual, e guardar estado seria
 * lembrar de uma coisa que a pessoa não pediu para ser lembrada.
 *
 * O resultado vive em `aria-live`, porque quem usa leitor de tela precisa saber
 * que a resposta mudou sem ter que sair do campo e voltar.
 */
export function Conversor({ aroInicial = 18 }: { aroInicial?: number }) {
  const [unidade, setUnidade] = useState<Unidade>("aro");
  const [texto, setTexto] = useState(String(aroInicial));

  const valor = Number(texto.replace(",", "."));
  const aro = paraAro(valor, unidade);
  const medidas = useMemo(() => (aro ? medidasDoAro(aro) : null), [aro]);
  const tabela = useMemo(() => tabelaDeConversao(), []);

  // Fora da faixa da tabela o resultado ainda sai, porém preso no limite, e
  // dizer isso evita a pessoa achar que mediu certo.
  const foraDaFaixa =
    aro !== null &&
    ((unidade === "aro" && (valor < ARO_MINIMO || valor > ARO_MAXIMO)) ||
      (unidade === "circunferencia" && (valor < ARO_MINIMO + 40 || valor > ARO_MAXIMO + 40)));

  const numero = (n: number, casas = 2) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  return (
    <div className="glass rounded-[20px] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block text-sm font-medium text-ink">
          A medida que você já tem
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as Unidade)}
            className="mt-1.5 w-full rounded-[12px] border border-border bg-white/80 px-4 py-3 text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {UNIDADE_LABEL[u]}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">{UNIDADE_AJUDA[unidade]}</span>
        </label>

        <label className="block text-sm font-medium text-ink">
          <span className="sr-only">Valor</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            inputMode="decimal"
            aria-label={`Valor em ${UNIDADE_LABEL[unidade]}`}
            className="mt-1.5 w-full rounded-[12px] border border-border bg-white/80 px-4 py-3 text-2xl text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand sm:w-40"
          />
        </label>
      </div>

      <div aria-live="polite" className="mt-7">
        {medidas === null ? (
          <p className="text-muted">Digite um número para ver a conversão.</p>
        ) : (
          <>
            <p className="sr-only">
              Aro brasileiro {medidas.aro}, tamanho americano {numero(medidas.eua, 1)}, padrão
              europeu {medidas.iso}, circunferência {numero(medidas.circunferencia, 0)} milímetros,
              diâmetro {numero(medidas.diametro)} milímetros.
            </p>

            <dl aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                { termo: "Aro brasileiro", valor: String(medidas.aro), destaque: true },
                { termo: "Estados Unidos", valor: numero(medidas.eua, 1) },
                { termo: "Europa, ISO", valor: String(medidas.iso) },
                { termo: "Circunferência", valor: `${numero(medidas.circunferencia, 0)} mm` },
                { termo: "Diâmetro", valor: `${numero(medidas.diametro)} mm` },
              ].map((c) => (
                <div
                  key={c.termo}
                  className={`rounded-[14px] px-4 py-3 ${
                    c.destaque ? "bg-brand/20" : "bg-white/50"
                  }`}
                >
                  <dt className="text-xs text-muted">{c.termo}</dt>
                  <dd
                    className={`font-display mt-0.5 text-ink ${
                      c.destaque ? "text-3xl" : "text-2xl"
                    }`}
                  >
                    {c.valor}
                  </dd>
                </div>
              ))}
            </dl>

            {foraDaFaixa ? (
              <p className="mt-4 rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
                Esse valor está fora da faixa que a joalheria produz, do aro {ARO_MINIMO} ao{" "}
                {ARO_MAXIMO}. A conversão acima mostra o limite mais próximo.
              </p>
            ) : null}
          </>
        )}
      </div>

      <details className="mt-7 border-t border-border pt-5">
        <summary className="cursor-pointer text-sm text-muted transition-colors hover:text-ink">
          Ver a tabela completa, do aro {ARO_MINIMO} ao {ARO_MAXIMO}
        </summary>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="pb-3 text-left text-xs text-muted">
              Equivalência entre o aro brasileiro, o tamanho americano, o padrão europeu ISO 8653,
              a circunferência e o diâmetro internos.
            </caption>
            <thead>
              <tr>
                {["Aro (Brasil)", "EUA", "Europa (ISO)", "Circunferência", "Diâmetro"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2 text-left font-semibold text-ink"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.map((l) => (
                <tr
                  key={l.aro}
                  className={l.aro === medidas?.aro ? "bg-brand/15" : undefined}
                  aria-current={l.aro === medidas?.aro ? "true" : undefined}
                >
                  <th scope="row" className="border-b border-border/60 px-3 py-2 text-left font-medium text-ink">
                    {l.aro}
                  </th>
                  <td className="border-b border-border/60 px-3 py-2 text-muted">{numero(l.eua, 1)}</td>
                  <td className="border-b border-border/60 px-3 py-2 text-muted">{l.iso}</td>
                  <td className="border-b border-border/60 px-3 py-2 text-muted">{l.circunferencia} mm</td>
                  <td className="border-b border-border/60 px-3 py-2 text-muted">{numero(l.diametro)} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
