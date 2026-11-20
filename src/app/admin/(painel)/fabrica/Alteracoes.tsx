"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { AlteracaoDaFabrica } from "@/lib/fabrica/dados";
import { avisarOTime } from "@/lib/time/ao-vivo";

/**
 * Os pedidos de alteração de um trabalho (0192), no cartão da fila e do quadro.
 *
 * A aberta fica em VERMELHO, com quem pediu e o texto, até alguém da fábrica
 * tocar em "Ciente": é a trava que impede a peça de seguir sem a fábrica ter
 * visto que o cliente mudou de ideia. As que já têm ciência viram uma linha só.
 * Sem `ciente` (quem vende), o botão não aparece e a frase diz que a fábrica
 * ainda não viu.
 */
export type DarCiencia = (id: number) => Promise<{ ok: true } | { ok: false; erro: string }>;

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AlteracoesDoTrabalho({ lista, ciente, grande = false }: { lista: AlteracaoDaFabrica[]; ciente?: DarCiencia; grande?: boolean }) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const abertas = lista.filter((a) => !a.cienteEm);
  const vistas = lista.filter((a) => a.cienteEm);
  if (lista.length === 0) return null;

  const marcar = (id: number) =>
    comecar(async () => {
      setErro(null);
      const r = await ciente!(id);
      if (r.ok) {
        avisarOTime("fila-da-fabrica");
        router.refresh();
      } else setErro(r.erro);
    });

  return (
    <div className="mt-2 space-y-1.5">
      {abertas.map((a) => (
        <div key={a.id} role="alert" className={`rounded-[10px] border-2 p-2.5 ${grande ? "text-sm" : "text-xs"}`} style={{ background: "#fde8e8", borderColor: "#e0a3a3", color: "#7f1414" }}>
          <p className="flex items-start gap-1.5 font-bold">
            <AlertTriangle size={grande ? 16 : 14} className="mt-px shrink-0" aria-hidden="true" />
            <span className="[overflow-wrap:anywhere]">Alteração: {a.texto}</span>
          </p>
          <p className="mt-1 pl-5 font-semibold opacity-90">
            {a.por ? `Pedida por ${a.por}` : "Pedida"} em {hora(a.em)}{ciente ? "" : ". A fábrica ainda não viu."}
          </p>
          {ciente ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => marcar(a.id)}
              className="painel-toque relative z-20 ml-5 mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-bold text-white disabled:opacity-60"
              style={{ background: "#9b1c1c" }}
            >
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Ciente
            </button>
          ) : null}
        </div>
      ))}
      {vistas.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold opacity-75">
            {vistas.length === 1 ? "1 alteração com ciência da fábrica" : `${vistas.length} alterações com ciência da fábrica`}
          </summary>
          <ul className="mt-1 space-y-1 pl-3">
            {vistas.map((a) => (
              <li key={a.id} className="[overflow-wrap:anywhere]">
                {a.texto} <span className="opacity-70">(ciente{a.cientePor ? `: ${a.cientePor}` : ""}, {hora(a.cienteEm!)})</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {erro ? <p className="text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}
