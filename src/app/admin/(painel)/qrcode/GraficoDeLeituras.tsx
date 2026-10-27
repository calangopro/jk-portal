/**
 * Leituras por dia, uma coluna por dia, do mais antigo à esquerda até hoje.
 *
 * Série única, então sem legenda: o título diz o que é. A cor é o dourado
 * escuro do menu, que passa de 3:1 sobre o vidro claro; o dourado principal
 * não passa, e coluna que mal se vê é dado escondido. O desenho é para o olho,
 * e a tabela logo abaixo é a versão de quem usa leitor de tela.
 */

export const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

const plural = (n: number) => `${n} ${n === 1 ? "leitura" : "leituras"}`;

export function GraficoDeLeituras({
  dias,
  noDia,
  hoje,
  titulo = "Leituras por dia, últimos 30 dias",
}: {
  dias: string[];
  noDia: Map<string, number>;
  hoje: string;
  titulo?: string;
}) {
  const maior = Math.max(1, ...noDia.values());

  return (
    <figure className="glass mt-5 rounded-[18px] p-5">
      <figcaption className="text-sm font-medium text-ink">{titulo}</figcaption>
      <div aria-hidden className="mt-5 flex h-36 items-end gap-[2px] border-b border-ink/15">
        {dias.map((d) => {
          const n = noDia.get(d) ?? 0;
          return (
            <div key={d} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-brand-nav transition-opacity group-hover:opacity-80"
                style={{ height: n ? `max(${(n / maior) * 100}%, 3px)` : 0 }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-ink px-2 py-1 text-[0.66rem] text-white group-hover:block">
                {d === hoje ? "Hoje" : diaCurto(d)}: {plural(n)}
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-[0.66rem] text-muted">
        <span>{diaCurto(dias[0])}</span>
        <span>{diaCurto(dias[14])}</span>
        <span>hoje</span>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-brand-nav">Ver em tabela</summary>
        <table className="mt-2 w-full max-w-xs text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">Dia</th>
              <th scope="col" className="py-1 text-right font-medium">Leituras</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => (
              <tr key={d} className="border-t border-border/60">
                <td className="py-1 text-ink">{d === hoje ? "Hoje" : diaCurto(d)}</td>
                <td className="numeros py-1 text-right text-ink">{noDia.get(d) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
