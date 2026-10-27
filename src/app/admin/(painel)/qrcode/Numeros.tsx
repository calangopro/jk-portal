import { quandoLegivel } from "@/lib/content/agenda";
import type { Resumo } from "./dados";

/** Os quatro números de leitura e a linha de baixo, iguais na lista e na tela de cada QR. */
export function Numeros({ resumo }: { resumo: Resumo }) {
  const outros = resumo.ultimos_30 - resumo.iphone_30 - resumo.android_30;
  const fatia = (n: number) => `${n} (${Math.round((n / resumo.ultimos_30) * 100)}%)`;

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Hoje", resumo.hoje],
            ["Últimos 7 dias", resumo.ultimos_7],
            ["Últimos 30 dias", resumo.ultimos_30],
            ["Desde o início", resumo.total],
          ] as const
        ).map(([rotulo, valor]) => (
          <div key={rotulo} className="glass rounded-[16px] p-4">
            <dt className="text-xs text-muted">{rotulo}</dt>
            <dd className="numeros mt-1 font-display text-3xl text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {resumo.ultima ? `Última leitura em ${quandoLegivel(resumo.ultima)}.` : "Nenhuma leitura ainda."}
        {resumo.ultimos_30 > 0
          ? ` Em 30 dias: iPhone ${fatia(resumo.iphone_30)}, Android ${fatia(resumo.android_30)}${
              outros > 0 ? `, outros ${fatia(outros)}` : ""
            }.`
          : ""}{" "}
        Robô de prévia de link não entra na conta.
      </p>
    </>
  );
}
