"use client";

import { useState, useTransition } from "react";
import { History, RotateCcw } from "lucide-react";
import { listarRevisoes, restaurarRevisao, type Revisao } from "./actions";

/**
 * Histórico de versões, com voltar.
 *
 * A tabela `revisions` já guardava um retrato a cada salvamento manual e não
 * havia tela nenhuma para abrir. Histórico que ninguém consegue ver não protege
 * ninguém: a pessoa edita com medo de estragar, e escrever com medo é lento.
 *
 * A lista carrega sob demanda, no primeiro clique, porque a maioria das sessões
 * de edição nunca precisa dela e o editor já carrega bastante coisa.
 */
export function Historico({ contentId }: { contentId: string }) {
  const [versoes, setVersoes] = useState<Revisao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const carregar = () => {
    if (versoes) return;
    iniciar(async () => {
      try {
        setVersoes(await listarRevisoes(contentId));
      } catch {
        setErro("Não consegui carregar o histórico.");
      }
    });
  };

  const restaurar = (v: Revisao) => {
    const quando = new Date(v.criadaEm).toLocaleString("pt-BR");
    if (
      !window.confirm(
        `Voltar para a versão de ${quando}?\n\n` +
          "O texto de agora não se perde: ele continua no histórico, e dá para voltar de novo. " +
          "O status de publicação não muda.",
      )
    ) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await restaurarRevisao(v.id);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível restaurar.");
        return;
      }
      // Recarrega a página inteira de propósito. O editor guarda o texto em
      // estado do React, e voltar sem recarregar deixaria a tela mostrando uma
      // versão e o banco guardando outra, que é pior que não restaurar.
      window.location.reload();
    });
  };

  const quandoLegivel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <details className="group" onToggle={carregar}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
        <History size={14} aria-hidden />
        Ver versões anteriores
      </summary>

      <div className="mt-4">
        {erro ? (
          <p role="alert" className="mb-3 rounded-[10px] bg-wine/10 px-3 py-2 text-xs text-wine">
            {erro}
          </p>
        ) : null}

        {versoes === null ? (
          <p className="text-xs text-muted">{ocupado ? "Carregando…" : ""}</p>
        ) : versoes.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-muted">
            Nenhuma versão gravada ainda. O histórico guarda um retrato a cada
            salvamento manual, e não a cada salvamento automático, senão a lista
            viraria dezenas de versões quase idênticas.
          </p>
        ) : (
          <ul className="space-y-2">
            {versoes.map((v, i) => (
              <li
                key={v.id}
                className="flex flex-wrap items-start gap-3 rounded-[10px] border border-border bg-white/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {quandoLegivel(v.criadaEm)}
                    {v.autor ? <span className="text-muted">, por {v.autor}</span> : null}
                    {i === 0 ? (
                      <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-strong">
                        mais recente
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
                    {v.titulo}, {v.tamanhoDoCorpo.toLocaleString("pt-BR")} caracteres no corpo.
                    {v.diferencas.length === 0
                      ? " Igual ao que está na tela."
                      : ` Diferente em: ${v.diferencas.join(", ")}.`}
                  </p>
                  {v.nota ? (
                    <p className="mt-1 text-[0.7rem] text-brand-strong">{v.nota}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => restaurar(v)}
                  disabled={ocupado || v.diferencas.length === 0}
                  title={
                    v.diferencas.length === 0
                      ? "Esta versão é igual ao que já está no ar."
                      : undefined
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink transition-colors hover:border-brand/50 hover:bg-white disabled:opacity-40"
                >
                  <RotateCcw size={12} aria-hidden /> Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
