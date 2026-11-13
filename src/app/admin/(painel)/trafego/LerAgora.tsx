"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { lerGastoAgora, type EstadoDaLeitura } from "./actions";

const NOME = { meta: "Meta", google: "Google Ads" } as const;
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Botão de ler o gasto na hora. É de cliente para mostrar, plataforma por
 * plataforma, o que a leitura devolveu: quando a API recusa, a mensagem diz o
 * que falta configurar, e sem isso o botão pareceria não ter feito nada.
 */
export function LerAgora() {
  const [estado, ler, lendo] = useActionState<EstadoDaLeitura, FormData>(lerGastoAgora, {});

  return (
    <form action={ler} className="mt-4">
      <button
        type="submit"
        disabled={lendo}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink/85 disabled:opacity-60"
      >
        {lendo ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RefreshCw size={12} aria-hidden />}
        {lendo ? "Lendo as plataformas" : "Ler agora"}
      </button>

      <ul className="mt-3 space-y-1.5" aria-live="polite">
        {(estado.resultados ?? []).map((r) => {
          const ok = r.estado === "ok";
          const Icone = ok ? CircleCheck : r.estado === "sem_acesso" ? TriangleAlert : CircleAlert;
          const cor = ok ? "#047857" : r.estado === "sem_acesso" ? "#b45309" : "#b91c1c";
          return (
            <li key={r.plataforma} className="flex items-start gap-1.5 text-xs text-ink">
              <Icone size={14} className="mt-0.5 shrink-0" style={{ color: cor }} aria-hidden />
              <span>
                <span className="font-semibold">{NOME[r.plataforma]}:</span>{" "}
                {ok ? `lido. ${r.dias} ${r.dias === 1 ? "dia" : "dias"}, ${reais(r.gasto ?? 0)}.` : r.mensagem}
              </span>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
